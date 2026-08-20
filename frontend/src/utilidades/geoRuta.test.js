import { describe, expect, it } from 'vitest';
import { distanciaM, localizarEnRuta, prepararRuta, rumbo } from './geoRuta';

describe('geoRuta', () => {
  it('projects a position onto the correct route segment', () => {
    const ruta = prepararRuta({ puntos: [[0, 0], [0.001, 0]], pasos: [] });
    const ubicacion = localizarEnRuta(ruta, [0.0005, 0]);

    expect(ubicacion.desviacionM).toBeLessThan(0.5);
    expect(ubicacion.restanteM).toBeCloseTo(distanciaM([0.0005, 0], [0.001, 0]), 0);
  });

  it('keeps bearings in the north-clockwise convention', () => {
    expect(rumbo([0, 0], [0.001, 0])).toBeCloseTo(0, 0);
    expect(rumbo([0, 0], [0, 0.001])).toBeCloseTo(90, 0);
  });
});
