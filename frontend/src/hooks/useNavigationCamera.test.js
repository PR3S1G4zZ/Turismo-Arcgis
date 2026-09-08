import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CAMERA_MODES } from '../utilidades/navigationContracts';
import { getNavigationProfile } from '../utilidades/navigationProfiles';
import {
  applyCameraDeadband,
  buildCameraTarget,
  cameraOffsetForAnchor,
  limitAngularVelocity,
  useNavigationCamera,
} from './useNavigationCamera';

const navigationFrame = (overrides = {}) => ({
  displayPosition: { lat: 0, lng: 0 },
  arrowBearing: 90,
  cameraBearing: 90,
  speedEstimateMps: 1,
  cameraMode: CAMERA_MODES.FOLLOWING,
  timestamp: 1000,
  ...overrides,
});

describe('useNavigationCamera', () => {
  it('changes to FREE only for a real gesture and recenters through RECENTERING', () => {
    const { result } = renderHook(() => useNavigationCamera({
      frame: navigationFrame(),
      active: true,
      gpsConfiable: true,
    }));

    expect(result.current.cameraMode).toBe(CAMERA_MODES.FOLLOWING);

    act(() => result.current.handleGesture({ type: 'zoomstart' }));
    expect(result.current.cameraMode).toBe(CAMERA_MODES.FOLLOWING);

    act(() => result.current.handleGesture({ originalEvent: { type: 'wheel' } }));
    expect(result.current.cameraMode).toBe(CAMERA_MODES.FREE);

    act(() => result.current.recenter());
    expect(result.current.cameraMode).toBe(CAMERA_MODES.RECENTERING);
    act(() => result.current.finishRecentering());
    expect(result.current.cameraMode).toBe(CAMERA_MODES.FOLLOWING);
  });

  it('exposes GPS_DEGRADED while preserving a user-paused camera mode on recovery', () => {
    const { result, rerender } = renderHook(
      ({ gpsConfiable }) => useNavigationCamera({
        frame: navigationFrame(),
        active: true,
        gpsConfiable,
      }),
      { initialProps: { gpsConfiable: true } },
    );

    act(() => result.current.handleGesture({ originalEvent: { type: 'pointerdown' } }));
    expect(result.current.cameraMode).toBe(CAMERA_MODES.FREE);

    rerender({ gpsConfiable: false });
    expect(result.current.cameraMode).toBe(CAMERA_MODES.GPS_DEGRADED);

    rerender({ gpsConfiable: true });
    expect(result.current.cameraMode).toBe(CAMERA_MODES.FREE);
  });

  it('recovers from GPS_DEGRADED into FOLLOWING when degradation began before follow', () => {
    const { result, rerender } = renderHook(
      ({ gpsConfiable }) => useNavigationCamera({
        frame: navigationFrame(),
        active: true,
        gpsConfiable,
      }),
      { initialProps: { gpsConfiable: false } },
    );

    expect(result.current.cameraMode).toBe(CAMERA_MODES.GPS_DEGRADED);
    rerender({ gpsConfiable: true });
    expect(result.current.cameraMode).toBe(CAMERA_MODES.FOLLOWING);
  });

  it('keeps a deadband, limits angular velocity, and clamps look-ahead/pitch/zoom', () => {
    expect(applyCameraDeadband(90, 92, 3)).toBe(90);
    expect(limitAngularVelocity(359, 179, 90, 1000)).toBe(269);

    const target = buildCameraTarget(
      navigationFrame({
        displayPosition: { lat: 0, lng: 0 },
        cameraBearing: 90,
        speedEstimateMps: 100,
      }),
      {
        profile: getNavigationProfile('car'),
        previousBearing: 90,
        previousTimestamp: 0,
        limits: { minPitch: 0, maxPitch: 45, minZoom: 12, maxZoom: 17 },
      },
    );

    expect(target.pitch).toBe(45);
    expect(target.zoom).toBe(16.2);
    expect(target.bearing).toBe(90);
    expect(target.center[0]).toBeGreaterThan(0);
    expect(target.center[1]).toBeCloseTo(0, 12);
  });

  it('uses the shared display position rather than a raw GPS position', () => {
    const target = buildCameraTarget(navigationFrame({
      rawPosition: { lat: 9, lng: 9 },
      displayPosition: { lat: 1, lng: 2 },
      cameraBearing: 0,
      speedEstimateMps: 0,
    }), { profile: 'walk' });

    expect(target.center[0]).toBe(2);
    expect(target.center[1]).toBeGreaterThan(1);
  });

  it('translates the anchor ratio into a viewport offset below center', () => {
    expect(cameraOffsetForAnchor(0.7, 500)).toEqual([0, 100]);
    expect(cameraOffsetForAnchor(0.5, 500)).toEqual([0, 0]);
    expect(cameraOffsetForAnchor(0.7, 0)).toEqual([0, 0]);
  });
});
