// backend/src/utils/arcgisRouting.js
// Cliente del servicio de rutas de ArcGIS (World Route). Resuelve el trayecto
// entre dos puntos y normaliza la respuesta al formato interno del portal.
//
// La API key nunca sale del backend: el frontend habla con /api/rutas y este
// módulo es el único que conoce el token.
import { config } from '../config.js';

const NASERVER = 'https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World';
const GET_TRAVEL_MODES =
  'https://route-api.arcgis.com/arcgis/rest/services/World/Utilities/GPServer/GetTravelModes/execute';
const OAUTH_TOKEN = 'https://www.arcgis.com/sharing/rest/oauth2/token';

/** ¿Hay credenciales de ArcGIS configuradas (API key u OAuth de aplicación)? */
export const hayArcgis = () =>
  Boolean(config.arcgis.apiKey) || Boolean(config.arcgis.clientId && config.arcgis.clientSecret);

// ─── Token de acceso ────────────────────────────────────────
// Se admiten dos formas de autenticación:
//   1. API key: token de larga duración pegado directo en el .env.
//   2. OAuth 2.0 de aplicación (client_id + client_secret): el backend pide el
//      token al vuelo y lo renueva solo. Es la opción a usar cuando la cuenta
//      no tiene privilegio para generar API keys.
let cacheToken = null;
let cacheTokenExpira = 0;

async function obtenerToken() {
  if (config.arcgis.apiKey) return config.arcgis.apiKey;

  // Margen de 5 min para no usar un token a punto de vencer.
  if (cacheToken && Date.now() < cacheTokenExpira - 5 * 60 * 1000) return cacheToken;

  const cuerpo = {
    client_id: config.arcgis.clientId,
    client_secret: config.arcgis.clientSecret,
    grant_type: 'client_credentials',
    expiration: '20160', // 2 semanas, el máximo permitido
    f: 'json',
  };
  // Vincula el token al mismo referer con el que se usará después.
  if (config.arcgis.referer) cuerpo.referer = config.arcgis.referer;

  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: cabeceras(),
    body: new URLSearchParams(cuerpo).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    const msg = data.error?.message || data.error_description || `HTTP ${res.status}`;
    throw new Error(`No se pudo obtener el token de ArcGIS: ${msg}`);
  }

  cacheToken = data.access_token;
  cacheTokenExpira = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cacheToken;
}

/** Invalida el token cacheado para forzar su renovación en el próximo intento. */
function descartarToken() {
  cacheToken = null;
  cacheTokenExpira = 0;
}

/**
 * Token para el basemap vectorial de ArcGIS que consume el cliente (MapLibre).
 * Reutiliza el mismo token de aplicación del ruteo (API key u OAuth) y añade
 * cuándo expira para que el navegador lo renueve. Con API key no hay
 * vencimiento conocido: se informa un horizonte amplio y prudente.
 *
 * El token viaja al cliente restringido por el `referer` registrado en las
 * credenciales; es el patrón estándar de Esri para basemaps en el navegador.
 */
export async function obtenerTokenBasemap() {
  const token = await obtenerToken();
  const expiraEn = config.arcgis.apiKey
    ? Date.now() + 24 * 60 * 60 * 1000 // API key: se refresca cada día por prudencia.
    : cacheTokenExpira; // OAuth: vencimiento real del token cacheado.
  return { token, expiraEn };
}

// ─── Modos de desplazamiento ────────────────────────────────
// El servicio exige `travelMode` como OBJETO JSON completo, no como el nombre
// ("Walking Time" a secas falla). Los modos los define la organización en
// ArcGIS Online, así que hay que consultarlos y cachearlos.
let cacheModos = null;
let cacheModosExpira = 0;
const CACHE_MODOS_MS = 6 * 60 * 60 * 1000; // 6 h

/**
 * Cabeceras de salida hacia ArcGIS. Si las credenciales tienen URL de
 * referencia registradas, el servicio compara la cabecera Referer de cada
 * petición contra esa lista; Node no la envía sola, así que se añade aquí.
 */
function cabeceras() {
  const h = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (config.arcgis.referer) h.Referer = config.arcgis.referer;
  return h;
}

async function pedirJson(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: cabeceras(),
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`ArcGIS respondió ${res.status}`);
  const data = await res.json();
  // ArcGIS devuelve HTTP 200 incluso en error; el fallo viene en el cuerpo.
  if (data.error) {
    const detalle = Array.isArray(data.error.details) ? data.error.details.join(' ') : '';
    throw new Error(`ArcGIS: ${data.error.message || 'error desconocido'} ${detalle}`.trim());
  }
  return data;
}

/** Lista de modos soportados, cacheada. Devuelve [] si no se pudieron obtener. */
async function obtenerModos() {
  if (cacheModos && Date.now() < cacheModosExpira) return cacheModos;

  const token = await obtenerToken();
  let modos = [];

  // 1) Metadatos del propio servicio de rutas.
  try {
    const data = await pedirJson(NASERVER, { f: 'json', token });
    if (Array.isArray(data.supportedTravelModes)) modos = data.supportedTravelModes;
  } catch (err) {
    console.warn('[arcgis] No se pudieron leer los modos desde NAServer:', err.message);
  }

  // 2) Servicio de utilidades como alternativa.
  if (modos.length === 0) {
    try {
      const data = await pedirJson(GET_TRAVEL_MODES, { f: 'json', token });
      const tabla = data.results?.find((r) => r.paramName === 'supportedTravelModes');
      const features = tabla?.value?.features || [];
      modos = features
        .map((f) => {
          try { return JSON.parse(f.attributes.TravelMode); } catch { return null; }
        })
        .filter(Boolean);
    } catch (err) {
      console.warn('[arcgis] No se pudieron leer los modos desde GetTravelModes:', err.message);
    }
  }

  cacheModos = modos;
  cacheModosExpira = Date.now() + CACHE_MODOS_MS;
  if (modos.length === 0) {
    console.warn('[arcgis] Sin modos de desplazamiento; se usará el predeterminado del servicio.');
  }
  return modos;
}

/** Elige el objeto travelMode que corresponde a 'walk' o 'car'. */
async function elegirModo(modo) {
  const modos = await obtenerModos();
  if (modos.length === 0) return null;

  const nombre = (m) => String(m.name || '').toLowerCase();
  const preferencias = modo === 'walk'
    ? ['walking time', 'walking distance', 'walking']
    : ['driving time', 'driving distance', 'driving'];

  for (const pref of preferencias) {
    const hit = modos.find((m) => nombre(m) === pref) || modos.find((m) => nombre(m).includes(pref));
    if (hit) return hit;
  }
  return null;
}

// ─── Normalización de la respuesta ──────────────────────────

/**
 * Convierte la respuesta cruda de /solve al formato interno:
 *   { fuente, puntos: [[lat,lng]…], pasos: [{texto,distanciaM,duracionMin,maniobra}], distanciaM, duracionMin }
 */
function normalizar(data) {
  const feature = data.routes?.features?.[0];
  if (!feature?.geometry?.paths?.length) {
    throw new Error('ArcGIS no devolvió geometría de ruta.');
  }

  // paths es una matriz de tramos; se concatenan respetando el orden.
  // ArcGIS entrega [x, y] = [lng, lat]; Leaflet espera [lat, lng].
  const puntos = feature.geometry.paths
    .flat()
    .map((p) => [p[1], p[0]]);

  const direccion = data.directions?.[0];
  const pasos = (direccion?.features || [])
    .map((f) => ({
      texto: f.attributes?.text || '',
      // directionsLengthUnits=esriNAUMeters ⇒ length ya viene en metros.
      distanciaM: Number(f.attributes?.length) || 0,
      duracionMin: Number(f.attributes?.time) || 0,
      maniobra: f.attributes?.maneuverType || '',
    }))
    .filter((p) => p.texto);

  const distanciaM = Number(direccion?.summary?.totalLength) || 0;
  const duracionMin = Number(direccion?.summary?.totalTime) || 0;

  return { fuente: 'arcgis', puntos, pasos, distanciaM, duracionMin };
}

// ─── API pública ────────────────────────────────────────────

/**
 * Resuelve una ruta real por calles entre dos coordenadas.
 * @param {{lat:number,lng:number}} origen
 * @param {{lat:number,lng:number}} destino
 * @param {'walk'|'car'} modo
 */
export async function resolverRutaArcgis(origen, destino, modo, nombreDestino) {
  try {
    return await solve(origen, destino, modo, nombreDestino);
  } catch (err) {
    // Token vencido o revocado: se descarta y se reintenta una vez con uno nuevo.
    if (/token/i.test(err.message) && !config.arcgis.apiKey) {
      descartarToken();
      return solve(origen, destino, modo, nombreDestino);
    }
    throw err;
  }
}

/**
 * Paradas como conjunto de entidades en lugar del formato simple
 * "lng,lat;lng,lat": así se les puede poner nombre y las indicaciones dicen
 * "Ha llegado a la Casa de la Cultura" en vez de "Ha llegado a Location 2".
 */
function construirParadas(origen, destino, nombreDestino) {
  const punto = (p, nombre) => ({
    geometry: { x: p.lng, y: p.lat, spatialReference: { wkid: 4326 } },
    attributes: { Name: nombre },
  });
  return JSON.stringify({
    type: 'features',
    features: [
      punto(origen, 'Tu ubicación'),
      punto(destino, nombreDestino || 'Destino'),
    ],
  });
}

async function solve(origen, destino, modo, nombreDestino) {
  const travelMode = await elegirModo(modo);

  const params = {
    f: 'json',
    token: await obtenerToken(),
    stops: construirParadas(origen, destino, nombreDestino),
    returnRoutes: 'true',
    returnDirections: 'true',
    returnStops: 'false',
    returnBarriers: 'false',
    returnPolygonBarriers: 'false',
    returnPolylineBarriers: 'false',
    directionsLanguage: 'es',
    directionsLengthUnits: 'esriNAUMeters',
    outputLines: 'esriNAOutputLineTrueShape',
    outSR: '4326',
  };
  if (travelMode) params.travelMode = JSON.stringify(travelMode);

  const data = await pedirJson(`${NASERVER}/solve`, params);
  return normalizar(data);
}
