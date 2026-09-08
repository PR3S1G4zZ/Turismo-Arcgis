import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMERA_MODES } from '../utilidades/navigationContracts';

const DEFAULT_INTERPOLATION_MS = 600;

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

/** Normaliza un ángulo al intervalo [0, 360). */
export function normalizeAngle(value) {
  if (!Number.isFinite(value)) return null;
  return ((value % 360) + 360) % 360;
}

/** Diferencia firmada por el arco más corto desde `from` hasta `to`. */
export function circularDifference(from, to) {
  const inicio = normalizeAngle(from);
  const fin = normalizeAngle(to);
  if (inicio == null || fin == null) return null;
  const diferencia = fin - inicio;
  if (diferencia > 180) return diferencia - 360;
  if (diferencia < -180) return diferencia + 360;
  return diferencia;
}

/** Interpola un ángulo sin atravesar el arco largo al cruzar 0/360. */
export function interpolateCircularAngle(from, to, factor = 0.5) {
  const inicio = normalizeAngle(from);
  const diferencia = circularDifference(from, to);
  if (inicio == null || diferencia == null || !Number.isFinite(factor)) return null;
  return normalizeAngle(inicio + diferencia * clamp(factor));
}

const clonePosition = (value) => {
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const cloneFrame = (value) => ({
  displayPosition: clonePosition(value?.displayPosition),
  arrowBearing: normalizeAngle(value?.arrowBearing),
  cameraBearing: normalizeAngle(value?.cameraBearing),
  speedEstimateMps: Number.isFinite(value?.speedEstimateMps) ? value.speedEstimateMps : null,
  cameraMode: Object.values(CAMERA_MODES).includes(value?.cameraMode)
    ? value.cameraMode
    : CAMERA_MODES.OVERVIEW,
  timestamp: Number.isFinite(value?.timestamp) ? value.timestamp : 0,
});

function interpolatePosition(from, to, factor) {
  if (!from && !to) return null;
  if (!from) return factor >= 1 ? clonePosition(to) : null;
  if (!to) return factor >= 1 ? null : clonePosition(from);
  return {
    lat: from.lat + (to.lat - from.lat) * factor,
    lng: from.lng + (to.lng - from.lng) * factor,
  };
}

function interpolateNullableAngle(from, to, factor) {
  if (from == null && to == null) return null;
  if (from == null) return factor >= 1 ? normalizeAngle(to) : null;
  if (to == null) return factor >= 1 ? null : normalizeAngle(from);
  return interpolateCircularAngle(from, to, factor);
}

function interpolateNullableNumber(from, to, factor) {
  const inicio = Number.isFinite(from) ? from : null;
  const fin = Number.isFinite(to) ? to : null;
  if (inicio == null && fin == null) return null;
  if (inicio == null) return factor >= 1 ? fin : null;
  if (fin == null) return factor >= 1 ? null : inicio;
  return inicio + (fin - inicio) * factor;
}

/**
 * Construye el frame que comparten el marcador y la cámara a partir de una
 * pose. `targetPosition` ya representa la decisión conservadora del motor de
 * pose; no se vuelve a leer la coordenada GPS cruda aquí.
 */
export function frameFromPose(pose, cameraMode = CAMERA_MODES.OVERVIEW) {
  const source = pose?.displayPosition
    ?? pose?.targetPosition
    ?? pose?.matchedPosition
    ?? pose?.rawPosition
    ?? pose?.position;
  return cloneFrame({
    displayPosition: source,
    arrowBearing: pose?.arrowBearing,
    cameraBearing: pose?.cameraBearing ?? pose?.arrowBearing,
    speedEstimateMps: pose?.speedEstimateMps,
    cameraMode,
    timestamp: pose?.timestamp,
  });
}

/** Interpolación acotada de un frame; nunca extrapola más allá del destino. */
export function interpolateNavigationFrame(from, to, factor = 1) {
  const inicio = cloneFrame(from);
  const destino = cloneFrame(to);
  const progreso = clamp(Number.isFinite(factor) ? factor : 0);
  return {
    displayPosition: interpolatePosition(inicio.displayPosition, destino.displayPosition, progreso),
    arrowBearing: interpolateNullableAngle(inicio.arrowBearing, destino.arrowBearing, progreso),
    cameraBearing: interpolateNullableAngle(inicio.cameraBearing, destino.cameraBearing, progreso),
    speedEstimateMps: interpolateNullableNumber(
      inicio.speedEstimateMps,
      destino.speedEstimateMps,
      progreso,
    ),
    cameraMode: destino.cameraMode,
    timestamp: inicio.timestamp + (destino.timestamp - inicio.timestamp) * progreso,
  };
}

const defaultRequestAnimationFrame = (callback) => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(
    typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now(),
  ), 16);
};

const defaultCancelAnimationFrame = (id) => {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(id);
    return;
  }
  globalThis.clearTimeout(id);
};

const defaultNow = () => {
  if (typeof globalThis.performance?.now === 'function') return globalThis.performance.now();
  return Date.now();
};

/**
 * Scheduler único para la animación de frame. `schedule` reemplaza el destino
 * pendiente, pero conserva un único callback RAF activo y un origen acotado al
 * último frame publicado.
 */
export function createNavigationFrameScheduler(options = {}) {
  const normalizedOptions = typeof options === 'function' ? { onFrame: options } : options;
  const requestAnimationFrame = normalizedOptions.requestAnimationFrame || defaultRequestAnimationFrame;
  const cancelAnimationFrame = normalizedOptions.cancelAnimationFrame || defaultCancelAnimationFrame;
  const onFrame = typeof normalizedOptions.onFrame === 'function' ? normalizedOptions.onFrame : () => {};
  const now = typeof normalizedOptions.now === 'function' ? normalizedOptions.now : defaultNow;
  const durationMs = Number.isFinite(normalizedOptions.durationMs)
    ? Math.max(0, normalizedOptions.durationMs)
    : DEFAULT_INTERPOLATION_MS;

  let current = null;
  let origin = null;
  let target = null;
  let startedAt = null;
  let pendingId = null;
  let disposed = false;

  const tick = (rafTimestamp) => {
    pendingId = null;
    if (disposed || !target) return;

    const timestamp = Number.isFinite(rafTimestamp) ? rafTimestamp : now();
    const elapsed = Math.max(0, timestamp - (startedAt ?? timestamp));
    const progress = durationMs === 0 ? 1 : clamp(elapsed / durationMs);
    current = interpolateNavigationFrame(origin || target, target, progress);
    onFrame(current);

    if (progress < 1 && !disposed) {
      pendingId = requestAnimationFrame(tick);
    } else {
      current = cloneFrame(target);
      origin = current;
      target = null;
      startedAt = null;
    }
  };

  const schedule = (nextFrame, scheduleOptions = {}) => {
    if (disposed || !nextFrame) return false;
    const siguiente = cloneFrame(nextFrame);
    const from = scheduleOptions.from ? cloneFrame(scheduleOptions.from) : current;
    origin = from || current || siguiente;
    current = current || origin;
    target = siguiente;
    startedAt = Number.isFinite(scheduleOptions.startedAt) ? scheduleOptions.startedAt : now();
    if (pendingId == null) pendingId = requestAnimationFrame(tick);
    return true;
  };

  const cancel = () => {
    if (pendingId != null) cancelAnimationFrame(pendingId);
    pendingId = null;
    target = null;
    startedAt = null;
    origin = current;
  };

  const dispose = () => {
    cancel();
    disposed = true;
  };

  return {
    schedule,
    cancel,
    dispose,
    getCurrentFrame: () => current,
    getTargetFrame: () => target,
    getPendingId: () => pendingId,
    isScheduled: () => pendingId != null,
  };
}

/**
 * Hook que publica el único frame visual para marcador y cámara. La cámara
 * recibe este resultado y nunca crea otro interpolador paralelo.
 */
export function useNavigationFrame({
  pose = null,
  frame = null,
  cameraMode = CAMERA_MODES.OVERVIEW,
  interpolationMs = DEFAULT_INTERPOLATION_MS,
  enabled = true,
} = {}) {
  const targetFrame = useMemo(
    () => (frame ? cloneFrame(frame) : frameFromPose(pose, cameraMode)),
    [frame, pose, cameraMode],
  );
  const [displayedFrame, setDisplayedFrame] = useState(() => targetFrame);
  const currentFrameRef = useRef(displayedFrame);
  const schedulerRef = useRef(null);

  useEffect(() => {
    const scheduler = createNavigationFrameScheduler({
      durationMs: interpolationMs,
      onFrame: (nextFrame) => {
        currentFrameRef.current = nextFrame;
        setDisplayedFrame(nextFrame);
      },
    });
    schedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, [interpolationMs]);

  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;
    if (!enabled) {
      scheduler.cancel();
      currentFrameRef.current = targetFrame;
      return;
    }
    scheduler.schedule(targetFrame, { from: currentFrameRef.current });
  }, [enabled, interpolationMs, targetFrame]);

  return enabled ? displayedFrame : targetFrame;
}

export const interpolarAnguloCircular = interpolateCircularAngle;
export const interpolarNavigationFrame = interpolateNavigationFrame;
export const crearSchedulerFrame = createNavigationFrameScheduler;
export const useFrameNavegacion = useNavigationFrame;
