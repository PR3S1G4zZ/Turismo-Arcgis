import { describe, expect, it } from 'vitest';
import {
  distanciaM,
  formatearDistancia,
  formatearDuracion,
  localizarEnRuta,
  prepararRuta,
  rumbo,
} from './geoRuta';

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

  it('formats sub-kilometer distances rounded to the nearest 10 meters', () => {
    expect(formatearDistancia(0)).toBe('0 m');
    expect(formatearDistancia(344)).toBe('340 m');
    expect(formatearDistancia(345)).toBe('350 m');
    expect(formatearDistancia(346)).toBe('350 m');
  });

  it('formats distances of 1 km or more with a comma decimal', () => {
    expect(formatearDistancia(1000)).toBe('1,0 km');
    expect(formatearDistancia(1240)).toBe('1,2 km');
  });

  it('reveals the 1000 m boundary quirk just below the km cutoff', () => {
    // metros < 1000 se redondea a la decena ANTES de decidir el formato, asi
    // que valores 995-999 producen "1000 m" en vez de pasar a "1,0 km".
    expect(formatearDistancia(999)).toBe('1000 m');
  });

  it('falls back to an em dash for non-finite distances', () => {
    expect(formatearDistancia(NaN)).toBe('—');
    expect(formatearDistancia(Infinity)).toBe('—');
  });

  it('formats sub-hour durations in minutes', () => {
    expect(formatearDuracion(8)).toBe('8 min');
    expect(formatearDuracion(0.4)).toBe('1 min');
  });

  it('clamps non-positive durations to 1 minute instead of showing 0 or negative', () => {
    expect(formatearDuracion(-5)).toBe('1 min');
    expect(formatearDuracion(0)).toBe('1 min');
  });

  it('formats hour-plus durations as "h min"', () => {
    expect(formatearDuracion(60)).toBe('1 h 0 min');
    expect(formatearDuracion(125.6)).toBe('2 h 6 min');
  });

  it('falls back to an em dash for non-finite durations', () => {
    expect(formatearDuracion(NaN)).toBe('—');
    expect(formatearDuracion(Infinity)).toBe('—');
  });
});
