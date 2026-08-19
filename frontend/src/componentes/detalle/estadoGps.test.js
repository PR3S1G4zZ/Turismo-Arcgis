import { describe, expect, it } from 'vitest';
import { mensajeEstadoGps } from './estadoGps';

describe('mensajeEstadoGps', () => {
  it('describes a trusted fix as live tracking capable', () => {
    expect(mensajeEstadoGps({ gpsConfiable: true, ultimaActualizacion: 1000, ahora: 3000 }))
      .toBe('GPS actualizado hace 2 s. La ruta seguirá tu movimiento en tiempo real.');
  });

  it('does not promise live tracking for a stale or unavailable fix', () => {
    expect(mensajeEstadoGps({ gpsConfiable: false, ultimaActualizacion: 1000, ahora: 9000 }))
      .toBe('GPS no disponible o fix desactualizado. Activa o recupera el GPS para seguimiento en vivo.');
  });
});
