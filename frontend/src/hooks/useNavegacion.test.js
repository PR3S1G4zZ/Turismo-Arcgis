import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resolver, precisionArgs } = vi.hoisted(() => ({ resolver: vi.fn(), precisionArgs: [] }));
let gps;

vi.mock('../utilidades/api', () => ({ rutasApi: { resolver } }));
vi.mock('./useGeolocation', () => ({
  useGeolocation: (options) => {
    precisionArgs.push(options);
    return gps;
  },
}));

import { useNavegacion } from './useNavegacion';
import { TRAMOS } from '../utilidades/diagnosticoLatencias';

const route = {
  puntos: [[0, 0], [0.001, 0]],
  pasos: [],
  distanciaM: 111,
  duracionMin: 2,
};
const site = { name: 'Destino B', lat: 0.001, lng: 0 };

describe('useNavegacion', () => {
  beforeEach(() => {
    resolver.mockReset();
    precisionArgs.length = 0;
    resolver.mockResolvedValue(route);
    gps = {
      position: { lat: 0, lng: 0, accuracy: 10 },
      isSimulated: false,
      gpsConfiable: true,
      loading: false,
      error: null,
      permiso: 'granted',
      reintentar: vi.fn(),
    };
  });

  it('sends origin then destination when it requests route A to B', async () => {
    const { result } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));

    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    expect(resolver).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 0, lng: 0 }),
      expect.objectContaining({ lat: 0.001, lng: 0, nombre: 'Destino B' }),
      'walk',
      'Destino B',
    );
  });

  it('keeps a manual origin route as a static preview', async () => {
    gps = { ...gps, position: { lat: 1, lng: 1 }, isSimulated: true, gpsConfiable: false };
    const { result, rerender } = renderHook(() => useNavegacion());
    act(() => result.current.setOrigenManual({ lat: 0, lng: 0 }));
    act(() => result.current.iniciar(site, 'walk'));

    await waitFor(() => expect(result.current.estado).toBe('previsualizando'));
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(result.current.fueraDeRuta).toBe(false);

    gps = { ...gps, position: { lat: 2, lng: 2 } };
    rerender();
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(result.current.avance).toBeUndefined();

    gps = { ...gps, isSimulated: false, gpsConfiable: true };
    rerender();
    expect(result.current.estado).toBe('previsualizando');
    expect(precisionArgs.at(-1)).toEqual({ precisionAlta: false });
  });

  describe('instrumentación de diagnóstico (Fase 1, DIAG-01)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      performance.clearMarks();
      performance.clearMeasures();
    });

    it('mide el tramo solicitud→respuesta ArcGIS al resolver la ruta', async () => {
      const measureSpy = vi.spyOn(performance, 'measure');
      const { result } = renderHook(() => useNavegacion());

      act(() => result.current.iniciar(site, 'walk'));

      await waitFor(() => expect(result.current.estado).toBe('navegando'));

      expect(measureSpy).toHaveBeenCalledWith(
        TRAMOS.SOLICITUD_RESPUESTA_ARCGIS,
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
