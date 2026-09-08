/**
 * Contratos compartidos de la arquitectura de navegación.
 *
 * Este archivo se congela en la Fase 0. Los módulos de pose, matching, frame
 * y cámara pueden consumirlo, pero ninguna ola paralela puede cambiar los
 * nombres o los significados sin una decisión explícita del coordinador.
 */

/** @typedef {'car'|'walk'} NavigationProfile */
/** @typedef {'gps'|'derived'|'route-tangent'|'compass'|'held'} BearingSource */
/** @typedef {'raw'|'matched'|'held'} PositionSource */
/** @typedef {'OVERVIEW'|'FOLLOWING'|'FREE'|'RECENTERING'|'GPS_DEGRADED'} CameraMode */

/** @typedef {{lat:number,lng:number}} NavigationPoint */

/**
 * @typedef {Object} NavigationPose
 * @property {NavigationPoint|null} rawPosition
 * @property {NavigationPoint|null} matchedPosition
 * @property {NavigationPoint|null} targetPosition
 * @property {number|null} movementBearing
 * @property {number|null} arrowBearing
 * @property {number|null} cameraBearing
 * @property {number|null} speedEstimateMps
 * @property {number|null} accuracyM
 * @property {number|null} routeSegmentIndex
 * @property {'high'|'medium'|'low'|'lost'} confidence
 * @property {boolean} isMoving
 * @property {boolean} isOffRoute
 * @property {BearingSource} bearingSource
 * @property {PositionSource} positionSource
 * @property {number} timestamp
 */

/**
 * @typedef {Object} NavigationFrame
 * @property {NavigationPoint|null} displayPosition
 * @property {number|null} arrowBearing
 * @property {number|null} cameraBearing
 * @property {number|null} speedEstimateMps
 * @property {CameraMode} cameraMode
 * @property {number} timestamp
 */

export const NAVIGATION_CONTRACT_VERSION = 'navigation-pose-v1';

export const BEARING_SOURCES = Object.freeze({
  GPS: 'gps',
  DERIVED: 'derived',
  ROUTE_TANGENT: 'route-tangent',
  COMPASS: 'compass',
  HELD: 'held',
});

export const POSITION_SOURCES = Object.freeze({
  RAW: 'raw',
  MATCHED: 'matched',
  HELD: 'held',
});

export const CAMERA_MODES = Object.freeze({
  OVERVIEW: 'OVERVIEW',
  FOLLOWING: 'FOLLOWING',
  FREE: 'FREE',
  RECENTERING: 'RECENTERING',
  GPS_DEGRADED: 'GPS_DEGRADED',
});
