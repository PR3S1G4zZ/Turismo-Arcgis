// src/hooks/useGeolocation.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { distanciaM, rumbo, suavizarRumbo } from '../utilidades/geoRuta';

// Coordenadas del Parque Principal de Itagüí como último recurso (solo si el
// usuario deniega el permiso o el GPS no está disponible).
const FALLBACK_LAT = 6.1724;
const FALLBACK_LNG = -75.6091;

// Umbrales para deducir el rumbo. El GPS solo da `coords.heading` fiable cuando
// hay velocidad; a pie casi siempre viene null, así que se calcula entre
// lecturas separadas por al menos unos metros (menos que eso es ruido del GPS).
const VELOCIDAD_MIN_MS = 0.5;
const DESPLAZAMIENTO_MIN_M = 5;

const geolocationSupported =
  typeof navigator !== 'undefined' && 'geolocation' in navigator;

/**
 * Filtra el ruido de una lectura GPS puntual sin atrasar el seguimiento: el
 * peso de la lectura nueva depende de qué tan precisa dice el dispositivo que
 * es (`accuracy`, en metros). Una fijación buena (poca `accuracy`) casi no se
 * suaviza; una mala se acerca más a donde ya estábamos, en vez de mover de
 * golpe la ruta/el tiempo restante por un salto de la triangulación.
 */
function suavizarPosicion(anterior, nueva, accuracy) {
  if (!anterior) return nueva;
  const peso = Math.max(0.25, Math.min(0.9, 1 - (accuracy || 0) / 40));
  return {
    lat: anterior.lat + (nueva.lat - anterior.lat) * peso,
    lng: anterior.lng + (nueva.lng - anterior.lng) * peso,
  };
}

/**
 * Ubicación REAL del usuario, en vivo. Usa watchPosition para seguir la posición
 * del dispositivo mientras se mueve. `isSimulated` es true solo cuando se cae al
 * centro de Itagüí porque no hay permiso o señal (para poder avisarlo en la UI).
 *
 * Nota: la geolocalización del navegador exige contexto seguro (HTTPS) o
 * localhost. En el servidor de la Alcaldía debe servirse por HTTPS.
 */
export const useGeolocation = () => {
  const [position, setPosition] = useState(
    geolocationSupported ? null : { lat: FALLBACK_LAT, lng: FALLBACK_LNG }
  );
  const [error, setError] = useState(
    geolocationSupported ? null : 'Geolocalización no soportada en este navegador.'
  );
  const [loading, setLoading] = useState(geolocationSupported);
  const [isSimulated, setIsSimulated] = useState(!geolocationSupported);
  const watchIdRef = useRef(null);
  // Última coordenada cruda y último rumbo suavizado, para deducir la dirección
  // de marcha entre lecturas sin re-suscribir el watch en cada render.
  const ultimaCoordRef = useRef(null);
  const rumboRef = useRef(null);
  // Última posición ya suavizada (la que se expone), separada de la cruda:
  // el rumbo se deduce del desplazamiento REAL, no del filtrado.
  const posicionSuavizadaRef = useRef(null);

  // Extraído para poder volver a pedirlo con un toque explícito del usuario
  // (`reintentar`): algunos navegadores móviles no muestran el diálogo nativo
  // de permiso si la primera petición ocurre sola al cargar la página, sin
  // ningún gesto del usuario de por medio.
  const iniciarSeguimiento = useCallback(() => {
    if (!geolocationSupported) return;
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);

    setLoading(true);
    setError(null);
    posicionSuavizadaRef.current = null;

    const handleSuccess = (pos) => {
      const { latitude, longitude, accuracy, heading: rumboGps, speed } = pos.coords;

      // Rumbo, en orden de preferencia: 1) el del GPS si hay movimiento real,
      // 2) el deducido entre la lectura anterior y esta, 3) el último conocido.
      // Se calcula sobre las coordenadas CRUDAS: suavizarlas antes aplanaría
      // el desplazamiento real y dañaría la dirección deducida.
      let rumboCrudo = null;
      if (Number.isFinite(rumboGps) && (speed == null || speed > VELOCIDAD_MIN_MS)) {
        rumboCrudo = rumboGps;
      } else if (ultimaCoordRef.current) {
        const previa = ultimaCoordRef.current;
        if (distanciaM([previa.lat, previa.lng], [latitude, longitude]) >= DESPLAZAMIENTO_MIN_M) {
          rumboCrudo = rumbo([previa.lat, previa.lng], [latitude, longitude]);
        }
      }
      if (rumboCrudo != null) {
        rumboRef.current = suavizarRumbo(rumboRef.current, rumboCrudo);
      }
      ultimaCoordRef.current = { lat: latitude, lng: longitude };

      // La posición que se expone sí se suaviza: es la que alimenta el avance
      // sobre la ruta y el tiempo restante, y es ahí donde el ruido del GPS se
      // veía como saltos repentinos.
      const suavizada = suavizarPosicion(posicionSuavizadaRef.current, { lat: latitude, lng: longitude }, accuracy);
      posicionSuavizadaRef.current = suavizada;

      setPosition({
        lat: suavizada.lat,
        lng: suavizada.lng,
        accuracy,
        // Dirección de marcha en grados (0–360) o null mientras no se conozca.
        heading: rumboRef.current,
        speed: Number.isFinite(speed) ? speed : null,
      });
      setError(null);
      setIsSimulated(false);
      setLoading(false);
    };

    const handleError = (err) => {
      console.warn(`Error de geolocalización (${err.code}): ${err.message}.`);
      setError(err.message);
      // Último recurso: Itagüí Centro, marcado como simulado.
      setPosition({ lat: FALLBACK_LAT, lng: FALLBACK_LNG });
      setIsSimulated(true);
      setLoading(false);
    };

    // Seguimiento en vivo de la ubicación real del dispositivo.
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  }, []);

  useEffect(() => {
    iniciarSeguimiento();
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [iniciarSeguimiento]);

  // Nota: si el navegador ya bloqueó el permiso ("denied", no "prompt"),
  // reintentar() no puede volver a mostrar el diálogo — eso solo lo deshace
  // el usuario desde los ajustes de sitio de su navegador. Si el estado es
  // "prompt" (nunca se decidió, o se reseteó), sí vuelve a preguntar.
  return { position, error, loading, isSimulated, reintentar: iniciarSeguimiento };
};
