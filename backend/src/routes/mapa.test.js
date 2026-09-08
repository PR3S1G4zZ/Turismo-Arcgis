// Contrato público del basemap: la key que llega al navegador está separada
// de las credenciales privadas que usa arcgisRouting.js.
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config.js';
import { mapaRouter } from './mapa.js';

function appDePrueba() {
  const app = express();
  app.use('/api/mapa', mapaRouter);
  return app;
}

describe('GET /api/mapa/token y /api/mapa/estado', () => {
  let original;

  beforeEach(() => {
    original = {
      basemapApiKey: config.arcgis.basemapApiKey,
      apiKey: config.arcgis.apiKey,
      clientId: config.arcgis.clientId,
      clientSecret: config.arcgis.clientSecret,
    };
  });

  afterEach(() => {
    Object.assign(config.arcgis, original);
  });

  it('entrega solo la key pública del basemap y nunca la credencial de routing', async () => {
    config.arcgis.basemapApiKey = 'basemap-public-test-key';
    config.arcgis.apiKey = 'routing-private-test-key';
    config.arcgis.clientSecret = 'routing-client-secret-test';

    const res = await request(appDePrueba()).get('/api/mapa/token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: 'basemap-public-test-key', proveedor: 'arcgis', motivo: null });
    expect(JSON.stringify(res.body)).not.toContain('routing-private-test-key');
    expect(JSON.stringify(res.body)).not.toContain('routing-client-secret-test');
  });

  it('declara el fallback explícito cuando no existe una key de basemap', async () => {
    config.arcgis.basemapApiKey = '';
    config.arcgis.apiKey = '';
    config.arcgis.clientId = '';
    config.arcgis.clientSecret = '';

    const res = await request(appDePrueba()).get('/api/mapa/token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: null, proveedor: 'osm-fallback', motivo: 'not-configured' });
  });

  it('expone basemap y proveedor real de rutas sin secretos ni coordenadas', async () => {
    config.arcgis.basemapApiKey = 'basemap-public-test-key';
    config.arcgis.apiKey = 'routing-private-test-key';

    const res = await request(appDePrueba()).get('/api/mapa/estado');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ basemap: 'arcgis', motivoBasemap: null, proveedorRutas: 'arcgis' });
    expect(JSON.stringify(res.body)).not.toMatch(/key|secret|token|lat|lng/i);
  });

  it('declara OSM y OSRM cuando ninguna credencial está disponible', async () => {
    config.arcgis.basemapApiKey = '';
    config.arcgis.apiKey = '';
    config.arcgis.clientId = '';
    config.arcgis.clientSecret = '';

    const res = await request(appDePrueba()).get('/api/mapa/estado');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ basemap: 'osm-fallback', motivoBasemap: 'not-configured', proveedorRutas: 'osrm' });
  });
});
