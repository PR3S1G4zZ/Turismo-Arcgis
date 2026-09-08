import {
  BEARING_SOURCES,
  POSITION_SOURCES,
} from './navigationContracts';
import { distanciaM, rumbo } from './geoRuta';
import { getNavigationProfile } from './navigationProfiles';

const BEARING_SOURCE_VALUES = new Set(Object.values(BEARING_SOURCES));
const POSITION_SOURCE_VALUES = new Set(Object.values(POSITION_SOURCES));
const PERMITTED_COMPASS = new Set(['granted', 'concedido', 'no-requiere']);

/** Normaliza un ángulo al intervalo [0, 360). */
export function normalizeAngle(value) {
  if (!Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

/** Diferencia firmada más corta desde `from` hasta `to`. */
export function circularDifference(from, to) {
  const inicio = normalizeAngle(from);
  const fin = normalizeAngle(to);
  if (inicio == null || fin == null) return null;
  const diferencia = fin - inicio;
  if (diferencia > 180) return diferencia - 360;
  if (diferencia < -180) return diferencia + 360;
  return diferencia;
}

/** Interpola por el arco corto entre dos ángulos. */
export function interpolateCircularAngle(from, to, factor = 0.5) {
  const inicio = normalizeAngle(from);
  const diferencia = circularDifference(from, to);
  if (inicio == null || diferencia == null || !Number.isFinite(factor)) return null;
  const peso = Math.max(0, Math.min(1, factor));
  return normalizeAngle(inicio + diferencia * peso);
}

/** Alias en español para los consumidores de utilidades de rumbo existentes. */
export const normalizarRumbo = normalizeAngle;
export const diferenciaCircular = circularDifference;
export const interpolarAnguloCircular = interpolateCircularAngle;

function positionFrom(value) {
  if (Array.isArray(value) && value.length >= 2) {
    return Number.isFinite(value[0]) && Number.isFinite(value[1])
      ? { lat: value[0], lng: value[1] }
      : null;
  }
  if (!value || typeof value !== 'object') return null;

  if (value.position && value.position !== value) return positionFrom(value.position);
  if (value.coords && value.coords !== value) {
    const nested = positionFrom(value.coords);
    if (nested) return nested;
  }

  const lat = value.lat ?? value.latitude;
  const lng = value.lng ?? value.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function clonePosition(value) {
  const position = positionFrom(value);
  return position ? { ...position } : null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeObservation(observation) {
  if (!observation || typeof observation !== 'object') return null;
  const position = positionFrom(observation);
  const coords = observation.coords && typeof observation.coords === 'object'
    ? observation.coords
    : observation;
  const timestamp = observation.timestamp ?? observation.time;
  if (!position || !Number.isFinite(timestamp)) return null;

  const speedValue = coords.speed ?? observation.speed;
  const headingValue = coords.heading ?? observation.heading;
  const speed = Number.isFinite(speedValue) && speedValue >= 0 ? speedValue : null;
  const heading = normalizeAngle(headingValue);
  const accuracyValue = coords.accuracy ?? observation.accuracy;
  const accuracy = Number.isFinite(accuracyValue) && accuracyValue >= 0
    ? accuracyValue
    : null;

  return {
    position,
    timestamp,
    accuracy,
    speed,
    heading,
  };
}

function sourceOrder(profile, moving) {
  const configured = moving
    ? profile.heading.sourceOrderMoving
    : profile.heading.sourceOrderStopped;
  const fallback = moving
    ? ['gps', 'derived', 'route-tangent', 'held']
    : ['compass', 'route-tangent', 'held'];
  return Array.isArray(configured) ? configured : fallback;
}

function getCompass(context) {
  const raw = context.compass && typeof context.compass === 'object'
    ? context.compass
    : {};
  const headingValue = context.compassHeading
    ?? context.headingCompass
    ?? (typeof context.compass === 'number'
      ? context.compass
      : raw.heading ?? raw.value);
  const timestamp = context.compassTimestamp ?? raw.timestamp;
  const permission = context.compassPermission
    ?? raw.permission
    ?? (raw.authorized === true ? 'granted' : raw.authorized === false ? 'denied' : undefined);
  return {
    heading: normalizeAngle(headingValue),
    timestamp: finiteOrNull(timestamp),
    permission,
  };
}

function getMatch(context) {
  const raw = context.match
    ?? context.routeMatch
    ?? context.matching
    ?? context.projection
    ?? {};
  const position = clonePosition(
    raw.position
      ?? raw.matchedPosition
      ?? context.matchedPosition,
  );
  const segmentIndex = finiteOrNull(
    raw.segmentIndex
      ?? raw.routeSegmentIndex
      ?? raw.indice
      ?? context.routeSegmentIndex,
  );
  const deviationM = finiteOrNull(
    raw.deviationM
      ?? raw.distanceM
      ?? raw.desviacionM
      ?? context.deviationM,
  );
  const progressM = finiteOrNull(
    raw.progressM
      ?? raw.recorridoM
      ?? raw.progress
      ?? context.progressM
      ?? context.routeProgressM,
  );
  const progressPlausible = typeof raw.progressPlausible === 'boolean'
    ? raw.progressPlausible
    : typeof context.progressPlausible === 'boolean' ? context.progressPlausible : true;
  const explicitOffRoute = typeof raw.isOffRoute === 'boolean'
    ? raw.isOffRoute
    : typeof raw.desviado === 'boolean'
      ? raw.desviado
      : typeof context.isOffRoute === 'boolean' ? context.isOffRoute : null;

  return {
    position,
    segmentIndex: segmentIndex == null ? null : Math.trunc(segmentIndex),
    deviationM,
    progressM,
    progressPlausible,
    explicitOffRoute,
  };
}

function getRouteTangent(context, segmentIndex) {
  const direct = context.routeTangent
    ?? context.routeBearing
    ?? context.matchedBearing
    ?? context.tangentBearing;
  if (Number.isFinite(direct)) return normalizeAngle(direct);

  const route = context.route;
  const points = route?.puntos ?? route?.points;
  if (!Array.isArray(points) || points.length < 2) return null;
  const index = Number.isFinite(segmentIndex) ? Math.trunc(segmentIndex) : 0;
  const start = Math.max(0, Math.min(index, points.length - 2));
  const from = positionFrom(points[start]);
  const to = positionFrom(points[start + 1]);
  if (!from || !to) return null;
  return normalizeAngle(rumbo([from.lat, from.lng], [to.lat, to.lng]));
}

function getTargetPosition(context) {
  if (context.targetPosition !== undefined) return clonePosition(context.targetPosition);
  if (context.target !== undefined) return clonePosition(context.target);
  return undefined;
}

function createEmptyPose(timestamp = 0) {
  return {
    rawPosition: null,
    matchedPosition: null,
    targetPosition: null,
    movementBearing: null,
    arrowBearing: null,
    cameraBearing: null,
    speedEstimateMps: null,
    accuracyM: null,
    routeSegmentIndex: null,
    confidence: 'lost',
    isMoving: false,
    isOffRoute: false,
    bearingSource: BEARING_SOURCES.HELD,
    positionSource: POSITION_SOURCES.HELD,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  };
}

function initialState(profile) {
  return {
    profile: profile.profile,
    lastTimestamp: null,
    lastObservation: null,
    lastProgressM: null,
    lastProgressTimestamp: null,
    lastCandidateTimestamp: null,
    motionCandidateCount: 0,
    stoppedObservations: 0,
    isMoving: false,
    lastBearing: null,
    lastBearingTimestamp: null,
    lastMovementBearing: null,
    lastUsableTarget: null,
    lastUsableTimestamp: null,
    lastPose: createEmptyPose(),
  };
}

function routeCorridorM(profile, accuracy) {
  const { corridorMinM, corridorMaxM, accuracyMultiplier } = profile.matching;
  const accuracyBased = Number.isFinite(accuracy) ? accuracy * accuracyMultiplier : corridorMinM;
  return Math.max(corridorMinM, Math.min(corridorMaxM, accuracyBased));
}

function confidenceFor({ profile, accuracy, isOffRoute, progressRejected = false }) {
  if (!Number.isFinite(accuracy)
    || accuracy > profile.confidence.lowAccuracyMaxM
    || isOffRoute
    || progressRejected) {
    return 'low';
  }
  if (accuracy <= profile.confidence.highAccuracyMaxM) return 'high';
  if (accuracy <= profile.confidence.mediumAccuracyMaxM) return 'medium';
  return 'low';
}

function compassIsFresh(compass, timestamp, maxAgeMs) {
  if (compass.heading == null || compass.timestamp == null) return false;
  if (!PERMITTED_COMPASS.has(compass.permission)) return false;
  const age = timestamp - compass.timestamp;
  return age >= 0 && age <= maxAgeMs;
}

function bearingCandidates({ state, observation, context, profile, moving, displacementM, match }) {
  const gpsTrusted = context.gpsTrusted ?? context.gpsConfiable ?? true;
  const gps = moving && gpsTrusted ? observation.heading : null;
  const derived = moving
    && state.lastObservation
    && displacementM >= profile.motion.displacementEnterM
    ? rumbo(
      [state.lastObservation.position.lat, state.lastObservation.position.lng],
      [observation.position.lat, observation.position.lng],
    )
    : null;
  const routeTangent = getRouteTangent(context, match.segmentIndex);
  const compass = !moving && compassIsFresh(
    getCompass(context),
    observation.timestamp,
    profile.heading.compassMaxAgeMs,
  ) ? getCompass(context).heading : null;
  const held = state.lastBearing != null
    && state.lastBearingTimestamp != null
    && observation.timestamp - state.lastBearingTimestamp >= 0
    && observation.timestamp - state.lastBearingTimestamp <= profile.heading.heldMaxAgeMs
    ? state.lastBearing
    : null;
  return {
    [BEARING_SOURCES.GPS]: gps,
    [BEARING_SOURCES.DERIVED]: derived,
    [BEARING_SOURCES.ROUTE_TANGENT]: routeTangent,
    [BEARING_SOURCES.COMPASS]: compass,
    [BEARING_SOURCES.HELD]: held,
    gps,
    derived,
    routeTangent,
    compass,
    held,
  };
}

function resolveBearing({ state, observation, context, profile, moving, displacementM, match }) {
  const candidates = bearingCandidates({
    state,
    observation,
    context,
    profile,
    moving,
    displacementM,
    match,
  });
  for (const source of sourceOrder(profile, moving)) {
    if (!BEARING_SOURCE_VALUES.has(source) || candidates[source] == null) continue;
    const bearing = normalizeAngle(candidates[source]);
    return {
      bearing,
      source,
      movementBearing: candidates.gps ?? candidates.derived ?? state.lastMovementBearing,
    };
  }
  return {
    bearing: null,
    source: BEARING_SOURCES.HELD,
    movementBearing: state.lastMovementBearing,
  };
}

function buildPose({ state, observation, context, profile, moving, displacementM, speedEstimateMps, match }) {
  const corridorM = routeCorridorM(profile, observation.accuracy);
  const progressPlausible = match.progressPlausible !== false;
  const offRoute = match.explicitOffRoute != null
    ? match.explicitOffRoute
    : match.deviationM != null && match.deviationM > corridorM;
  const matched = match.position && progressPlausible && !offRoute
    && observation.accuracy != null
    && observation.accuracy <= profile.confidence.lowAccuracyMaxM
    ? match.position
    : null;
  const positionIsUsable = observation.accuracy != null
    && observation.accuracy <= profile.confidence.lowAccuracyMaxM
    && !offRoute
    && progressPlausible;
  const heldAgeMs = state.lastUsableTimestamp == null
    ? Infinity
    : observation.timestamp - state.lastUsableTimestamp;
  const canHoldPosition = !positionIsUsable
    && state.lastUsableTarget
    && heldAgeMs >= 0
    && heldAgeMs <= profile.matching.maxHeldPositionMs;
  const positionSource = canHoldPosition
    ? POSITION_SOURCES.HELD
    : matched ? POSITION_SOURCES.MATCHED : POSITION_SOURCES.RAW;
  const bearing = resolveBearing({
    state,
    observation,
    context,
    profile,
    moving,
    displacementM,
    match,
  });
  const cameraBearing = context.cameraBearing == null
    ? bearing.bearing
    : normalizeAngle(context.cameraBearing);
  const targetCandidate = getTargetPosition(context);
  const targetPositionFromObservation = targetCandidate === undefined
    ? progressPlausible ? clonePosition(matched ?? observation.position) : null
    : targetCandidate;
  const targetPosition = canHoldPosition
    ? clonePosition(state.lastUsableTarget)
    : targetPositionFromObservation;
  const pose = {
    rawPosition: clonePosition(observation.position),
    matchedPosition: clonePosition(matched),
    targetPosition,
    movementBearing: normalizeAngle(bearing.movementBearing),
    arrowBearing: bearing.bearing,
    cameraBearing,
    speedEstimateMps,
    accuracyM: observation.accuracy,
    routeSegmentIndex: match.segmentIndex,
    confidence: confidenceFor({
      profile,
      accuracy: observation.accuracy,
      isOffRoute: offRoute,
      progressRejected: !progressPlausible,
    }),
    isMoving: moving,
    isOffRoute: Boolean(offRoute),
    bearingSource: bearing.source,
    positionSource,
    timestamp: observation.timestamp,
  };
  return { pose, bearing, positionIsUsable };
}

function mergeContext(defaults, context) {
  return { ...defaults, ...context };
}

function resolveProfile(value) {
  return value && typeof value === 'object' && value.motion && value.heading
    ? value
    : getNavigationProfile(value);
}

function updateState(state, observation, context, profile) {
  const previous = state.lastObservation;
  const deltaMs = previous ? observation.timestamp - previous.timestamp : null;
  const displacementM = previous
    ? distanciaM(
      [previous.position.lat, previous.position.lng],
      [observation.position.lat, observation.position.lng],
    )
    : 0;
  const match = getMatch(context);
  const progressDeltaM = match.progressM != null && state.lastProgressM != null
    ? Math.max(0, match.progressM - state.lastProgressM)
    : 0;
  const speedEstimateMps = observation.speed != null
    ? observation.speed
    : deltaMs > 0 && displacementM > 0 ? displacementM / (deltaMs / 1000) : null;
  const speedSignal = observation.speed != null
    && observation.speed >= profile.motion.speedEnterMps;
  const displacementSignal = displacementM >= profile.motion.displacementEnterM;
  const progressSignal = progressDeltaM >= profile.motion.progressEnterM;
  const positiveMovement = speedSignal || displacementSignal || progressSignal;
  let motionCandidateCount = state.motionCandidateCount;
  let stoppedObservations = state.stoppedObservations;
  let lastCandidateTimestamp = state.lastCandidateTimestamp;
  let lastProgressTimestamp = state.lastProgressTimestamp;
  let isMoving = state.isMoving;

  const observationIntervalSufficient = deltaMs == null
    || deltaMs >= profile.motion.observationWindowMinMs;

  if (positiveMovement) {
    const candidateExpired = lastCandidateTimestamp != null
      && observation.timestamp - lastCandidateTimestamp > profile.motion.observationWindowMaxMs;
    if (observationIntervalSufficient) {
      motionCandidateCount = candidateExpired ? 1 : motionCandidateCount + 1;
      lastCandidateTimestamp = observation.timestamp;
    }
    lastProgressTimestamp = observation.timestamp;
    stoppedObservations = 0;
    if (!isMoving && motionCandidateCount >= profile.motion.entryObservations) isMoving = true;
  } else {
    motionCandidateCount = 0;
    lastCandidateTimestamp = null;
    if (isMoving) {
      stoppedObservations += 1;
      const noProgressMs = lastProgressTimestamp == null
        ? 0
        : observation.timestamp - lastProgressTimestamp;
      if (stoppedObservations >= profile.motion.stoppedObservations
        || noProgressMs >= profile.motion.stoppedNoProgressMs) {
        isMoving = false;
      }
    } else {
      stoppedObservations = 0;
    }
  }

  const { pose, bearing, positionIsUsable } = buildPose({
    state,
    observation,
    context,
    profile,
    moving: isMoving,
    displacementM,
    speedEstimateMps,
    match,
  });
  const nextState = {
    ...state,
    lastTimestamp: observation.timestamp,
    lastObservation: observation,
    lastProgressM: match.progressM == null ? state.lastProgressM : match.progressM,
    lastProgressTimestamp,
    lastCandidateTimestamp,
    motionCandidateCount,
    stoppedObservations,
    isMoving,
    lastBearing: bearing.bearing == null ? state.lastBearing : bearing.bearing,
    lastBearingTimestamp: bearing.bearing == null ? state.lastBearingTimestamp : observation.timestamp,
    lastMovementBearing: bearing.movementBearing == null
      ? state.lastMovementBearing
      : normalizeAngle(bearing.movementBearing),
    lastUsableTarget: pose.positionSource === POSITION_SOURCES.HELD
      ? state.lastUsableTarget
      : positionIsUsable && pose.targetPosition
        ? clonePosition(pose.targetPosition)
        : state.lastUsableTarget,
    lastUsableTimestamp: pose.positionSource === POSITION_SOURCES.HELD
      ? state.lastUsableTimestamp
      : positionIsUsable && pose.targetPosition
        ? observation.timestamp
        : state.lastUsableTimestamp,
    lastPose: pose,
  };
  return { state: nextState, pose, accepted: true };
}

/**
 * Avanza una máquina de pose a partir de una observación GPS ordenada.
 * Devuelve el estado para permitir un uso funcional, sin efectos externos.
 */
export function updateNavigationPose(state, observation, context = {}) {
  const profile = resolveProfile(context.profile ?? state?.profile);
  const current = state && state.lastPose ? state : initialState(profile);
  const normalized = normalizeObservation(observation);
  if (!normalized || (current.lastTimestamp != null && normalized.timestamp <= current.lastTimestamp)) {
    return { state: current, pose: current.lastPose, accepted: false };
  }
  return updateState(current, normalized, context, profile);
}

/** Crea un estimador reutilizable para una sesión de navegación. */
export function createNavigationPoseEstimator(options = {}) {
  const profile = resolveProfile(options.profile);
  let state = initialState(profile);
  const defaults = { ...options, profile: profile.profile };

  const update = (observation, context = {}) => {
    const result = updateNavigationPose(state, observation, mergeContext(defaults, context));
    state = result.state;
    return result.pose;
  };

  return {
    profile,
    update,
    push: update,
    ingest: update,
    getPose: () => state.lastPose,
    getState: () => ({ ...state }),
    reset: () => {
      state = initialState(profile);
      return state.lastPose;
    },
  };
}

/** Evalúa una observación aislada con una máquina nueva. */
export function estimateNavigationPose(observation, context = {}) {
  return createNavigationPoseEstimator(context).update(observation, context);
}

export const calculateNavigationPose = estimateNavigationPose;
export const buildNavigationPose = estimateNavigationPose;
export const createPoseEstimator = createNavigationPoseEstimator;

// Evita que herramientas de análisis consideren estos vocabularios como API
// accidental: los valores se validan al resolver la fuente y la posición.
export { BEARING_SOURCE_VALUES, POSITION_SOURCE_VALUES };
