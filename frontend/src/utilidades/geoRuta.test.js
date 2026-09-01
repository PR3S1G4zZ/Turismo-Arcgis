import { describe, expect, it } from 'vitest';
import {
  distanciaM,
  formatearDistancia,
  formatearDuracion,
  localizarEnRuta,
  prepararRuta,
  rumbo,
  normalizarRumbo,
  rotacionRelativaViewport,
  seleccionarRumbo,
  suavizarRumbo,
  tangenteRuta,
} from './geoRuta';

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

  describe('rumbo visual', () => {
    it('normalizes headings and keeps the shortest relative rotation', () => {
      expect(normalizarRumbo(-1)).toBe(359);
      expect(normalizarRumbo(721)).toBe(1);
      expect(rotacionRelativaViewport(5, 350)).toBe(15);
      expect(rotacionRelativaViewport(359, 0)).toBe(-1);
      expect(rotacionRelativaViewport(1, 359)).toBe(2);
    });

    it('smooths north-crossing headings over the short arc', () => {
      const haciaNorte = suavizarRumbo(359, 1);
      const desdeNorte = suavizarRumbo(1, 359);
      expect(haciaNorte < 1 || haciaNorte > 359).toBe(true);
      expect(desdeNorte < 1 || desdeNorte > 359).toBe(true);
    });

    it('prioritizes a trusted movement heading over a fresh compass', () => {
      expect(seleccionarRumbo({
        moviendo: true,
        rumboMovimiento: 92,
        gpsConfiable: true,
        rumboBrujula: 10,
        permisoBrujula: 'concedido',
        ultimaLecturaBrujula: 1000,
        ahora: 1001,
      })).toEqual({ rumbo: 92, fuente: 'movimiento' });
    });

    it('uses a fresh authorized compass when the user is stopped', () => {
      expect(seleccionarRumbo({
        moviendo: false,
        rumboMovimiento: 92,
        gpsConfiable: true,
        rumboBrujula: 10,
        permisoBrujula: 'no-requiere',
        ultimaLecturaBrujula: 1000,
        ahora: 1200,
      })).toEqual({ rumbo: 10, fuente: 'brujula' });
    });

    it('rejects an expired compass and uses the route tangent as fallback', () => {
      const ruta = prepararRuta({ puntos: [[0, 0], [0.001, 0]], pasos: [] });

      expect(seleccionarRumbo({
        moviendo: false,
        gpsConfiable: false,
        rumboBrujula: 10,
        permisoBrujula: 'concedido',
        ultimaLecturaBrujula: 1000,
        ahora: 3000,
        rumboRespaldo: tangenteRuta(ruta, 0),
      })).toEqual({ rumbo: 0, fuente: 'tangente-ruta' });
    });

    it('returns no heading when every source is absent or unauthorized', () => {
      expect(seleccionarRumbo({
        moviendo: false,
        gpsConfiable: false,
        rumboBrujula: 10,
        permisoBrujula: 'denegado',
        ultimaLecturaBrujula: 1000,
        ahora: 1001,
      })).toBeNull();
      expect(seleccionarRumbo({
        moviendo: false,
        rumboBrujula: 10,
        ultimaLecturaBrujula: 1000,
        ahora: 1001,
      })).toBeNull();
      expect(tangenteRuta({ puntos: [[0, 0]] }, 0)).toBeNull();
    });
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

  it('reports large deviation when the fix sits on a parallel street about 50 m away', () => {
    const puntos = [[0, 0], [0, 80 * M]];
    const ruta = prepararRuta({ puntos, pasos: [] });
    const ubicacion = localizarEnRuta(ruta, [50 * M, 40 * M], 0);
    expect(ubicacion.desviacionM).toBeGreaterThan(45);
    expect(ubicacion.desviacionM).toBeLessThan(55);
  });
});
