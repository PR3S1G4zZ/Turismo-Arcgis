import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrientacion } from './useOrientacion';

function eventoRumbo(tipo, rumbo) {
  const evento = new Event(tipo);
  Object.defineProperty(evento, 'absolute', { value: true });
  Object.defineProperty(evento, 'alpha', { value: 360 - rumbo });
  return evento;
}

describe('useOrientacion', () => {
  beforeEach(() => {
    // El test fija explícitamente la ruta de fallback para que el contrato de
    // una sola suscripción no dependa de las capacidades declaradas por jsdom.
    delete window.ondeviceorientationabsolute;
  });

  afterEach(() => {
    cleanup();
    delete window.ondeviceorientationabsolute;
    vi.restoreAllMocks();
  });

  it('registra una sola suscripción efectiva aunque activar se llame varias veces', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { result, unmount } = renderHook(() => useOrientacion());

    const llamadasOrientacion = () => addSpy.mock.calls.filter(([tipo]) => tipo.startsWith('deviceorientation'));
    const remocionesOrientacion = () => removeSpy.mock.calls.filter(([tipo]) => tipo.startsWith('deviceorientation'));
    await waitFor(() => expect(llamadasOrientacion().length).toBeGreaterThan(0));
    act(() => {
      result.current.activar();
      result.current.activar();
    });

    expect(llamadasOrientacion().length - remocionesOrientacion().length).toBe(1);
    unmount();
    expect(remocionesOrientacion().length).toBe(llamadasOrientacion().length);
  });

  it('publica la hora de la última lectura de brújula válida', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { result } = renderHook(() => useOrientacion());

    await waitFor(() => expect(result.current.heading).toBeNull());
    act(() => window.dispatchEvent(eventoRumbo('deviceorientation', 90)));

    await waitFor(() => expect(result.current.heading).toBe(90));
    expect(result.current.ultimaActualizacion).toBe(now);
  });

  it('no procesa el evento absoluto equivalente cuando usa el evento fallback', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = renderHook(() => useOrientacion());
    await waitFor(() => expect(addSpy.mock.calls.some(([tipo]) => tipo === 'deviceorientation')).toBe(true));

    act(() => window.dispatchEvent(eventoRumbo('deviceorientation', 90)));
    await waitFor(() => expect(result.current.heading).toBe(90));
    act(() => window.dispatchEvent(eventoRumbo('deviceorientationabsolute', 180)));

    expect(result.current.heading).toBe(90);
  });

  it('marks orientacion:cambio exactly once for a valid heading', async () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const { result } = renderHook(() => useOrientacion());
    markSpy.mockClear();

    act(() => window.dispatchEvent(eventoRumbo('deviceorientation', 270)));

    await waitFor(() => expect(result.current.heading).not.toBeNull());
    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'orientacion:cambio')).toHaveLength(1);
  });

  it('does not mark a second heading inside the throttle window', async () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const { result } = renderHook(() => useOrientacion());
    markSpy.mockClear();

    act(() => window.dispatchEvent(eventoRumbo('deviceorientation', 270)));
    await waitFor(() => expect(result.current.heading).not.toBeNull());
    act(() => window.dispatchEvent(eventoRumbo('deviceorientation', 269)));

    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'orientacion:cambio')).toHaveLength(1);
  });

  it('does not mark an event without a valid heading', () => {
    const markSpy = vi.spyOn(performance, 'mark');
    const { result } = renderHook(() => useOrientacion());
    markSpy.mockClear();

    const evento = new Event('deviceorientation');
    Object.defineProperty(evento, 'absolute', { value: false });
    act(() => window.dispatchEvent(evento));

    expect(result.current.heading).toBeNull();
    expect(markSpy.mock.calls.filter(([nombre]) => nombre === 'orientacion:cambio')).toHaveLength(0);
  });
});
