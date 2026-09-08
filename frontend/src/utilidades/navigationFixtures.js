/**
 * Trazas sintéticas para pruebas deterministas. Las coordenadas están
 * deliberadamente alrededor de (0, 0) y no representan recorridos reales.
 */

const observacion = (lat, lng, timestamp, extras = {}) => Object.freeze({
  lat,
  lng,
  timestamp,
  accuracy: 5,
  speed: null,
  heading: null,
  ...extras,
});

export const NAVIGATION_FIXTURES = Object.freeze({
  straightWithJitter: Object.freeze([
    observacion(0, 0, 1000),
    observacion(0, 0.00005, 2000),
    observacion(0, 0.00011, 3000),
    observacion(0, 0.00016, 4000),
  ]),
  rightTurn: Object.freeze([
    observacion(0, 0, 1000, { speed: 2, heading: 90 }),
    observacion(0, 0.0001, 2000, { speed: 2, heading: 90 }),
    observacion(0.00005, 0.0001, 3000, { speed: 2, heading: 0 }),
    observacion(0.00011, 0.0001, 4000, { speed: 2, heading: 0 }),
  ]),
  parallelStreets: Object.freeze([
    observacion(0, 0, 1000, { speed: 4, heading: 90 }),
    observacion(0, 0.0001, 2000, { speed: 4, heading: 90 }),
    observacion(0.00012, 0.0001, 3000, { speed: 4, heading: 0 }),
  ]),
  selfCrossing: Object.freeze([
    observacion(-0.0002, -0.0002, 1000),
    observacion(0, 0, 2000),
    observacion(0.0002, -0.0002, 3000),
    observacion(0, 0, 4000),
    observacion(0.0002, 0.0002, 5000),
  ]),
  nullSpeedAndHeading: Object.freeze([
    observacion(0, 0, 1000),
    observacion(0, 0.00004, 2000),
    observacion(0, 0.00009, 3000),
  ]),
  stationaryNoisyCompass: Object.freeze([
    observacion(0, 0, 1000, { speed: 0 }),
    observacion(0, 0, 2000, { speed: 0 }),
    observacion(0, 0, 3000, { speed: 0 }),
  ]),
  degradedAndRecovery: Object.freeze([
    observacion(0, 0, 1000),
    observacion(0, 0.00004, 2000),
    Object.freeze({ timestamp: 3000, accuracy: 80, lat: 0, lng: 0.001, speed: null, heading: null }),
    observacion(0, 0.0001, 4000),
  ]),
});
