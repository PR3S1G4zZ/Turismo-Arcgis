import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapaApi, rutasApi } from './api';

describe('rutasApi.resolver', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts origin before destination as { lat, lng } objects', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetch);
    const origin = { lat: 0, lng: 0 };
    const destination = { lat: 0.001, lng: 0.001 };

    await rutasApi.resolver(origin, destination, 'walk', 'Destino B');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rutas/resolver'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ origen: origin, destino: destination, modo: 'walk', nombreDestino: 'Destino B' }),
      }),
    );
  });

  it('forwards an optional abort signal to the route request', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();

    await rutasApi.resolver(
      { lat: 0, lng: 0 },
      { lat: 0.001, lng: 0.001 },
      'walk',
      'Destino B',
      { signal: controller.signal },
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rutas/resolver'),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe('mapaApi.token', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns only the public basemap key contract, never a routing OAuth token', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'basemap-public-test-key', proveedor: 'arcgis', motivo: null }),
    });
    vi.stubGlobal('fetch', fetch);

    const result = await mapaApi.token();

    expect(result).toEqual({ token: 'basemap-public-test-key', motivo: null, status: null });
    expect(result).not.toHaveProperty('clientSecret');
    expect(result).not.toHaveProperty('routingToken');
  });

  it('preserves an explicit missing-configuration fallback reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: null, proveedor: 'osm-fallback', motivo: 'not-configured' }),
    }));

    await expect(mapaApi.token()).resolves.toEqual({ token: null, motivo: 'not-configured', status: null });
  });

  it.each([
    [401, 'invalid-token'],
    [403, 'privilege-or-referrer'],
  ])('classifies HTTP %s without hiding the reason', async (status, motivo) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: 'basemap rejected' }),
    }));

    await expect(mapaApi.token()).resolves.toEqual({ token: null, motivo, status });
  });

  it('classifies a network failure as a visible fallback reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));

    await expect(mapaApi.token()).resolves.toEqual({ token: null, motivo: 'network', status: null });
  });
});
