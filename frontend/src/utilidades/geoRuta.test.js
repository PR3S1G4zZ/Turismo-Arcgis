import { describe, expect, it } from 'vitest';
import { distanciaM, localizarEnRuta, prepararRuta, rumbo, suavizarRumbo } from './geoRuta';

/** ~1 m en grados, cerca del ecuador (111 320 m por grado). Solo geometría sintética. */
const M = 1 / 111320;

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
    expect(rumbo([0, 0], [-0.001, 0])).toBeCloseTo(180, 0);
  });

  it('does not jump progress ahead when the route passes close to itself further along', () => {
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

  it('keeps every vertex when preparing a polyline (no silent simplification)', () => {
    const puntos = [[0, 0], [10 * M, 0], [10 * M, 10 * M], [0, 10 * M], [0, 20 * M]];
    const ruta = prepararRuta({ puntos, pasos: [] });
    expect(ruta.puntos).toHaveLength(5);
    expect(ruta.puntos).toEqual(puntos);
    expect(ruta.largoTotalM).toBeGreaterThan(39);
  });

  it('stays on the near arc of a synthetic roundabout instead of jumping across the diameter', () => {
    const puntos = [];
    const n = 36;
    const r = 40 * M;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * Math.PI;
      puntos.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const ruta = prepararRuta({ puntos, pasos: [] });
    const angulo = 0.3;
    const pos = [r * Math.cos(angulo), r * Math.sin(angulo)];
    const ubicacion = localizarEnRuta(ruta, pos, 0);

    expect(ubicacion.desviacionM).toBeLessThan(3);
    expect(ubicacion.indice).toBeLessThan(8);
    expect(ubicacion.recorridoM).toBeLessThan(ruta.largoTotalM / 4);
  });

  it('reports large deviation when the fix sits on a parallel street ~50 m away', () => {
    const puntos = [[0, 0], [0, 80 * M]];
    const ruta = prepararRuta({ puntos, pasos: [] });
    const ubicacion = localizarEnRuta(ruta, [50 * M, 40 * M], 0);
    expect(ubicacion.desviacionM).toBeGreaterThan(45);
    expect(ubicacion.desviacionM).toBeLessThan(55);
  });
});

describe('suavizarRumbo (mezcla circular)', () => {
  it('returns the new heading when there is no previous value', () => {
    expect(suavizarRumbo(null, 90)).toBe(90);
  });

  it('crosses north (359°→1°) without flipping toward 180°', () => {
    const mezclado = suavizarRumbo(359, 1, 0.5);
    const alrededorDeCero = mezclado > 180 ? mezclado - 360 : mezclado;
    expect(alrededorDeCero).toBeCloseTo(0, 0);
    expect(mezclado).not.toBeGreaterThan(20);
    expect(mezclado < 20 || mezclado > 340).toBe(true);
  });

  it('weights the new reading by factor without leaving the shorter arc', () => {
    const mezclado = suavizarRumbo(10, 30, 0.5);
    expect(mezclado).toBeGreaterThan(15);
    expect(mezclado).toBeLessThan(25);
  });
});

describe('Pendiente de fases futuras (placeholders — 07-CONTEXT D-01)', () => {
  it.todo('histéresis de desvío multi-señal (precisión, velocidad, dirección) vive en RECALC-01, no en geoRuta hoy');
  it.todo('comparación de las 5 etapas del pipeline geométrico real (GEOM-01) cuando exista captura de rotonda de Itagüí sin coordenadas personales en artefactos');
});

