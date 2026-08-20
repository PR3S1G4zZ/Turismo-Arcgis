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

  it('does not jump progress ahead when the route passes close to itself further along', () => {
    // ~1 metro en grados, cerca del ecuador (111 320 m por grado).
    const M = 1 / 111320;
    // Tramo recto de 70 vértices cada ~5 m (350 m), y un último vértice que
    // dobla muy cerca del punto de partida — como una ruta que da la vuelta
    // a la manzana y vuelve a pasar cerca de donde arrancó.
    const puntos = [];
    for (let i = 0; i <= 70; i++) puntos.push([i * 5 * M, 0]);
    puntos.push([0, 33 * M]);

    const ruta = prepararRuta({ puntos, pasos: [] });
    // A 35 m del arranque real (fuera del umbral de 30 m de la ventana local),
    // pero a ~2 m en línea recta del último vértice (índice 70).
    const ubicacion = localizarEnRuta(ruta, [0, 35 * M], 0);

    expect(ubicacion.indice).toBeLessThan(65);
    expect(ubicacion.recorridoM).toBeLessThan(50);
  });
});
