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
const arcgisOk = () => Promise.resolve({ ok: true, json: async () => fixtureArcgisOk() });

describe('POST /api/rutas/resolver — contrato ArcGIS/OSRM (HARDEN-01)', () => {
  let apiKeyOriginal;

  beforeEach(() => {
    apiKeyOriginal = config.arcgis.apiKey;
    config.arcgis.apiKey = 'test-key'; // hayArcgis() === true; nunca se usan credenciales reales.
  });

  afterEach(() => {
    config.arcgis.apiKey = apiKeyOriginal;
    vi.unstubAllGlobals();
  });

  it('responde con la ruta de ArcGIS cuando el servicio funciona', async () => {
    vi.stubGlobal('fetch', mockFetchPorDominio(arcgisOk, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk', nombreDestino: 'Parque de prueba' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('arcgis');
    expect(res.body.puntos.length).toBeGreaterThan(0);
  });

  it('cae a OSRM cuando ArcGIS falla por error de red', async () => {
    vi.stubGlobal('fetch', mockFetchPorDominio(fallaRed, osrmOk));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk' });

    expect(res.status).toBe(200);
    expect(res.body.fuente).toBe('osrm');
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
    vi.stubGlobal('fetch', mockFetchPorDominio(fallaRed, fallaRed));

    const res = await request(appDePrueba())
      .post('/api/rutas/resolver')
      .send({ origen, destino, modo: 'walk' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/no se pudo calcular la ruta/i);
  });

  it('hoy no envía startTime ni TravelTime en el body hacia ArcGIS (TRAFFIC-01 aún no existe)', async () => {
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
    expect(res.body).not.toHaveProperty('traficoSolicitado');
    expect(res.body).not.toHaveProperty('traficoDisponible');
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

describe('Pendiente de fases futuras del milestone (placeholders — CONTEXT.md 07 D-01)', () => {
  // Estos casos dependen de código que todavía no existe en el repo. Se
  // dejan como `it.todo` explícitos en vez de simular una implementación
  // falsa. Referencia: .planning/ROADMAP.md Phase 6 (TRAFFIC-01/02) y
  // .planning/phases/07-endurecimiento-y-uat/07-CONTEXT.md decisión D-01.

  it.todo(
    'incluye startTime=now en la solicitud a ArcGIS cuando el modo es "car" y hay tráfico disponible (TRAFFIC-01, Fase 6)'
  );
  it.todo(
    'no incluye startTime en la solicitud cuando el modo es "walk" (el peatonal permanece sin tráfico, TRAFFIC-01, Fase 6)'
  );
  it.todo(
    'la respuesta normalizada indica si se solicitó tráfico y si estuvo disponible, degradando con claridad sin cobertura (TRAFFIC-01, Fase 6)'
  );
  it.todo(
    'una respuesta de ArcGIS que tarda más que el timeout configurado se trata como fallo y cae a OSRM ' +
    '(hoy `pedirJson`/`solve` no implementan ningún timeout — no hay AbortController en arcgisRouting.js; ' +
    'este caso requiere que una fase futura defina el mecanismo de timeout antes de poder probarse de verdad)'
  );
});
