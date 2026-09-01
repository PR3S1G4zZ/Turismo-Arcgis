// src/hooks/useOrientacion.js
// Rumbo de la BRÚJULA del dispositivo (hacia dónde apunta el teléfono), para que
// la flecha gire aunque el usuario esté parado —como el cono de Google Maps—.
// Es distinto del rumbo del GPS (hacia dónde te MUEVES), que ya calcula
// useGeolocation. Aquí solo interesa la orientación física.
//
// iOS 13+ exige pedir permiso con un gesto del usuario (un toque): por eso se
// expone `activar()`. En Android/escritorio no hace falta permiso y arranca solo.
import { useState, useEffect, useRef, useCallback } from 'react';
import { suavizarRumbo } from '../utilidades/geoRuta';
import { marcar, MARCAS } from '../utilidades/diagnosticoLatencias';

// ¿La plataforma exige pedir permiso explícito (iOS 13+)?
const requierePermiso =
  typeof DeviceOrientationEvent !== 'undefined' &&
  typeof DeviceOrientationEvent.requestPermission === 'function';

/** Extrae el rumbo de brújula (0–360, horario desde el norte) de un evento. */
function leerRumbo(e) {
  // iOS: `webkitCompassHeading` ya es el rumbo de brújula, listo para usar.
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return e.webkitCompassHeading;
  }
  // Android/otros: `alpha` absoluto. Se convierte a rumbo y se compensa la
  // rotación de la pantalla (para que valga en horizontal, no solo vertical).
  if (e.absolute === true && typeof e.alpha === 'number') {
    const anguloPantalla =
      (typeof screen !== 'undefined' && screen.orientation && screen.orientation.angle) || 0;
    return (360 - e.alpha + anguloPantalla) % 360;
  }
  return null;
}

export function useOrientacion() {
  const [heading, setHeading] = useState(null);
  const [permiso, setPermiso] = useState(requierePermiso ? 'pendiente' : 'no-requiere');
  const suavRef = useRef(null);
  const ultimoEmitRef = useRef(0);

  // Se recrea nunca (deps vacías): sirve de referencia estable para add/remove.
  const manejar = useCallback((e) => {
    const crudo = leerRumbo(e);
    if (crudo == null) return;
    suavRef.current = suavizarRumbo(suavRef.current, crudo);
    // La brújula dispara a decenas de Hz; se limita a ~10 Hz para no re-renderizar
    // el mapa en exceso. (Date.now en el navegador es válido.)
    const ahora = Date.now();
    if (ahora - ultimoEmitRef.current < 100) return;
    ultimoEmitRef.current = ahora;
    // Marca del tramo 2 (orientacion->flecha) del diagnóstico de latencias
    // (Fase 1, DIAG-01): solo cambios de rumbo aceptados (post-throttle,
    // post-validación de leerRumbo) la disparan. El extremo final se
    // empareja en InteractiveMap.jsx (Plan 01-04).
    marcar(MARCAS.ORIENTACION_CAMBIO);
    setHeading(Math.round(suavRef.current));
  }, []);

  const escuchar = useCallback(() => {
    window.addEventListener('deviceorientationabsolute', manejar, true);
    window.addEventListener('deviceorientation', manejar, true);
  }, [manejar]);

  // Pedir permiso (iOS) o simplemente empezar. Debe llamarse desde un gesto en iOS.
  const activar = useCallback(async () => {
    if (requierePermiso) {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        setPermiso(res === 'granted' ? 'concedido' : 'denegado');
        if (res === 'granted') escuchar();
      } catch {
        setPermiso('denegado');
      }
    } else {
      escuchar();
    }
  }, [escuchar]);

  useEffect(() => {
    // En plataformas sin permiso se arranca solo (sin setState en el efecto).
    if (!requierePermiso) escuchar();
    return () => {
      window.removeEventListener('deviceorientationabsolute', manejar, true);
      window.removeEventListener('deviceorientation', manejar, true);
    };
  }, [escuchar, manejar]);

  return {
    heading, // rumbo de brújula en grados (0–360) o null si aún no se conoce
    // En iOS, true mientras no se haya concedido el permiso (para mostrar el botón).
    necesitaPermiso: requierePermiso && permiso !== 'concedido',
    permiso,
    activar,
  };
}
