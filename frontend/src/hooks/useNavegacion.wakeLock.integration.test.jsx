import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resolver, gps } = vi.hoisted(() => ({
  resolver: vi.fn(),
  gps: {},
}));

vi.mock('../utilidades/api', () => ({ rutasApi: { resolver } }));
vi.mock('./useGeolocation', () => ({
  useGeolocation: () => gps,
}));

import { useNavegacion } from './useNavegacion';
import { WAKE_LOCK_ESTADOS } from './useWakeLock';

const route = {
  puntos: [[0, 0], [0.001, 0]],
  pasos: [],
  distanciaM: 111,
  duracionMin: 2,
};
const site = { name: 'Destino demo', lat: 0.001, lng: 0 };

function crearSentinel() {
  let releaseHandler;
  return {
    released: false,
    addEventListener: vi.fn((tipo, handler) => {
      if (tipo === 'release') releaseHandler = handler;
    }),
    removeEventListener: vi.fn(),
    release: vi.fn(() => Promise.resolve()),
    emitirRelease: () => releaseHandler?.(),
  };
}

function definirWakeLock(wakeLock) {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: wakeLock,
  });
}

describe('useNavegacion + Wake Lock integration', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    resolver.mockReset();
    resolver.mockResolvedValue(route);
    Object.assign(gps, {
      position: { lat: 0, lng: 0, accuracy: 10 },
      isSimulated: false,
      gpsConfiable: true,
      loading: false,
      error: null,
      permiso: 'granted',
      reintentar: vi.fn(),
    });
    delete navigator.wakeLock;
  });

  afterEach(() => {
    cleanup();
    delete navigator.wakeLock;
    delete document.visibilityState;
  });

  it('acquires once for live navigation and releases on stop', async () => {
    const sentinel = crearSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    definirWakeLock({ request });
    const { result } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    await waitFor(() => expect(result.current.wakeLock.activo).toBe(true));
    expect(request).toHaveBeenCalledTimes(1);

    act(() => result.current.detener());
    await waitFor(() => expect(result.current.wakeLock.estado).toBe(WAKE_LOCK_ESTADOS.INACTIVO));
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('does not request Wake Lock for a manual preview', async () => {
    const request = vi.fn();
    definirWakeLock({ request });
    Object.assign(gps, {
      position: { lat: 1, lng: 1 },
      isSimulated: true,
      gpsConfiable: false,
    });
    const { result } = renderHook(() => useNavegacion());

    act(() => result.current.setOrigenManual({ lat: 1, lng: 1 }));
    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('previsualizando'));

    expect(request).not.toHaveBeenCalled();
    expect(result.current.wakeLock.estado).toBe(WAKE_LOCK_ESTADOS.INACTIVO);
  });

  it('keeps the same Wake Lock while an automatic recalculation is active', async () => {
    const sentinel = crearSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    const pendientes = [];
    definirWakeLock({ request });
    resolver
      .mockResolvedValueOnce(route)
      .mockImplementation(() => new Promise((resolve) => pendientes.push(resolve)));
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    await waitFor(() => expect(result.current.wakeLock.activo).toBe(true));

    const fuera = { lat: 0.0005, lng: 0.00042, accuracy: 10 };
    for (const [position, timestamp] of [
      [fuera, 2000],
      [{ ...fuera }, 3000],
      [{ ...fuera }, 4000],
    ]) {
      Object.assign(gps, { position, ultimaActualizacion: timestamp });
      rerender();
    }

    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(2));
    expect(result.current.recalculando).toBe(true);
    expect(result.current.wakeLock.activo).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => pendientes[0](route));
    await waitFor(() => expect(result.current.recalculando).toBe(false));
    expect(result.current.wakeLock.activo).toBe(true);
  });
});
