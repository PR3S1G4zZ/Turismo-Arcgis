// backend/src/routes/routing.test.js
// Pruebas de contrato de POST /api/rutas/resolver (Fase 7, HARDEN-01).
//
// Nunca llaman a ArcGIS/OSRM reales: `fetch` global queda siempre mockeado.
// No se registran coordenadas reales de dispositivos ni tokens — solo
// coordenadas de prueba sintéticas (Itagüí, valores redondos) y una API key
// falsa ('test-key').
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config.js';
import { routingRouter } from './routing.js';

function appDePrueba() {
  const app = express();
  app.use(express.json());
  app.use('/api/rutas', routingRouter);
  return app;
}

const origen = { lat: 6.171, lng: -75.611 };
const destino = { lat: 6.181, lng: -75.621 };

/** Respuesta cruda mínima y válida de ArcGIS /solve. */
function fixtureArcgisOk() {
  return {
    routes: { features: [{ geometry: { paths: [[[-75.611, 6.171], [-75.621, 6.181]]] } }] },
    directions: [{
      features: [{ attributes: { text: 'Gira a la derecha', length: 50, time: 1, maneuverType: 'esriDMT_TurnRight' } }],
      summary: { totalLength: 1200, totalTime: 15 },
    }],
  };
}

/** Respuesta cruda mínima y válida de OSRM /route. */
function fixtureOsrmOk() {
  return {
    code: 'Ok',
    routes: [{
      geometry: { coordinates: [[-75.611, 6.171], [-75.621, 6.181]] },
      distance: 1200,
      duration: 900,
      legs: [{ steps: [{ maneuver: { type: 'depart' }, name: 'Calle 50', distance: 1200, duration: 900 }] }],
    }],
  };
}

/**
 * Mock de `fetch` que enruta por dominio: nunca golpea la red real.
 * @param {(url: string) => Promise<{ok:boolean,status?:number,json:()=>Promise}> } arcgis
 * @param {(url: string) => Promise<{ok:boolean,status?:number,json:()=>Promise}> } osrm
 */
function mockFetchPorDominio(arcgis, osrm) {
  return vi.fn((url, init) => {
    const s = String(url);
    if (s.includes('arcgis.com')) return arcgis(s, init);
    if (s.includes('project-osrm.org')) return osrm(s, init);
    return Promise.reject(new Error(`URL inesperada en fetch mockeado: ${s}`));
  });
}

const fallaRed = () => Promise.reject(new Error('network fail (mock)'));
const httpNoOk = (status) => () => Promise.resolve({ ok: false, status, json: async () => ({}) });
const cuerpoConError = () => Promise.resolve({ ok: true, json: async () => ({ error: { message: 'token inválido' } }) });
const osrmOk = () => Promise.resolve({ ok: true, json: async () => fixtureOsrmOk() });
const arcgisOk = (url) => Promise.resolve({
  ok: true,
  json: async () => String(url).endsWith('/Route_World')
    ? { supportedTravelModes: [{ name: 'Walking Time', impedanceAttributeName: 'WalkTime' }] }
    : fixtureArcgisOk(),
});

describe('POST /api/rutas/resolver — contrato ArcGIS/OSRM (HARDEN-01)', () => {
  let arcgisOriginal;

  beforeEach(() => {
    arcgisOriginal = { ...config.arcgis };
    config.arcgis.apiKey = 'test-key'; // hayArcgis() === true; nunca se usan credenciales reales.
  });

  afterEach(() => {
    Object.assign(config.arcgis, arcgisOriginal);
    vi.unstubAllGlobals();
  });

  it('responde con la ruta de ArcGIS cuando el servicio funciona', async () => {
    const osrm = vi.fn(osrmOk);
    vi.stubGlobal('fetch', mockFetchPorDominio(arcgisOk, osrm));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk', nombreDestino: 'Parque de prueba' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('arcgis');
    expect(res.body.puntos.length).toBeGreaterThan(0);
    expect(osrm).not.toHaveBeenCalled();
  });

  it('expone la fuente real y el contrato de observabilidad en éxito ArcGIS', async () => {
    const cuerpos = [];
    const arcgisConModoYParadas = (_url, init) => {
      const cuerpo = new URLSearchParams(init?.body);
      cuerpos.push(cuerpo);
      if (!String(_url).endsWith('/solve')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            supportedTravelModes: [{
              name: 'Walking Time',
              impedanceAttributeName: 'WalkTime',
            }],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...fixtureArcgisOk(),
          stops: {
            features: [
              { attributes: { Name: 'Tu ubicación', Status: 'OK', Sequence: 1 } },
              { attributes: { Name: 'Parque de prueba', Status: 'OK', Sequence: 2 } },
            ],
          },
        }),
      });
    };
    vi.stubGlobal('fetch', mockFetchPorDominio(arcgisConModoYParadas, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk', nombreDestino: 'Parque de prueba' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      fuente: 'arcgis',
      fallbackAplicado: false,
      motivo: null,
      travelModeSolicitado: 'walk',
      travelModeUtilizado: 'Walking Time',
      advertencias: [],
      ajustesParadas: expect.objectContaining({
        returnStops: true,
        solicitadas: 2,
        devueltas: 2,
        estados: ['OK', 'OK'],
      }),
    }));
    const solveBody = cuerpos.find((body) => body.has('returnRoutes'));
    expect(solveBody.get('returnStops')).toBe('true');
    expect(solveBody.get('preserveFirstStop')).toBe('true');
    expect(solveBody.get('preserveLastStop')).toBe('true');
  });

  it('informa cuando ArcGIS ajustó la geometría de una parada devuelta', async () => {
    const arcgisConParadasAjustadas = (_url, init) => {
      const cuerpo = new URLSearchParams(init?.body);
      if (!cuerpo.has('returnRoutes')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ supportedTravelModes: [{ name: 'Walking Time' }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...fixtureArcgisOk(),
          stops: {
            features: [
              {
                geometry: { x: -75.6111, y: 6.1711 },
                attributes: { Status: 'OK', Sequence: 1 },
              },
              {
                geometry: { x: -75.6211, y: 6.1811 },
                attributes: { Status: 'OK', Sequence: 2 },
              },
            ],
          },
        }),
      });
    };
    vi.stubGlobal('fetch', mockFetchPorDominio(arcgisConParadasAjustadas, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk' });

    expect(res.status).toBe(200);
    expect(res.body.ajustesParadas.ajustadas).toBe(true);
  });

  it('cae a OSRM cuando ArcGIS falla por error de red', async () => {
    vi.stubGlobal('fetch', mockFetchPorDominio(fallaRed, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('osrm');
  });

  it('marca el fallback ArcGIS→OSRM con un motivo seguro y no registra el error crudo', async () => {
    const advertencias = [];
    const errores = [];
    const warnOriginal = console.warn;
    const errorOriginal = console.error;
    console.warn = (...args) => advertencias.push(args.map(String).join(' '));
    console.error = (...args) => errores.push(args.map(String).join(' '));
    vi.stubGlobal('fetch', mockFetchPorDominio(
      () => Promise.reject(new Error('token=super-secret arcgis network failure')),
      osrmOk,
    ));

    try {
      const res = await request(appDePrueba())
        .post('/api/rutas/resolver')
        .send({ origen, destino, modo: 'car' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        fuente: 'osrm',
        fallbackAplicado: true,
        motivo: 'arcgis-fallo',
        travelModeSolicitado: 'car',
        travelModeUtilizado: 'driving',
      }));
      expect(res.body.advertencias).toEqual(expect.arrayContaining(['arcgis-fallo']));
      expect(JSON.stringify(res.body)).not.toContain('super-secret');
      expect(advertencias.join('\n')).not.toContain('super-secret');
      expect(errores.join('\n')).not.toContain('super-secret');
    } finally {
      console.warn = warnOriginal;
      console.error = errorOriginal;
    }
  });

  it('declara el fallback OSRM cuando ArcGIS no está configurado', async () => {
    config.arcgis.apiKey = '';
    config.arcgis.clientId = '';
    config.arcgis.clientSecret = '';
    vi.stubGlobal('fetch', mockFetchPorDominio(arcgisOk, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      fuente: 'osrm',
      fallbackAplicado: true,
      motivo: 'arcgis-no-configurado',
      travelModeSolicitado: 'walk',
      travelModeUtilizado: 'foot',
    }));
    expect(res.body.advertencias).toEqual(expect.arrayContaining(['arcgis-no-configurado']));
  });

  it('cae a OSRM cuando ArcGIS responde con un status HTTP de error', async () => {
    vi.stubGlobal('fetch', mockFetchPorDominio(httpNoOk(503), osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'car' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('osrm');
  });

  it('cae a OSRM cuando ArcGIS responde 200 con un cuerpo de error (respuesta "obsoleta"/inválida)', async () => {
    vi.stubGlobal('fetch', mockFetchPorDominio(cuerpoConError, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('osrm');
  });

  it('devuelve 502 con un mensaje genérico cuando ArcGIS y el respaldo OSRM fallan los dos', async () => {
    const errores = [];
    const errorOriginal = console.error;
    console.error = (...args) => errores.push(args.map(String).join(' '));
    vi.stubGlobal('fetch', mockFetchPorDominio(
      () => Promise.reject(new Error('token=arcgis-secret')),
      () => Promise.reject(new Error('authorization=osrm-secret')),
    ));

    try {
      const res = await request(appDePrueba())
        .post('/api/rutas/resolver')
        .send({ origen, destino, modo: 'walk' });

      expect(res.status).toBe(502);
      expect(res.body).toEqual(expect.objectContaining({
        error: expect.stringMatching(/no se pudo calcular la ruta/i),
        fuente: null,
        fallbackAplicado: true,
        motivo: 'servicios-no-disponibles',
      }));
      expect(JSON.stringify(res.body)).not.toContain('secret');
      expect(errores.join('\n')).not.toContain('secret');
    } finally {
      console.error = errorOriginal;
    }
  });

  it('falls back to OSRM when ArcGIS exceeds the routing timeout', async () => {
    const timeoutAnterior = process.env.ROUTING_HTTP_TIMEOUT_MS;
    process.env.ROUTING_HTTP_TIMEOUT_MS = '20';
    const arcgisLento = (_url, init) => new Promise((_, reject) => {
      if (init?.signal?.aborted) {
        reject(init.signal.reason);
        return;
      }
      init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    });
    vi.stubGlobal('fetch', mockFetchPorDominio(arcgisLento, osrmOk));

    try {
      const res = await request(appDePrueba())
        .post('/api/rutas/resolver')
        .send({ origen, destino, modo: 'walk' });

      expect(res.status).toBe(200);
      expect(res.body.fuente).toBe('osrm');
    } finally {
      if (timeoutAnterior === undefined) delete process.env.ROUTING_HTTP_TIMEOUT_MS;
      else process.env.ROUTING_HTTP_TIMEOUT_MS = timeoutAnterior;
    }
  });

  it('expone la degradación cuando ArcGIS no publica un travel mode con tráfico', async () => {
    const cuerpos = [];
    vi.stubGlobal('fetch', mockFetchPorDominio((url, init) => {
      cuerpos.push(String(init?.body || ''));
      return arcgisOk();
    }, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'car', nombreDestino: 'Sitio de prueba' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('arcgis');
    expect(cuerpos.length).toBeGreaterThan(0);
    for (const cuerpo of cuerpos) {
      expect(cuerpo).not.toMatch(/startTime/i);
      expect(cuerpo).not.toMatch(/TravelTime/i);
    }
    expect(res.body.traficoSolicitado).toBe(true);
    expect(res.body.traficoAplicado).toBe(false);
    expect(res.body.degradacionTrafico).toBe('travel-mode-sin-impedancia-de-trafico');
  });

  it('nunca deja pasar coordenadas inválidas: responde 400 sin llamar a fetch', async () => {
    const fetchMock = mockFetchPorDominio(arcgisOk, osrmOk);
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen: { lat: 999, lng: -75.611 }, destino, modo: 'walk' });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
