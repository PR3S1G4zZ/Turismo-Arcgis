// src/hooks/useGeolocation.js
import { useState, useEffect } from 'react';

// Coordenadas del Parque Principal de Itagüí como último recurso (solo si el
// usuario deniega el permiso o el GPS no está disponible).
const FALLBACK_LAT = 6.1724;
const FALLBACK_LNG = -75.6091;

const geolocationSupported =
  typeof navigator !== 'undefined' && 'geolocation' in navigator;

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

  useEffect(() => {
    if (!geolocationSupported) return;

    const handleSuccess = (pos) => {
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
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
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { position, error, loading, isSimulated };
};
