import { afterEach, describe, expect, it, vi } from 'vitest';
import { rutasApi } from './api';

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
