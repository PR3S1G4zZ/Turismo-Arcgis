import { describe, expect, it, vi } from 'vitest';
import { CAMERA_MODES } from '../utilidades/navigationContracts';
import { NAVIGATION_FIXTURES } from '../utilidades/navigationFixtures';
import {
  circularDifference,
  createNavigationFrameScheduler,
  frameFromPose,
  interpolateNavigationFrame,
} from './useNavigationFrame';

const frame = (overrides = {}) => ({
  displayPosition: { lat: 0, lng: 0 },
  arrowBearing: 90,
  cameraBearing: 90,
  speedEstimateMps: 1,
  cameraMode: CAMERA_MODES.FOLLOWING,
  timestamp: 1000,
  ...overrides,
});

describe('useNavigationFrame', () => {
  it('interpolates position and angles on the shortest arc and clamps progress', () => {
    const inicio = frame({
      arrowBearing: 359,
      cameraBearing: 359,
      timestamp: 1000,
    });
    const destino = frame({
      displayPosition: { lat: 1, lng: 2 },
      arrowBearing: 1,
      cameraBearing: 1,
      speedEstimateMps: 5,
      timestamp: 2000,
    });

    const mitad = interpolateNavigationFrame(inicio, destino, 0.5);

    expect(mitad.displayPosition).toEqual({ lat: 0.5, lng: 1 });
    expect(circularDifference(359, mitad.arrowBearing)).toBe(1);
    expect(circularDifference(359, mitad.cameraBearing)).toBe(1);
    expect(mitad.speedEstimateMps).toBe(3);
    expect(interpolateNavigationFrame(inicio, destino, -1)).toEqual(inicio);
    expect(interpolateNavigationFrame(inicio, destino, 2)).toEqual(destino);
  });

  it('uses one pending RAF and stops at the target instead of extrapolating', () => {
    const callbacks = new Map();
    let nextId = 0;
    const requestAnimationFrame = vi.fn((callback) => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    });
    const cancelAnimationFrame = vi.fn((id) => callbacks.delete(id));
    const received = [];
    const scheduler = createNavigationFrameScheduler({
      requestAnimationFrame,
      cancelAnimationFrame,
      durationMs: 1000,
      onFrame: (next) => received.push(next),
    });
    const inicio = frame({ displayPosition: { lat: 0, lng: 0 }, timestamp: 0 });
    const destino = frame({ displayPosition: { lat: 1, lng: 1 }, timestamp: 1000 });

    scheduler.schedule(destino, { from: inicio, startedAt: 0 });
    scheduler.schedule({ ...destino, displayPosition: { lat: 2, lng: 2 } }, {
      from: inicio,
      startedAt: 0,
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect([...callbacks.keys()]).toHaveLength(1);

    const firstCallback = callbacks.get(1);
    callbacks.delete(1);
    firstCallback(500);
    expect(received.at(-1).displayPosition).toEqual({ lat: 1, lng: 1 });

    const secondCallback = callbacks.get(2);
    callbacks.delete(2);
    secondCallback(5000);
    expect(received.at(-1).displayPosition).toEqual({ lat: 2, lng: 2 });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect([...callbacks.keys()]).toHaveLength(0);
  });

  it('projects a pose into the shared frame without mutating synthetic fixtures', () => {
    const fixtureBefore = JSON.stringify(NAVIGATION_FIXTURES.rightTurn);
    const pose = {
      rawPosition: { lat: 0, lng: 0 },
      matchedPosition: { lat: 0, lng: 0.0001 },
      targetPosition: { lat: 0, lng: 0.0001 },
      arrowBearing: 90,
      cameraBearing: 90,
      speedEstimateMps: 2,
      timestamp: 2000,
    };

    expect(frameFromPose(pose, CAMERA_MODES.FOLLOWING)).toEqual({
      displayPosition: pose.targetPosition,
      arrowBearing: 90,
      cameraBearing: 90,
      speedEstimateMps: 2,
      cameraMode: CAMERA_MODES.FOLLOWING,
      timestamp: 2000,
    });
    expect(JSON.stringify(NAVIGATION_FIXTURES.rightTurn)).toBe(fixtureBefore);
  });
});
