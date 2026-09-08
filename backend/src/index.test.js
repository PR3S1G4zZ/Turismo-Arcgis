import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './index.js';

describe('CSP del mapa', () => {
  it('permite style API, sprites, glyphs y tiles ArcGIS sin quitar worker blob', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];

    expect(res.status).toBe(200);
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://basemapstyles-api.arcgis.com');
    expect(csp).toContain('https://basemaps-api.arcgis.com');
    expect(csp).toContain('https://basemaps.arcgis.com');
    expect(csp).toContain('https://ibasemaps-api.arcgis.com');
    expect(csp).toContain('https://static-map-tiles-api.arcgis.com');
    expect(csp).toContain('worker-src');
    expect(csp).toContain('blob:');
  });
});
