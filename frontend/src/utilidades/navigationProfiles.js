import { CAMERA_MODES } from './navigationContracts';

const freezeProfile = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeProfile);
  return Object.freeze(value);
};

/**
 * Parámetros calibrables de navegación. Los algoritmos no deben esconder
 * umbrales propios: cualquier ajuste posterior a UAT se hace aquí y en un
 * commit separado.
 *
 * @type {Readonly<Record<'car'|'walk', Object>>}
 */
export const NAVIGATION_PROFILES = freezeProfile({
  car: {
    profile: 'car',
    motion: {
      speedEnterMps: 1.5,
      displacementEnterM: 5,
      progressEnterM: 5,
      observationWindowMinMs: 1000,
      observationWindowMaxMs: 5000,
      stoppedObservations: 3,
      stoppedNoProgressMs: 2000,
    },
    heading: {
      compassMaxAgeMs: 1500,
      heldMaxAgeMs: 5000,
      cameraDeadbandDeg: 3,
      cameraMaxAngularVelocityDegPerSec: 90,
    },
    matching: {
      accuracyMultiplier: 1.5,
      corridorMinM: 15,
      corridorMaxM: 45,
      maxHeldPositionMs: 3000,
    },
    camera: {
      anchorRatio: 0.7,
      lookAheadMultiplier: 2.5,
      lookAheadMinM: 25,
      lookAheadMaxM: 120,
      pitchDeg: 50,
      lowSpeedZoom: 17,
      highSpeedZoom: 16.2,
      highSpeedMps: 20,
    },
  },
  walk: {
    profile: 'walk',
    motion: {
      speedEnterMps: 0.5,
      displacementEnterM: 3,
      progressEnterM: 3,
      observationWindowMinMs: 1000,
      observationWindowMaxMs: 6000,
      stoppedObservations: 3,
      stoppedNoProgressMs: 2000,
    },
    heading: {
      compassMaxAgeMs: 1500,
      heldMaxAgeMs: 5000,
      cameraDeadbandDeg: 3,
      cameraMaxAngularVelocityDegPerSec: 90,
    },
    matching: {
      accuracyMultiplier: 1.25,
      corridorMinM: 10,
      corridorMaxM: 30,
      maxHeldPositionMs: 3000,
    },
    camera: {
      anchorRatio: 0.7,
      lookAheadMultiplier: 2,
      lookAheadMinM: 10,
      lookAheadMaxM: 35,
      pitchDeg: 35,
      lowSpeedZoom: 17.5,
      highSpeedZoom: 17.5,
      highSpeedMps: 3,
    },
  },
});

/** @param {'car'|'walk'} profile */
export function getNavigationProfile(profile) {
  return NAVIGATION_PROFILES[profile] || NAVIGATION_PROFILES.walk;
}

/** Estados de cámara permitidos por el contrato, expuestos para consumidores. */
export { CAMERA_MODES };
