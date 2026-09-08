import { describe, expect, it } from 'vitest';
import { mensajeEstadoGps } from './estadoGps';

describe('mensajeEstadoGps', () => {
  it('describes a trusted fix as live tracking capable', () => {
    expect(mensajeEstadoGps({ gpsConfiable: true, calidadGps: 'confiable', ultimaActualizacion: 1000, ahora: 3000 }))
      .toBe('GPS actualizado hace 2 s. La ruta seguirá tu movimiento en tiempo real.');
  });

  it('does not promise live tracking for a stale or unavailable fix', () => {
    expect(mensajeEstadoGps({ gpsConfiable: false, calidadGps: 'sin_senal', ultimaActualizacion: 1000, ahora: 9000 }))
      .toBe('GPS no disponible o fix desactualizado. Activa o recupera el GPS para seguimiento en vivo.');
  });

  it('warns without discarding the last valid position for an imprecise fix', () => {
    expect(mensajeEstadoGps({
      gpsConfiable: true,
      calidadGps: 'degradada',
      ultimaActualizacion: 1000,
      ahora: 3000,
    })).toBe('Señal GPS imprecisa. Conservamos la última posición válida mientras mejora la señal.');
  });

  it('distinguishes a transient signal loss while the last fix is still usable', () => {
    expect(mensajeEstadoGps({
      gpsConfiable: true,
      calidadGps: 'sin_senal',
      ultimaActualizacion: 1000,
      ahora: 3000,
    })).toBe('Señal GPS temporalmente débil. Conservamos la última posición válida mientras se recupera.');
  });
});
