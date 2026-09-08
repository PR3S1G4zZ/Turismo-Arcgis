import { describe, expect, it } from 'vitest';
import { POSITION_SOURCES } from './navigationContracts';
import { prepararRuta } from './geoRuta';
import {
  calcularCorredorM,
  createRouteMatcher,
  localizarPosicion,
  matchRoutePosition,
  prepararRouteMatcher,
} from './routeMatching';

const M = 1 / 111320;

describe('routeMatching', () => {
  it('calcula corredores distintos y limitados para automóvil y caminata', () => {
    expect(calcularCorredorM({ profile: 'car', accuracyM: 20 })).toBe(30);
    expect(calcularCorredorM({ profile: 'walk', accuracyM: 20 })).toBe(25);
    expect(calcularCorredorM({ profile: 'car', accuracyM: 100 })).toBe(45);
    expect(calcularCorredorM({ profile: 'walk', accuracyM: 100 })).toBe(30);
  });

  it('aplica el corredor de automóvil y caminata al mismo punto paralelo', () => {
    const ruta = prepararRuta({ puntos: [[0, 0], [0, 100 * M]], pasos: [] });
    const posicion = { lat: 28 * M, lng: 50 * M, accuracy: 20, timestamp: 1000 };

    const enAuto = localizarPosicion(
      prepararRouteMatcher(ruta, 'car'),
      posicion,
      { lastIndex: 0, lastProgressM: 0 },
    );
    const aPie = localizarPosicion(
      prepararRouteMatcher(ruta, 'walk'),
      posicion,
      { lastIndex: 0, lastProgressM: 0 },
    );

    expect(enAuto.source).toBe(POSITION_SOURCES.MATCHED);
    expect(enAuto.segmentIndex).toBe(0);
    expect(enAuto.confidence).toBe('high');
    expect(enAuto).toMatchObject({
      rawPosition: { lat: 28 * M, lng: 50 * M },
      matchedPosition: { lat: expect.any(Number), lng: expect.any(Number) },
      progressM: expect.any(Number),
      remainingM: expect.any(Number),
      deviationM: expect.any(Number),
      isOffRoute: false,
    });
    expect(aPie.source).toBe(POSITION_SOURCES.RAW);
    expect(aPie.matchedPosition).toBeNull();
    expect(aPie.isOffRoute).toBe(true);
  });

  it('conserva raw y publica matched al estar dentro del corredor', () => {
    const ruta = prepararRuta({ puntos: [[0, 0], [0, 100 * M]], pasos: [] });
    const rawPosition = { lat: 8 * M, lng: 50 * M, accuracy: 5, timestamp: 1000 };

    const resultado = matchRoutePosition(ruta, rawPosition, { profile: 'walk' });

    expect(resultado.positionSource).toBe(POSITION_SOURCES.MATCHED);
    expect(resultado.rawPosition).toEqual({ lat: 8 * M, lng: 50 * M });
    expect(resultado.matchedPosition.lat).toBeCloseTo(0, 8);
    expect(resultado.matchedPosition.lng).toBeCloseTo(50 * M, 8);
    expect(resultado.isOffRoute).toBe(false);
    expect(resultado.distanceToRouteM).toBeGreaterThan(7);
    expect(resultado.distanceToRouteM).toBeLessThan(9);
  });

  it('mantiene raw y no oculta el desvío fuera del corredor', () => {
    const ruta = prepararRuta({ puntos: [[0, 0], [0, 100 * M]], pasos: [] });
    const rawPosition = { lat: 40 * M, lng: 50 * M, accuracy: 5, timestamp: 1000 };

    const resultado = matchRoutePosition(ruta, rawPosition, { profile: 'walk' });

    expect(resultado.positionSource).toBe(POSITION_SOURCES.RAW);
    expect(resultado.rawPosition).toEqual({ lat: 40 * M, lng: 50 * M });
    expect(resultado.matchedPosition).toBeNull();
    expect(resultado.isOffRoute).toBe(true);
    expect(resultado.distanceToRouteM).toBeGreaterThan(resultado.corridorM);
    expect(resultado.deviationM).toBe(resultado.distanceToRouteM);
    expect(resultado.progressM).toBeNull();
    expect(resultado.remainingM).toBeNull();
  });

  it('prefiere el tramo plausible desde el índice anterior en un cruce cercano', () => {
    const puntos = [];
    for (let i = 0; i <= 70; i++) puntos.push([i * 5 * M, 0]);
    puntos.push([0, 33 * M]);
    const ruta = prepararRuta({ puntos, pasos: [] });

    const resultado = matchRoutePosition(
      ruta,
      { lat: 0, lng: 35 * M, accuracy: 5, timestamp: 1000 },
      { profile: 'walk', previousIndex: 0, previousProgressM: 0 },
    );

    expect(resultado.routeSegmentIndex).toBeLessThan(65);
    expect(resultado.progressM).toBeLessThan(50);
    expect(resultado.progressPlausible).toBe(true);
  });

  it('no acepta un salto de progreso imposible aunque la proyección futura sea cercana', () => {
    const puntos = [];
    for (let i = 0; i <= 80; i++) puntos.push([i * 5 * M, 0]);
    const ruta = prepararRuta({ puntos, pasos: [] });

    const resultado = matchRoutePosition(
      ruta,
      { lat: 0.0036, lng: 0, accuracy: 5, speed: 1, timestamp: 2000 },
      {
        profile: 'walk',
        previousIndex: 10,
        previousProgressM: 50,
        previousTimestamp: 1000,
      },
    );

    expect(resultado.candidateProgressM).toBeGreaterThan(35);
    expect(resultado.progressPlausible).toBe(false);
    expect(resultado.progressM).toBe(50);
    expect(resultado.positionSource).toBe(POSITION_SOURCES.RAW);
    expect(resultado.matchedPosition).toBeNull();
    expect(resultado.projection).toBeNull();
    expect(resultado.routeSegmentIndex).toBe(10);
  });

  it('no memoriza como progreso una lectura raw fuera del corredor', () => {
    const ruta = prepararRuta({ puntos: [[0, 0], [0, 100 * M]], pasos: [] });
    const matcher = createRouteMatcher(ruta, { profile: 'walk' });

    const fuera = matcher({ lat: 40 * M, lng: 50 * M, accuracy: 5, timestamp: 1000 });
    const regreso = matcher({ lat: 0, lng: 0, accuracy: 5, timestamp: 2000 });

    expect(fuera.positionSource).toBe(POSITION_SOURCES.RAW);
    expect(regreso.progressM).toBeLessThan(1);
    expect(regreso.progressPlausible).toBe(true);
  });
});
