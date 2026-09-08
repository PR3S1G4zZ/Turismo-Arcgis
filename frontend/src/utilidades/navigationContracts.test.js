import { describe, expect, it } from 'vitest';
import {
  BEARING_SOURCES,
  CAMERA_MODES,
  NAVIGATION_CONTRACT_VERSION,
  POSITION_SOURCES,
} from './navigationContracts';
import { getNavigationProfile, NAVIGATION_PROFILES } from './navigationProfiles';
import { NAVIGATION_FIXTURES } from './navigationFixtures';

describe('navigation architecture contract', () => {
  it('freezes the versioned source and camera vocabularies', () => {
    expect(NAVIGATION_CONTRACT_VERSION).toBe('navigation-pose-v1');
    expect(Object.values(BEARING_SOURCES)).toEqual([
      'gps', 'derived', 'route-tangent', 'compass', 'held',
    ]);
    expect(Object.values(POSITION_SOURCES)).toEqual(['raw', 'matched', 'held']);
    expect(Object.values(CAMERA_MODES)).toEqual([
      'OVERVIEW', 'FOLLOWING', 'FREE', 'RECENTERING', 'GPS_DEGRADED',
    ]);
  });

  it('keeps car and walk thresholds explicit and distinct', () => {
    expect(NAVIGATION_PROFILES.car.motion.speedEnterMps).toBe(1.5);
    expect(NAVIGATION_PROFILES.walk.motion.speedEnterMps).toBe(0.5);
    expect(NAVIGATION_PROFILES.car.matching.corridorMaxM).toBe(45);
    expect(NAVIGATION_PROFILES.walk.matching.corridorMaxM).toBe(30);
    expect(NAVIGATION_PROFILES.car.camera.pitchDeg).toBe(50);
    expect(NAVIGATION_PROFILES.walk.camera.pitchDeg).toBe(35);
    expect(getNavigationProfile('unknown').profile).toBe('walk');
  });

  it('contains only synthetic deterministic traces', () => {
    expect(Object.keys(NAVIGATION_FIXTURES)).toEqual([
      'straightWithJitter',
      'rightTurn',
      'parallelStreets',
      'selfCrossing',
      'nullSpeedAndHeading',
      'stationaryNoisyCompass',
      'degradedAndRecovery',
    ]);
    for (const trace of Object.values(NAVIGATION_FIXTURES)) {
      expect(trace.length).toBeGreaterThanOrEqual(3);
      expect(trace.every((point) => Number.isFinite(point.timestamp))).toBe(true);
      expect(trace.every((point) => Math.abs(point.lat) < 1 && Math.abs(point.lng) < 1)).toBe(true);
    }
  });
});
