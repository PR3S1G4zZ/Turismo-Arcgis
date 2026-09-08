import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let success;
let failure;
let watchOptions;

function fix({ timestamp, accuracy = 10, latitude = 0, longitude = 0, heading = null, speed = null } = {}) {
  return {
    timestamp,
    coords: { latitude, longitude, accuracy, heading, speed },
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
    expect(watchOptions).toEqual({ enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
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
    expect(result.current.gpsConfiable).toBe(true);
    expect(result.current.calidadGps).toBe('degradada');
    expect(result.current.ultimaActualizacion).toBe(now);
  });

  it('exposes each accepted fix without smoothing it for navigation', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    act(() => success(fix({ timestamp: now + 2000, latitude: 0.001, longitude: 0.001 })));

    expect(result.current.position).toMatchObject({ lat: 0.001, lng: 0.001 });
  });

  it('rejects a newer fix that is older than ten seconds during live tracking', async () => {
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: Date.now() - 10001 })));

    expect(result.current.gpsConfiable).toBe(false);
    expect(result.current.position).toBeNull();
  });

  it('rejects a fix whose accuracy radius exceeds 50 metres', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, accuracy: 51 })));

    await waitFor(() => expect(result.current.gpsConfiable).toBe(false));
    expect(result.current.position).toBeNull();
    expect(result.current.calidadGps).toBe('sin_senal');
    expect(result.current.ultimaActualizacion).toBeNull();
  });

  it('rejects fixes with non-finite or out-of-range coordinates', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: Number.NaN })));

    expect(result.current.position).toBeNull();
    expect(result.current.gpsConfiable).toBe(false);
  });

  it('rejects a fix whose device clock is materially in the future', async () => {
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: Date.now() + 30001 })));

    expect(result.current.position).toBeNull();
    expect(result.current.gpsConfiable).toBe(false);
  });

  it('rejects a physically impossible jump instead of moving the trusted position', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));
    act(() => success(fix({ timestamp: now + 1000, latitude: 1, longitude: 0 })));

    expect(result.current.position).toMatchObject({ lat: 0, lng: 0 });
    expect(result.current.gpsConfiable).toBe(true);
    expect(result.current.calidadGps).toBe('degradada');
    expect(result.current.ultimaActualizacion).toBe(now);
  });

  it('keeps the last trusted baseline after an isolated outlier', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));
    act(() => success(fix({ timestamp: now + 1000, latitude: 1, longitude: 0 })));
    act(() => success(fix({ timestamp: now + 2000, latitude: 1.1, longitude: 0 })));

    expect(result.current.position).toMatchObject({ lat: 0, lng: 0 });
    expect(result.current.ultimaActualizacion).toBe(now);
    expect(result.current.gpsConfiable).toBe(true);
    expect(result.current.calidadGps).toBe('degradada');
  });

  it('reports signal loss (not imprecision) for an outlier past the grace window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));

    // Pasa el período de gracia (8 s) sin ninguna lectura nueva: ya no hay un
    // fix reciente que conservar (el temporizador de vigencia de posición aún
    // no dispara a los 8 s -- lo hace a los 10 s -- así que la comprobación
    // real ocurre dentro de `invalidarLectura` al llegar la siguiente lectura).
    act(() => vi.advanceTimersByTime(8001));

    // Llega un outlier (salto no plausible) después de perdida la gracia.
    act(() => success(fix({ timestamp: now + 8500, latitude: 5, longitude: 5 })));

    // No hay un fix reciente conservado: debe reportarse pérdida de señal, no
    // "imprecisión" (que implicaría que la última posición sigue siendo válida).
    expect(result.current.gpsConfiable).toBe(false);
    expect(result.current.calidadGps).toBe('sin_senal');
  });

  it('preserves a trusted coordinate and keeps grace trust after a timeout', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));
    act(() => failure({ code: 3, message: 'timeout' }));

    expect(result.current.position).toMatchObject({ lat: 0, lng: 0 });
    expect(result.current.posicionSimulada).toBe(false);
    expect(result.current.gpsConfiable).toBe(true);
    expect(result.current.calidadGps).toBe('sin_senal');
  });

  it('marks gps:aceptado exactly once when a fix is accepted', async () => {
    const now = Date.now();
    const markSpy = vi.spyOn(performance, 'mark');
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    // Limpia cualquier llamada residual de montajes de tests previos que
    // sigan vivos (este archivo no desmonta los renderHook entre tests):
    // solo interesan las marcas producidas por ESTA fijación.
    markSpy.mockClear();
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    await waitFor(() => expect(result.current.gpsConfiable).toBe(true));

    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'gps:aceptado')).toHaveLength(1);
  });

  it('does not mark gps:aceptado when a fix is rejected for low accuracy', async () => {
    const now = Date.now();
    const markSpy = vi.spyOn(performance, 'mark');
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    markSpy.mockClear();
    act(() => success(fix({ timestamp: now, accuracy: 51 })));

    await waitFor(() => expect(result.current.gpsConfiable).toBe(false));
    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'gps:aceptado')).toHaveLength(0);
  });

  it('keeps a valid GPS heading while moving', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, heading: 92, speed: 1.2 })));

    expect(result.current.position.heading).toBe(92);
  });

  it('clears the last GPS heading when the live signal is lost', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, heading: 92, speed: 1.2 })));
    await waitFor(() => expect(result.current.position.heading).toBe(92));
    act(() => failure({ code: 3, message: 'timeout' }));

    // Un timeout aislado conserva el rumbo todavía vigente; la política de
    // vigencia lo elimina sin intervención cuando pasan cinco segundos.
    expect(result.current.position.heading).toBe(92);
    expect(result.current.gpsConfiable).toBe(true);
    act(() => vi.advanceTimersByTime(5001));
    expect(result.current.position.heading).toBeNull();
    expect(result.current.gpsConfiable).toBe(true);
  });

  it('deduces a movement heading from two sufficiently distant fixes', async () => {
    const now = Date.now();
    const { useGeolocation } = await import('./useGeolocation');
    const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

    await waitFor(() => expect(success).toBeTypeOf('function'));
    act(() => success(fix({ timestamp: now, latitude: 0, longitude: 0 })));
    act(() => success(fix({ timestamp: now + 1, latitude: 0.0001, longitude: 0 })));

    expect(result.current.position.heading).toBeCloseTo(0, 0);
  });

  it('clears the previous GPS watch before changing accuracy and on unmount', async () => {
    const { useGeolocation } = await import('./useGeolocation');
    const clearWatch = navigator.geolocation.clearWatch;
    const { rerender, unmount } = renderHook(
      ({ precisionAlta }) => useGeolocation({ precisionAlta }),
      { initialProps: { precisionAlta: true } },
    );

    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1));
    rerender({ precisionAlta: false });
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2));
    expect(clearWatch).toHaveBeenCalledWith(7);

    unmount();
    expect(clearWatch).toHaveBeenCalledTimes(2);
    expect(clearWatch).toHaveBeenLastCalledWith(7);
  });
});
