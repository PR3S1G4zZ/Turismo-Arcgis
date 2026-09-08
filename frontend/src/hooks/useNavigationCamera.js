import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAMERA_MODES } from '../utilidades/navigationContracts';
import { getNavigationProfile } from '../utilidades/navigationProfiles';
import { circularDifference, normalizeAngle } from './useNavigationFrame';

const RADIO_TIERRA_M = 6371000;
const DEFAULT_CAMERA_LIMITS = Object.freeze({
  minZoom: 0,
  maxZoom: 24,
  minPitch: 0,
  maxPitch: 85,
  minLookAheadM: 0,
  maxLookAheadM: 500,
});
const EMPTY_LIMITS = Object.freeze({});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function resolveProfile(value) {
  return value && typeof value === 'object' && value.camera && value.heading
    ? value
    : getNavigationProfile(value);
}

function isPosition(value) {
  return value
    && Number.isFinite(value.lat)
    && Number.isFinite(value.lng);
}

/** Solo un evento con originalEvent representa una interacción del usuario. */
export function isOriginalEventGesture(event) {
  return Boolean(event?.originalEvent);
}

/** Mantiene el bearing anterior cuando el cambio está dentro del deadband. */
export function applyCameraDeadband(previousBearing, nextBearing, deadbandDeg = 3) {
  const siguiente = normalizeAngle(nextBearing);
  const anterior = normalizeAngle(previousBearing);
  if (siguiente == null) return anterior;
  if (anterior == null || !Number.isFinite(deadbandDeg) || deadbandDeg < 0) return siguiente;
  const diferencia = circularDifference(anterior, siguiente);
  return Math.abs(diferencia) <= deadbandDeg ? anterior : siguiente;
}

/** Limita la velocidad de giro de la cámara por el arco corto. */
export function limitAngularVelocity(
  previousBearing,
  nextBearing,
  maxAngularVelocityDegPerSec = 90,
  elapsedMs = 1000,
) {
  const anterior = normalizeAngle(previousBearing);
  const siguiente = normalizeAngle(nextBearing);
  if (siguiente == null) return anterior;
  if (anterior == null || !Number.isFinite(maxAngularVelocityDegPerSec) || maxAngularVelocityDegPerSec < 0) {
    return siguiente;
  }
  const diferencia = circularDifference(anterior, siguiente);
  if (diferencia == null) return siguiente;
  const segundos = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000;
  const limite = maxAngularVelocityDegPerSec * segundos;
  if (limite === 0 || Math.abs(diferencia) <= limite) return siguiente;
  return normalizeAngle(anterior + Math.sign(diferencia) * limite);
}

/** Punto [lng, lat] a una distancia y rumbo dados del punto geográfico. */
export function destinationFromBearing(position, bearing, distanceM) {
  if (!isPosition(position) || !Number.isFinite(bearing) || !Number.isFinite(distanceM)) return null;
  const distanceRad = Math.max(0, distanceM) / RADIO_TIERRA_M;
  const bearingRad = (normalizeAngle(bearing) * Math.PI) / 180;
  const lat1 = (position.lat * Math.PI) / 180;
  const lng1 = (position.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceRad)
      + Math.cos(lat1) * Math.sin(distanceRad) * Math.cos(bearingRad),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceRad) * Math.cos(lat1),
    Math.cos(distanceRad) - Math.sin(lat1) * Math.sin(lat2),
  );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function resolveLimits(limits = {}) {
  return {
    minZoom: Number.isFinite(limits.minZoom) ? limits.minZoom : DEFAULT_CAMERA_LIMITS.minZoom,
    maxZoom: Number.isFinite(limits.maxZoom) ? limits.maxZoom : DEFAULT_CAMERA_LIMITS.maxZoom,
    minPitch: Number.isFinite(limits.minPitch) ? limits.minPitch : DEFAULT_CAMERA_LIMITS.minPitch,
    maxPitch: Number.isFinite(limits.maxPitch) ? limits.maxPitch : DEFAULT_CAMERA_LIMITS.maxPitch,
    minLookAheadM: Number.isFinite(limits.minLookAheadM)
      ? limits.minLookAheadM
      : DEFAULT_CAMERA_LIMITS.minLookAheadM,
    maxLookAheadM: Number.isFinite(limits.maxLookAheadM)
      ? limits.maxLookAheadM
      : DEFAULT_CAMERA_LIMITS.maxLookAheadM,
  };
}

/**
 * Deriva el objetivo MapLibre exclusivamente desde NavigationFrame. La
 * posición GPS cruda no entra aquí: así marcador y cámara comparten el mismo
 * frame interpolado y no pueden separarse por pipelines distintos.
 */
export function buildCameraTarget(frame, options = {}) {
  const position = frame?.displayPosition;
  if (!isPosition(position)) return null;

  const profile = resolveProfile(options.profile);
  const limits = resolveLimits(options.limits);
  const speed = Number.isFinite(frame.speedEstimateMps) && frame.speedEstimateMps >= 0
    ? frame.speedEstimateMps
    : 0;
  const cameraProfile = profile.camera;
  const rawLookAhead = speed * cameraProfile.lookAheadMultiplier;
  const profileLookAhead = clamp(
    rawLookAhead,
    cameraProfile.lookAheadMinM,
    cameraProfile.lookAheadMaxM,
  );
  const lookAheadM = clamp(profileLookAhead, limits.minLookAheadM, limits.maxLookAheadM);

  const desiredBearing = frame.cameraBearing ?? frame.arrowBearing ?? options.previousBearing ?? 0;
  const deadbandDeg = profile.heading.cameraDeadbandDeg;
  const deadbandBearing = applyCameraDeadband(options.previousBearing, desiredBearing, deadbandDeg);
  const elapsedMs = Number.isFinite(options.elapsedMs)
    ? options.elapsedMs
    : Number.isFinite(frame.timestamp) && Number.isFinite(options.previousTimestamp)
      ? frame.timestamp - options.previousTimestamp
      : 1000;
  const bearing = limitAngularVelocity(
    options.previousBearing,
    deadbandBearing,
    profile.heading.cameraMaxAngularVelocityDegPerSec,
    elapsedMs,
  );
  const zoom = clamp(
    speed >= cameraProfile.highSpeedMps ? cameraProfile.highSpeedZoom : cameraProfile.lowSpeedZoom,
    limits.minZoom,
    limits.maxZoom,
  );
  const pitch = clamp(cameraProfile.pitchDeg, limits.minPitch, limits.maxPitch);
  const center = destinationFromBearing(position, bearing, lookAheadM);

  return {
    center,
    bearing,
    pitch,
    zoom,
    // Consumed by the integration layer to keep the user below the horizon;
    // it is metadata here because this hook does not know viewport dimensions.
    anchorRatio: cameraProfile.anchorRatio,
    lookAheadM,
  };
}

function applyCameraTarget(mapRef, target, duration = 0) {
  const map = mapRef?.current ?? mapRef;
  if (!map || typeof map.easeTo !== 'function' || !target) return false;
  map.easeTo({
    center: target.center,
    bearing: target.bearing,
    pitch: target.pitch,
    zoom: target.zoom,
    duration,
  });
  return true;
}

/**
 * Estado de cámara independiente del GPS. Este hook no usa RAF: el scheduler
 * único vive en useNavigationFrame y este módulo solo consume su resultado.
 */
export function useNavigationCamera({
  frame = null,
  profile = 'walk',
  active = false,
  gpsConfiable = true,
  initialMode = CAMERA_MODES.OVERVIEW,
  mapRef = null,
  onCameraUpdate = null,
  limits = EMPTY_LIMITS,
  recentringDurationMs = 250,
} = {}) {
  const perfil = useMemo(() => resolveProfile(profile), [profile]);
  const [cameraMode, setCameraMode] = useState(() => (
    Object.values(CAMERA_MODES).includes(initialMode) ? initialMode : CAMERA_MODES.OVERVIEW
  ));
  const cameraModeRef = useRef(cameraMode);
  const resumeModeRef = useRef(CAMERA_MODES.FOLLOWING);
  const previousBearingRef = useRef(null);
  const previousTimestampRef = useRef(null);

  const updateMode = useCallback((nextMode) => {
    if (cameraModeRef.current === nextMode) return false;
    cameraModeRef.current = nextMode;
    setCameraMode(nextMode);
    return true;
  }, []);

  useEffect(() => {
    if (!active) {
      updateMode(CAMERA_MODES.OVERVIEW);
      return;
    }
    if (!gpsConfiable) {
      if (cameraModeRef.current !== CAMERA_MODES.GPS_DEGRADED) {
        resumeModeRef.current = [CAMERA_MODES.RECENTERING, CAMERA_MODES.OVERVIEW]
          .includes(cameraModeRef.current)
          ? CAMERA_MODES.FOLLOWING
          : cameraModeRef.current;
        updateMode(CAMERA_MODES.GPS_DEGRADED);
      }
      return;
    }
    if (cameraModeRef.current === CAMERA_MODES.GPS_DEGRADED) {
      updateMode(resumeModeRef.current || CAMERA_MODES.FOLLOWING);
      return;
    }
    if (cameraModeRef.current === CAMERA_MODES.OVERVIEW) updateMode(CAMERA_MODES.FOLLOWING);
  }, [active, gpsConfiable, updateMode]);

  const cameraTarget = useMemo(() => buildCameraTarget(frame, {
    profile: perfil,
    limits,
  }), [frame, perfil, limits]);

  useEffect(() => {
    if (!cameraTarget) return;
    if (![CAMERA_MODES.FOLLOWING, CAMERA_MODES.RECENTERING].includes(cameraMode)) return;
    const targetWithHistory = buildCameraTarget(frame, {
      profile: perfil,
      previousBearing: previousBearingRef.current,
      previousTimestamp: previousTimestampRef.current,
      limits,
    });
    if (!targetWithHistory) return;
    previousBearingRef.current = targetWithHistory.bearing;
    if (Number.isFinite(frame?.timestamp)) previousTimestampRef.current = frame.timestamp;
    const duration = cameraMode === CAMERA_MODES.RECENTERING ? recentringDurationMs : 0;
    onCameraUpdate?.(targetWithHistory, { cameraMode, duration });
    applyCameraTarget(mapRef, targetWithHistory, duration);
  }, [cameraMode, cameraTarget, frame, limits, mapRef, onCameraUpdate, perfil, recentringDurationMs]);

  const handleGesture = useCallback((event) => {
    if (!isOriginalEventGesture(event)) return false;
    resumeModeRef.current = CAMERA_MODES.FREE;
    updateMode(CAMERA_MODES.FREE);
    return true;
  }, [updateMode]);

  const recenter = useCallback(() => {
    if (!frame?.displayPosition) return null;
    resumeModeRef.current = CAMERA_MODES.FOLLOWING;
    updateMode(gpsConfiable ? CAMERA_MODES.RECENTERING : CAMERA_MODES.GPS_DEGRADED);
    return buildCameraTarget(frame, {
      profile: perfil,
      previousBearing: previousBearingRef.current,
      previousTimestamp: previousTimestampRef.current,
      limits,
    });
  }, [frame, gpsConfiable, limits, perfil, updateMode]);

  const finishRecentering = useCallback(() => {
    updateMode(gpsConfiable ? CAMERA_MODES.FOLLOWING : CAMERA_MODES.GPS_DEGRADED);
  }, [gpsConfiable, updateMode]);

  const setMode = useCallback((nextMode) => {
    if (!Object.values(CAMERA_MODES).includes(nextMode)) return false;
    return updateMode(nextMode);
  }, [updateMode]);

  return {
    cameraMode,
    mode: cameraMode,
    cameraTarget,
    handleGesture,
    onGesture: handleGesture,
    recenter,
    recentrar: recenter,
    finishRecentering,
    setCameraMode: setMode,
    siguiendo: cameraMode === CAMERA_MODES.FOLLOWING || cameraMode === CAMERA_MODES.RECENTERING,
    cameraPaused: cameraMode === CAMERA_MODES.FREE,
  };
}

export { CAMERA_MODES, DEFAULT_CAMERA_LIMITS };
export const useCamaraNavegacion = useNavigationCamera;
export const calcularObjetivoCamara = buildCameraTarget;
