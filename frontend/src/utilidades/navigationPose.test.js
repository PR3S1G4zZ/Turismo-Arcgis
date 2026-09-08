import { describe, expect, it } from 'vitest';
import { NAVIGATION_FIXTURES } from './navigationFixtures';
import {
  circularDifference,
  createNavigationPoseEstimator,
  interpolateCircularAngle,
  normalizeAngle,
} from './navigationPose';

const point = (lat, lng, timestamp, extras = {}) => ({
  lat,
  lng,
  timestamp,
  accuracy: 5,
  speed: null,
  heading: null,
  ...extras,
});

describe('navigation pose', () => {
  it('does not treat absent speed as stopped and enters motion from displacement after two observations', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'car' });

    const first = estimator.update(point(0, 0, 1000));
    const second = estimator.update(point(0, 0.00006, 2000));
    const third = estimator.update(point(0, 0.00012, 3000));

    expect(first.speedEstimateMps).toBeNull();
    expect(first.isMoving).toBe(false);
    expect(second.isMoving).toBe(false);
    expect(third.isMoving).toBe(true);
    expect(third.speedEstimateMps).toBeGreaterThan(0);
    expect(third.movementBearing).toBeCloseTo(90, 0);
    expect(third.bearingSource).toBe('derived');
  });

  it('accepts speed as an independent motion signal and progress as a fallback signal', () => {
    const bySpeed = createNavigationPoseEstimator({ profile: 'walk' });
    bySpeed.update(point(0, 0, 1000, { speed: 1.2 }));
    expect(bySpeed.update(point(0, 0, 2000, { speed: 1.2 })).isMoving).toBe(true);

    const byProgress = createNavigationPoseEstimator({ profile: 'walk' });
    byProgress.update(point(0, 0, 1000), { progressM: 0 });
    const second = byProgress.update(point(0, 0, 2000), { progressM: 4 });
    expect(second.isMoving).toBe(false);
    expect(byProgress.update(point(0, 0, 3000), { progressM: 8 }).isMoving).toBe(true);
  });

  it('leaves motion only after the configured stopped hysteresis', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    estimator.update(point(0, 0, 1000, { speed: 1 }));
    estimator.update(point(0, 0, 2000, { speed: 1 }));
    expect(estimator.getPose().isMoving).toBe(true);

    expect(estimator.update(point(0, 0, 3000, { speed: 0 })).isMoving).toBe(true);
    expect(estimator.update(point(0, 0, 3500, { speed: 0 })).isMoving).toBe(true);
    expect(estimator.update(point(0, 0, 4000, { speed: 0 })).isMoving).toBe(false);
  });

  it('stops after a no-progress interval even before stopped observations are exhausted', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'car' });
    estimator.update(point(0, 0, 1000, { speed: 2 }));
    estimator.update(point(0, 0, 2000, { speed: 2 }));
    expect(estimator.getPose().isMoving).toBe(true);

    const stopped = estimator.update(point(0, 0, 4501, { speed: null }));
    expect(stopped.isMoving).toBe(false);
  });

  it('rejects out-of-order observations and preserves the last accepted pose', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    estimator.update(point(0, 0, 1000));
    const accepted = estimator.update(point(0, 0.00005, 2000));
    const stale = estimator.update(point(0, 0.001, 1500));

    expect(stale).toEqual(accepted);
    expect(estimator.getState().lastTimestamp).toBe(2000);
  });

  it('uses GPS, then derived, then compass, route tangent, and held bearings by policy', () => {
    const gps = createNavigationPoseEstimator({ profile: 'car' });
    gps.update(point(0, 0, 1000, { speed: 3, heading: 359 }));
    const gpsPose = gps.update(point(0, 0, 2000, { speed: 3, heading: 1 }));
    expect(gpsPose.bearingSource).toBe('gps');
    expect(gpsPose.arrowBearing).toBe(1);
    expect(circularDifference(359, gpsPose.arrowBearing)).toBe(2);

    const derived = createNavigationPoseEstimator({ profile: 'walk' });
    derived.update(point(0, 0, 1000));
    derived.update(point(0, 0.00004, 2000));
    const derivedPose = derived.update(point(0, 0.00008, 3000));
    expect(derivedPose.bearingSource).toBe('derived');

    const compass = createNavigationPoseEstimator({ profile: 'walk' });
    compass.update(point(0, 0, 1000, { speed: 0 }), {
      routeTangent: 90,
      compass: { heading: 12, timestamp: 1000, permission: 'granted' },
    });
    const compassPose = compass.update(point(0, 0, 2000, { speed: 0 }), {
      routeTangent: 90,
      compass: { heading: 12, timestamp: 2000, permission: 'granted' },
    });
    expect(compassPose.bearingSource).toBe('compass');
    expect(compassPose.arrowBearing).toBe(12);

    const route = createNavigationPoseEstimator({ profile: 'walk' });
    const routePose = route.update(point(0, 0, 1000), { routeTangent: 90 });
    expect(routePose.bearingSource).toBe('route-tangent');
    const heldPose = route.update(point(0, 0, 2000), { routeTangent: null });
    expect(heldPose.bearingSource).toBe('held');
  });

  it('expires a held bearing and rejects an unauthorized or stale compass', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    estimator.update(point(0, 0, 1000, { speed: 1, heading: 80 }));
    estimator.update(point(0, 0, 2000, { speed: 1, heading: 80 }));

    const expired = estimator.update(point(0, 0, 8001, { speed: 0 }), {
      compass: { heading: 10, timestamp: 1000, permission: 'denied' },
    });
    expect(expired.arrowBearing).toBeNull();
    expect(expired.bearingSource).toBe('held');
  });

  it('returns matched target pose and confidence from conservative corridor rules', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'car' });
    const pose = estimator.update(point(0, 0, 1000), {
      match: {
        position: { lat: 0, lng: 0.00001 },
        segmentIndex: 4,
        deviationM: 4,
        progressM: 15,
      },
      targetPosition: { lat: 0.001, lng: 0.002 },
    });

    expect(pose.matchedPosition).toEqual({ lat: 0, lng: 0.00001 });
    expect(pose.positionSource).toBe('matched');
    expect(pose.routeSegmentIndex).toBe(4);
    expect(pose.targetPosition).toEqual({ lat: 0.001, lng: 0.002 });
    expect(pose.isOffRoute).toBe(false);
    expect(pose.confidence).toBe('high');

    const next = estimator.update(point(0, 0.00002, 2000));
    expect(next.targetPosition).toEqual({ lat: 0, lng: 0.00002 });

    const matchedTarget = createNavigationPoseEstimator({ profile: 'car' }).update(point(0, 0, 1000), {
      match: { position: { lat: 0, lng: 0.00001 }, deviationM: 4 },
    });
    expect(matchedTarget.targetPosition).toEqual({ lat: 0, lng: 0.00001 });
  });

  it('holds the last target when matching rejects an implausible progress jump', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    const accepted = estimator.update(point(0, 0, 1000), {
      match: {
        position: { lat: 0, lng: 0 },
        segmentIndex: 0,
        deviationM: 0,
        progressM: 0,
        progressPlausible: true,
      },
    });
    const rejected = estimator.update(point(0.0036, 0, 2000), {
      match: {
        position: { lat: 0.0036, lng: 0 },
        segmentIndex: 10,
        deviationM: 0,
        progressM: 50,
        progressPlausible: false,
      },
    });

    expect(rejected.matchedPosition).toBeNull();
    expect(rejected.positionSource).toBe('held');
    expect(rejected.targetPosition).toEqual(accepted.targetPosition);
    expect(rejected.confidence).toBe('low');
  });

  it('marks degraded fixes low confidence and off route without replacing them by a target', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    const pose = estimator.update(point(0, 0, 1000, { accuracy: 80 }), {
      match: { position: { lat: 0, lng: 0.001 }, segmentIndex: 2, deviationM: 40 },
    });

    expect(pose.rawPosition).toEqual({ lat: 0, lng: 0 });
    expect(pose.matchedPosition).toBeNull();
    expect(pose.positionSource).toBe('raw');
    expect(pose.isOffRoute).toBe(true);
    expect(pose.confidence).toBe('low');
  });

  it('normalizes and interpolates circular angles across north', () => {
    expect(normalizeAngle(-1)).toBe(359);
    expect(normalizeAngle(721)).toBe(1);
    expect(circularDifference(359, 1)).toBe(2);
    expect(circularDifference(1, 359)).toBe(-2);
    const midpoint = interpolateCircularAngle(359, 1, 0.5);
    expect(midpoint === 0 || midpoint === 360).toBe(true);
  });

  it('handles the deterministic fixture traces without mutating fixtures', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    const before = JSON.stringify(NAVIGATION_FIXTURES.nullSpeedAndHeading);
    const poses = NAVIGATION_FIXTURES.nullSpeedAndHeading.map((observation) => estimator.update(observation));

    expect(poses).toHaveLength(3);
    expect(JSON.stringify(NAVIGATION_FIXTURES.nullSpeedAndHeading)).toBe(before);
    expect(poses.every((pose) => Number.isFinite(pose.timestamp))).toBe(true);
  });

  it('holds the last usable target through a short GPS degradation and recovers on the next good fix', () => {
    const estimator = createNavigationPoseEstimator({ profile: 'walk' });
    const [first, second, degraded, recovery] = NAVIGATION_FIXTURES.degradedAndRecovery
      .map((observation) => estimator.update(observation));

    expect(first.positionSource).toBe('raw');
    expect(second.positionSource).toBe('raw');
    expect(degraded.rawPosition).toEqual({ lat: 0, lng: 0.001 });
    expect(degraded.positionSource).toBe('held');
    expect(degraded.targetPosition).toEqual(second.targetPosition);
    expect(degraded.confidence).toBe('low');
    expect(recovery.positionSource).toBe('raw');
    expect(recovery.targetPosition).toEqual({ lat: 0, lng: 0.0001 });
  });
});
