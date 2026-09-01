import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useOrientacion', () => {
  beforeEach(() => {
    vi.resetModules();
    // Fuerza la rama "no requiere permiso" (Android/escritorio): sin
    // DeviceOrientationEvent.requestPermission definido, el hook arranca a
    // escuchar solo, sin gesto explícito del usuario (ver useOrientacion.js).
    delete window.DeviceOrientationEvent;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // jsdom no construye eventos de orientación nativos: se simulan asignando
  // las propiedades directamente sobre un Event genérico antes de despachar.
  function dispararOrientacion({ alpha, absolute = true } = {}) {
    const evento = new Event('deviceorientation');
    evento.absolute = absolute;
    evento.alpha = alpha;
    act(() => window.dispatchEvent(evento));
  }

  it('marks orientacion:cambio exactly once for a heading change that passes the throttle', async () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const { useOrientacion } = await import('./useOrientacion');
    const { result } = renderHook(() => useOrientacion());
    markSpy.mockClear();

    dispararOrientacion({ alpha: 90 });

    await waitFor(() => expect(result.current.heading).not.toBeNull());
    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'orientacion:cambio')).toHaveLength(1);
  });

  it('does not mark a second time for an event inside the ~100ms throttle window', async () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const { useOrientacion } = await import('./useOrientacion');
    const { result } = renderHook(() => useOrientacion());
    markSpy.mockClear();

    dispararOrientacion({ alpha: 90 });
    await waitFor(() => expect(result.current.heading).not.toBeNull());
    // Disparado justo a continuación, en el mismo tick de reloj real: cae
    // dentro de la ventana de throttle de ~100ms.
    dispararOrientacion({ alpha: 91 });

    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'orientacion:cambio')).toHaveLength(1);
  });

  it('does not mark when the event has no valid heading', async () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const { useOrientacion } = await import('./useOrientacion');
    const { result } = renderHook(() => useOrientacion());
    markSpy.mockClear();

    dispararOrientacion({ alpha: undefined, absolute: false });

    expect(result.current.heading).toBeNull();
    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'orientacion:cambio')).toHaveLength(0);
  });
});
