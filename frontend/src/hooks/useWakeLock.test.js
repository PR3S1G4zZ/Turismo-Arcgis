import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock, WAKE_LOCK_ESTADOS } from './useWakeLock';

function crearSentinel() {
  let releaseHandler = null;
  return {
    addEventListener: vi.fn((tipo, handler) => {
      if (tipo === 'release') releaseHandler = handler;
    }),
    removeEventListener: vi.fn((tipo, handler) => {
      if (tipo === 'release' && releaseHandler === handler) releaseHandler = null;
    }),
    release: vi.fn(() => Promise.resolve()),
    emitirRelease() {
      releaseHandler?.({ type: 'release' });
    },
  };
}

function definirWakeLock(wakeLock) {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: wakeLock,
  });
}

function definirVisibilidad(valor) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: valor,
  });
}

describe('useWakeLock', () => {
  beforeEach(() => {
    definirVisibilidad('visible');
    delete navigator.wakeLock;
  });

  afterEach(() => {
    cleanup();
    delete navigator.wakeLock;
    delete document.visibilityState;
  });

  it('degrada de forma segura cuando el navegador no soporta Wake Lock', async () => {
    const { result } = renderHook(() => useWakeLock(true));

    await waitFor(() => expect(result.current.estado).toBe(WAKE_LOCK_ESTADOS.NO_SOPORTADO));
    expect(result.current.necesitaAviso).toBe(true);
    expect(result.current.activo).toBe(false);
  });

  it('solicita screen y libera el sentinel al desactivar', async () => {
    const sentinel = crearSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    definirWakeLock({ request });
    const { result, rerender } = renderHook(({ activo }) => useWakeLock(activo), {
      initialProps: { activo: true },
    });

    await waitFor(() => expect(result.current.activo).toBe(true));
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ activo: false });
    await waitFor(() => expect(result.current.estado).toBe(WAKE_LOCK_ESTADOS.INACTIVO));
    expect(sentinel.release).toHaveBeenCalledTimes(1);
    expect(sentinel.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('libera el sentinel vigente al desmontar', async () => {
    const sentinel = crearSentinel();
    definirWakeLock({ request: vi.fn().mockResolvedValue(sentinel) });
    const { result, unmount } = renderHook(() => useWakeLock(true));

    await waitFor(() => expect(result.current.activo).toBe(true));
    unmount();

    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('detecta release del sistema y reintenta una sola vez al volver a visible', async () => {
    const primero = crearSentinel();
    const segundo = crearSentinel();
    const request = vi.fn()
      .mockResolvedValueOnce(primero)
      .mockResolvedValueOnce(segundo);
    definirWakeLock({ request });
    const { result } = renderHook(() => useWakeLock(true));

    await waitFor(() => expect(result.current.activo).toBe(true));
    act(() => primero.emitirRelease());
    await waitFor(() => expect(result.current.estado).toBe(WAKE_LOCK_ESTADOS.LIBERADO));
    expect(result.current.necesitaAviso).toBe(true);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    definirVisibilidad('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    definirVisibilidad('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.activo).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith('screen');
  });

  it('convierte el rechazo de request en estado no fatal', async () => {
    const request = vi.fn().mockRejectedValue(new Error('permission denied'));
    definirWakeLock({ request });
    const { result } = renderHook(() => useWakeLock(true));

    await waitFor(() => expect(result.current.estado).toBe(WAKE_LOCK_ESTADOS.DENEGADO));
    expect(result.current.necesitaAviso).toBe(true);
  });

  it('libera una respuesta tardía después de cancelar y no reactiva el lock', async () => {
    let resolver;
    const request = vi.fn().mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    definirWakeLock({ request });
    const { result, rerender } = renderHook(({ activo }) => useWakeLock(activo), {
      initialProps: { activo: true },
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    rerender({ activo: false });
    await waitFor(() => expect(result.current.estado).toBe(WAKE_LOCK_ESTADOS.INACTIVO));

    const sentinelTardio = crearSentinel();
    await act(async () => {
      resolver(sentinelTardio);
      await Promise.resolve();
    });

    expect(sentinelTardio.release).toHaveBeenCalledTimes(1);
    expect(result.current.activo).toBe(false);
    expect(result.current.estado).toBe(WAKE_LOCK_ESTADOS.INACTIVO);
  });
});
