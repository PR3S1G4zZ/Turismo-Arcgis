// backend/src/utils/osrmRouting.js
// Respaldo de ruteo vía OSRM público. Se usa cuando no hay API key de ArcGIS
// configurada o cuando el servicio de ArcGIS falla, para que la guía no se caiga.
//
// AVISO: router.project-osrm.org es un servidor de DEMOSTRACIÓN, sin garantía de
// disponibilidad y con límite de peticiones. Es válido para desarrollo y como
// red de seguridad, pero la ruta de producción debe ser ArcGIS.
const BASE = 'https://router.project-osrm.org/route/v1';

// OSRM no devuelve texto de instrucción, solo el tipo de maniobra. Se compone
// la frase en español a partir de `maneuver` y del nombre de la vía.
const GIROS = {
  left: 'a la izquierda',
  right: 'a la derecha',
  'slight left': 'ligeramente a la izquierda',
  'slight right': 'ligeramente a la derecha',
  'sharp left': 'cerrado a la izquierda',
  'sharp right': 'cerrado a la derecha',
  straight: 'de frente',
  uturn: 'en U',
};

function redactarInstruccion(paso) {
  const tipo = paso.maneuver?.type || '';
  const giro = GIROS[paso.maneuver?.modifier] || '';
  const via = paso.name ? ` por ${paso.name}` : '';
  const enVia = paso.name ? ` hacia ${paso.name}` : '';

  switch (tipo) {
    case 'depart':
      return `Comienza el recorrido${via}`;
    case 'arrive':
      return 'Has llegado a tu destino';
    case 'turn':
      return `Gira ${giro}${enVia}`;
    case 'new name':
    case 'continue':
      return `Continúa${giro ? ` ${giro}` : ''}${via}`;
    case 'merge':
      return `Incorpórate ${giro}${enVia}`;
    case 'fork':
      return `En la bifurcación, mantente ${giro}${enVia}`;
    case 'end of road':
      return `Al final de la vía, gira ${giro}${enVia}`;
    case 'roundabout':
    case 'rotary':
      return `Entra en la glorieta${paso.maneuver?.exit ? ` y toma la salida ${paso.maneuver.exit}` : ''}${enVia}`;
    case 'roundabout turn':
      return `En la glorieta, gira ${giro}${enVia}`;
    case 'ramp':
    case 'on ramp':
      return `Toma la rampa ${giro}${enVia}`;
    case 'off ramp':
      return `Toma la salida ${giro}${enVia}`;
    default:
      return `Continúa${via}`;
  }
}

/**
 * Resuelve una ruta real por calles con OSRM.
 * Devuelve el mismo formato que `resolverRutaArcgis`.
 * @param {{lat:number,lng:number}} origen
 * @param {{lat:number,lng:number}} destino
 * @param {'walk'|'car'} modo
 */
export async function resolverRutaOsrm(origen, destino, modo) {
  const perfil = modo === 'walk' ? 'foot' : 'driving';
  const coords = `${origen.lng},${origen.lat};${destino.lng},${destino.lat}`;
  const url = `${BASE}/${perfil}/${coords}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM respondió ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM no encontró ruta (${data.code || 'sin código'}).`);
  }

  const ruta = data.routes[0];
  // GeoJSON entrega [lng, lat]; Leaflet espera [lat, lng].
  const puntos = ruta.geometry.coordinates.map((p) => [p[1], p[0]]);

  // El servidor de demostración solo hospeda el perfil de automóvil e ignora
  // el que se pide en la URL: para 'foot' devolvería tiempos de coche (2 km en
  // 4 min). Se recalcula la duración a paso humano a partir de la distancia.
  const aPie = modo === 'walk';
  const VELOCIDAD_PEATON_MS = 5000 / 3600; // 5 km/h
  const duracionDe = (distanciaM, duracionS) =>
    aPie ? distanciaM / VELOCIDAD_PEATON_MS / 60 : (duracionS || 0) / 60;

  const pasos = (ruta.legs?.[0]?.steps || []).map((s) => ({
    texto: redactarInstruccion(s),
    distanciaM: Number(s.distance) || 0,
    duracionMin: duracionDe(Number(s.distance) || 0, Number(s.duration)),
    maniobra: s.maneuver?.type || '',
  }));

  const distanciaM = Number(ruta.distance) || 0;

  return {
    fuente: 'osrm',
    puntos,
    pasos,
    distanciaM,
    duracionMin: duracionDe(distanciaM, Number(ruta.duration)),
    // OSRM no modela tráfico y nunca es el proveedor ArcGIS: ambos campos van
    // en false siempre, para que el cliente vea la degradación sin ambigüedad
    // en vez de omitir los campos (TRAFFIC-01).
    traficoSolicitado: false,
    traficoAplicado: false,
    degradacionTrafico: modo === 'car' ? 'proveedor-osrm-sin-trafico' : null,
  };
}
