import { useCallback, useEffect, useRef, useState } from 'react';

export const WAKE_LOCK_MESSAGE =
  'No se puede mantener la pantalla activa. La navegación continúa; mantén el dispositivo despierto si lo necesitas.';

export const WAKE_LOCK_ESTADOS = Object.freeze({
  INACTIVO: 'inactivo',
  SOLICITANDO: 'solicitando',
  ACTIVO: 'activo',
  NO_SOPORTADO: 'no_soportado',
  DENEGADO: 'denegado',
  LIBERADO: 'liberado',
  ERROR: 'error',
});

const ESTADOS_CON_AVISO = new Set([
  WAKE_LOCK_ESTADOS.NO_SOPORTADO,
  WAKE_LOCK_ESTADOS.DENEGADO,
  WAKE_LOCK_ESTADOS.LIBERADO,
  WAKE_LOCK_ESTADOS.ERROR,
]);

function obtenerWakeLock() {
  if (typeof navigator === 'undefined') return null;
  try {
    const wakeLock = navigator.wakeLock;
    return wakeLock && typeof wakeLock.request === 'function' ? wakeLock : null;
  } catch {
    return null;
  }
}

function documentoVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function liberarSincronicamenteSeguro(sentinel) {
  if (!sentinel || typeof sentinel.release !== 'function') return;
  try {
    const resultado = sentinel.release();
    if (resultado && typeof resultado.catch === 'function') resultado.catch(() => {});
  } catch {
    // Wake Lock es una capacidad opcional: liberar no debe romper navegación.
  }
}

/**
 * Mantiene un único Screen Wake Lock durante una operación activa.
 *
 * La generación invalida respuestas tardías de request() cuando la navegación
 * ya terminó. Así un cambio de visibilidad o un desmontaje no puede dejar un
 * sentinel vivo fuera del ciclo que lo solicitó.
 */
export function useWakeLock(solicitado) {
  const sentinelRef = useRef(null);
  const solicitudEnCursoRef = useRef(false);
  const generacionRef = useRef(0);
  const limpiarReleaseRef = useRef(null);
  const solicitadoRef = useRef(solicitado);
  const [estado, setEstado] = useState(WAKE_LOCK_ESTADOS.INACTIVO);

  const limpiarListenerRelease = useCallback(() => {
    const limpiar = limpiarReleaseRef.current;
    limpiarReleaseRef.current = null;
    try {
      limpiar?.();
    } catch {
      // Un sentinel defectuoso no debe impedir liberar el resto del ciclo.
    }
  }, []);

  const liberarSentinelActual = useCallback(() => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    limpiarListenerRelease();
    liberarSincronicamenteSeguro(sentinel);
  }, [limpiarListenerRelease]);

  const solicitar = useCallback(() => {
    if (!solicitadoRef.current || !documentoVisible()) return;

    const wakeLock = obtenerWakeLock();
    if (!wakeLock) {
      setEstado(WAKE_LOCK_ESTADOS.NO_SOPORTADO);
      return;
    }

    // Evita sentinels duplicados si llegan varios eventos de visibilidad.
    if (sentinelRef.current || solicitudEnCursoRef.current) return;

    const generacion = ++generacionRef.current;
    solicitudEnCursoRef.current = true;
    setEstado(WAKE_LOCK_ESTADOS.SOLICITANDO);

    let promesa;
    try {
      promesa = wakeLock.request('screen');
    } catch {
      solicitudEnCursoRef.current = false;
      if (generacion === generacionRef.current && solicitadoRef.current) {
        setEstado(WAKE_LOCK_ESTADOS.ERROR);
      }
      return;
    }

    Promise.resolve(promesa).then((sentinel) => {
      solicitudEnCursoRef.current = false;

      const solicitudValida =
        generacion === generacionRef.current &&
        solicitadoRef.current &&
        documentoVisible();

      if (!solicitudValida) {
        liberarSincronicamenteSeguro(sentinel);
        return;
      }

      if (!sentinel || typeof sentinel.release !== 'function') {
        setEstado(WAKE_LOCK_ESTADOS.ERROR);
        return;
      }

      if (sentinel.released) {
        setEstado(WAKE_LOCK_ESTADOS.LIBERADO);
        return;
      }

      sentinelRef.current = sentinel;
      const handleRelease = () => {
        // Un release manual limpia la ref antes de llamar a release(), por lo
        // que este camino solo representa una liberación externa del sistema.
        if (sentinelRef.current !== sentinel) return;
        sentinelRef.current = null;
        limpiarListenerRelease();
        setEstado(WAKE_LOCK_ESTADOS.LIBERADO);
      };

      try {
        if (typeof sentinel.addEventListener === 'function') {
          sentinel.addEventListener('release', handleRelease);
          limpiarReleaseRef.current = () => {
            sentinel.removeEventListener?.('release', handleRelease);
          };
        }
        setEstado(WAKE_LOCK_ESTADOS.ACTIVO);
      } catch {
        sentinelRef.current = null;
        limpiarListenerRelease();
        liberarSincronicamenteSeguro(sentinel);
        setEstado(WAKE_LOCK_ESTADOS.ERROR);
      }
    }).catch(() => {
      solicitudEnCursoRef.current = false;
      if (generacion === generacionRef.current && solicitadoRef.current) {
        setEstado(WAKE_LOCK_ESTADOS.DENEGADO);
      }
    });
  }, [limpiarListenerRelease]);

  useEffect(() => {
    solicitadoRef.current = solicitado;

    if (!solicitado) {
      generacionRef.current += 1;
      solicitudEnCursoRef.current = false;
      liberarSentinelActual();
      return;
    }

    // El efecto sincroniza la suscripción; la solicitud y su setState ocurren
    // en el siguiente microtask para evitar un render en cascada del efecto.
    Promise.resolve().then(() => {
      if (solicitadoRef.current) solicitar();
    });
  }, [solicitado, solicitar, liberarSentinelActual]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && solicitadoRef.current) {
        solicitar();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [solicitar]);

  useEffect(() => () => {
    solicitadoRef.current = false;
    generacionRef.current += 1;
    solicitudEnCursoRef.current = false;
    liberarSentinelActual();
  }, [liberarSentinelActual]);

  const estadoExpuesto = solicitado ? estado : WAKE_LOCK_ESTADOS.INACTIVO;

  return {
    estado: estadoExpuesto,
    activo: estadoExpuesto === WAKE_LOCK_ESTADOS.ACTIVO,
    necesitaAviso: solicitado && ESTADOS_CON_AVISO.has(estadoExpuesto),
    mensaje: WAKE_LOCK_MESSAGE,
  };
}
