export function mensajeEstadoGps({ gpsConfiable, calidadGps, ultimaActualizacion, ahora }) {
  if (calidadGps === 'degradada') {
    return 'Señal GPS imprecisa. Conservamos la última posición válida mientras mejora la señal.';
  }
  if (calidadGps === 'sin_senal' && ultimaActualizacion != null && gpsConfiable) {
    return 'Señal GPS temporalmente débil. Conservamos la última posición válida mientras se recupera.';
  }
  if (!gpsConfiable || ultimaActualizacion == null) {
    return 'GPS no disponible o fix desactualizado. Activa o recupera el GPS para seguimiento en vivo.';
  }

  const segundos = Math.max(0, Math.floor(((ahora || ultimaActualizacion) - ultimaActualizacion) / 1000));
  return `GPS actualizado hace ${segundos} s. La ruta seguirá tu movimiento en tiempo real.`;
}
