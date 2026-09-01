import assert from 'node:assert/strict';
import test from 'node:test';

const origen = { lat: 6.17, lng: -75.61 };
const destino = { lat: 6.18, lng: -75.6 };

const respuesta = (data, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => data,
});

const rutaArcgis = {
  routes: {
    features: [{
      geometry: { paths: [[[-75.61, 6.17], [-75.6, 6.18]]] },
    }],
  },
  directions: [{
    features: [{
      attributes: {
        text: 'Continúa hacia el destino',
        length: 1000,
        time: 4,
        maneuverType: 'esriDMTStraight',
      },
    }],
    summary: { totalLength: 1000, totalTime: 4 },
  }],
};

async function importarArcgis(nombreCaso) {
  process.env.ARCGIS_API_KEY = 'token-de-prueba';
  const url = new URL('../src/utils/arcgisRouting.js', import.meta.url);
  url.searchParams.set('caso', nombreCaso);
  return import(url.href);
}

test('ArcGIS solicita tráfico solo para car con impedancia TravelTime', async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchOriginal; });

  let parametrosSolve;
  globalThis.fetch = async (url, opciones) => {
    const parametros = new URLSearchParams(opciones.body);
    if (String(url).endsWith('/Route_World')) {
      return respuesta({
        supportedTravelModes: [{
          name: 'Driving Time',
          impedanceAttributeName: 'TravelTime',
        }],
      });
    }
    parametrosSolve = parametros;
    return respuesta(rutaArcgis);
  };

  const { resolverRutaArcgis } = await importarArcgis('car-con-trafico');
  const ruta = await resolverRutaArcgis(origen, destino, 'car', 'Destino');

  assert.equal(parametrosSolve.get('startTime'), 'now');
  assert.equal(parametrosSolve.get('startTimeIsUTC'), 'false');
  assert.equal(JSON.parse(parametrosSolve.get('travelMode')).impedanceAttributeName, 'TravelTime');
  assert.equal(ruta.fuente, 'arcgis');
  assert.equal(ruta.traficoSolicitado, true);
  assert.equal(ruta.traficoAplicado, true);
  assert.equal(ruta.degradacionTrafico, null);
});

test('ArcGIS no inventa tráfico si el travel mode de car no lo soporta', async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchOriginal; });

  let parametrosSolve;
  globalThis.fetch = async (url, opciones) => {
    const parametros = new URLSearchParams(opciones.body);
    if (String(url).endsWith('/Route_World')) {
      return respuesta({
        supportedTravelModes: [{
          name: 'Driving Distance',
          impedanceAttributeName: 'TravelDistance',
        }],
      });
    }
    parametrosSolve = parametros;
    return respuesta(rutaArcgis);
  };

  const { resolverRutaArcgis } = await importarArcgis('car-sin-trafico');
  const ruta = await resolverRutaArcgis(origen, destino, 'car', 'Destino');

  assert.equal(parametrosSolve.has('startTime'), false);
  assert.equal(ruta.traficoSolicitado, true);
  assert.equal(ruta.traficoAplicado, false);
  assert.equal(ruta.degradacionTrafico, 'travel-mode-sin-impedancia-de-trafico');
});

test('ArcGIS mantiene walk sin parámetros ni estado de tráfico', async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchOriginal; });

  let parametrosSolve;
  globalThis.fetch = async (url, opciones) => {
    const parametros = new URLSearchParams(opciones.body);
    if (String(url).endsWith('/Route_World')) {
      return respuesta({
        supportedTravelModes: [{
          name: 'Walking Time',
          impedanceAttributeName: 'WalkTime',
        }],
      });
    }
    parametrosSolve = parametros;
    return respuesta(rutaArcgis);
  };

  const { resolverRutaArcgis } = await importarArcgis('walk');
  const ruta = await resolverRutaArcgis(origen, destino, 'walk', 'Destino');

  assert.equal(parametrosSolve.has('startTime'), false);
  assert.equal(ruta.traficoSolicitado, false);
  assert.equal(ruta.traficoAplicado, false);
  assert.equal(ruta.degradacionTrafico, null);
});

test('OSRM declara la degradación de tráfico solo para rutas en auto', async (t) => {
  const fetchOriginal = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchOriginal; });

  globalThis.fetch = async () => respuesta({
    code: 'Ok',
    routes: [{
      distance: 1000,
      duration: 240,
      geometry: { coordinates: [[-75.61, 6.17], [-75.6, 6.18]] },
      legs: [{ steps: [] }],
    }],
  });

  const { resolverRutaOsrm } = await import('../src/utils/osrmRouting.js');
  const rutaCar = await resolverRutaOsrm(origen, destino, 'car');
  const rutaWalk = await resolverRutaOsrm(origen, destino, 'walk');

  assert.deepEqual(
    {
      solicitado: rutaCar.traficoSolicitado,
      aplicado: rutaCar.traficoAplicado,
      degradacion: rutaCar.degradacionTrafico,
    },
    {
      solicitado: false,
      aplicado: false,
      degradacion: 'proveedor-osrm-sin-trafico',
    },
  );
  assert.equal(rutaWalk.degradacionTrafico, null);
});
