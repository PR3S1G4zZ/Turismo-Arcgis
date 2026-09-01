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
import { MARCAS, TRAMOS } from '../utilidades/diagnosticoLatencias';

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

    it('marca desvio:detectado una sola vez por ciclo y mide diag:desvio-solicitud al recalcular', async () => {
      const markSpy = vi.spyOn(performance, 'mark');
      const measureSpy = vi.spyOn(performance, 'measure');
      const { result, rerender } = renderHook(() => useNavegacion());

      act(() => result.current.iniciar(site, 'walk'));
      await waitFor(() => expect(result.current.estado).toBe('navegando'));
      resolver.mockClear();
      markSpy.mockClear();
      measureSpy.mockClear();

      // Salta ESPERA_ENTRE_RECALCULOS_MS (15 s) para que el recálculo no
      // quede bloqueado por el temporizador: el test corre en milisegundos reales.
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 20000);

      // Posición fuera de ruta (~46 m de desviación, dentro del segmento de
      // la ruta mockeada) repetida 3 veces: umbral de recálculo del hook.
      const posicionFueraDeRuta = { lat: 0.0005, lng: 0.00042, accuracy: 10 };
      gps = { ...gps, position: posicionFueraDeRuta };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta } };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta } };
      rerender();

      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));

      const llamadasDesvio = markSpy.mock.calls.filter((args) => args[0] === MARCAS.DESVIO_DETECTADO);
      expect(llamadasDesvio).toHaveLength(1);
      expect(measureSpy).toHaveBeenCalledWith(
        TRAMOS.DESVIO_SOLICITUD,
        MARCAS.DESVIO_DETECTADO,
        MARCAS.RECALCULO_SOLICITADO,
      );
    });
  });

  describe('persistencia de desvío actual (3 lecturas / 15 s — no es histéresis RECALC-01)', () => {
    const posicionFueraDeRuta = { lat: 0.0005, lng: 0.00042, accuracy: 10 };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does not recalculate after only two off-route fixes', async () => {
      const { result, rerender } = renderHook(() => useNavegacion());
      act(() => result.current.iniciar(site, 'walk'));
      await waitFor(() => expect(result.current.estado).toBe('navegando'));
      resolver.mockClear();
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 20000);

      gps = { ...gps, position: posicionFueraDeRuta };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta } };
      rerender();

      expect(resolver).not.toHaveBeenCalled();
      expect(result.current.fueraDeRuta).toBe(true);
    });

    it('resets the off-route counter when the fix returns to the polyline', async () => {
      const { result, rerender } = renderHook(() => useNavegacion());
      act(() => result.current.iniciar(site, 'walk'));
      await waitFor(() => expect(result.current.estado).toBe('navegando'));
      resolver.mockClear();
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 20000);

      gps = { ...gps, position: posicionFueraDeRuta };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta } };
      rerender();
      gps = { ...gps, position: { lat: 0.0004, lng: 0, accuracy: 10 } };
      rerender();
      gps = { ...gps, position: posicionFueraDeRuta };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta } };
      rerender();

      expect(resolver).not.toHaveBeenCalled();
    });
  });

  describe('Pendiente de Fase 3 (RECALC-01/02)', () => {
    it.todo('un salto GPS aislado incoherente con precisión/velocidad/dirección no incrementa el recálculo (RECALC-02)');
    it.todo('un desvío confirmado no espera ESPERA_ENTRE_RECALCULOS_MS artificial extra (RECALC-02)');
    it.todo('histéresis de entrada/salida de desviado con señales múltiples (RECALC-01)');
    it.todo('respuestas de recálculo obsoletas se ignoran cuando hay una solicitud más nueva (RECALC-02)');
  });
});

