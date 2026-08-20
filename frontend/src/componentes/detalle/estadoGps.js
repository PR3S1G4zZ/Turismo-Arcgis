export function mensajeEstadoGps({ gpsConfiable, ultimaActualizacion, ahora }) {
  if (!gpsConfiable || ultimaActualizacion == null) {
    return 'GPS no disponible o fix desactualizado. Activa o recupera el GPS para seguimiento en vivo.';
  }

  const segundos = Math.max(0, Math.floor(((ahora || ultimaActualizacion) - ultimaActualizacion) / 1000));
  return `GPS actualizado hace ${segundos} s. La ruta seguirá tu movimiento en tiempo real.`;
}
