import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let success;
let failure;
let watchOptions;

function fix({ timestamp, accuracy = 10, latitude = 0, longitude = 0 } = {}) {
  return {
    timestamp,
    coords: { latitude, longitude, accuracy, heading: null, speed: null },
  };
}

describe('useGeolocation', () => {
  beforeEach(() => {
    success = undefined;
    failure = undefined;
    watchOptions = undefined;
    vi.resetModules();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((onSuccess, onError, options) => {
          success = onSuccess;
          failure = onError;
          watchOptions = options;
          return 7;
        }),
        clearWatch: vi.fn(),
      },
    });
  });

  afterEach(() => vi.useRealTimers());

  it('uses the live watch policy while navigating', async () => {
    const { useGeolocation } = await import('./useGeolocation');
    renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(watchOptions).toBeDefined());
    expect(watchOptions).toEqual({ enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 });
  });

  it('keeps the last trusted fix when a stale timestamp arrives', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));
    act(() => success(fix({ timestamp: now - 1, latitude: 1, longitude: 1 })));

    expect(result.current.position).toMatchObject({ lat: 0, lng: 0 });
    expect(result.current.gpsConfiable).toBe(false);
    expect(result.current.ultimaActualizacion).toBe(now);
  });

  it('rejects a fix whose accuracy radius exceeds 50 metres', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, accuracy: 51 })));

    await waitFor(() => expect(result.current.gpsConfiable).toBe(false));
    expect(result.current.position).toBeNull();
    expect(result.current.ultimaActualizacion).toBeNull();
  });

  it('preserves a trusted coordinate and suspends trust after a timeout', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));
    act(() => failure({ code: 3, message: 'timeout' }));

    expect(result.current.position).toMatchObject({ lat: 0, lng: 0 });
    expect(result.current.posicionSimulada).toBe(false);
    expect(result.current.gpsConfiable).toBe(false);
  });
});
