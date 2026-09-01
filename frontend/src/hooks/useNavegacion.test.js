import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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
const routeAlternative = {
  puntos: [[0, 0], [0, 0.002]],
  pasos: [],
  distanciaM: 222,
  duracionMin: 3,
};

const posicionFuera = (extras = {}) => ({
  lat: 0.0005,
  lng: 0.00042,
  accuracy: 10,
  ...extras,
});

const cambiarGps = (rerender, position, timestamp) => {
  gps = { ...gps, position, ...(timestamp == null ? {} : { ultimaActualizacion: timestamp }) };
  rerender();
};

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

  afterEach(() => cleanup());

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
    await waitFor(() => expect(result.current.avanceRuta).toMatchObject({ indice: 0 }));
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

  it('does not recalculate for an isolated GPS jump that immediately returns to the route', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();

    act(() => cambiarGps(rerender, posicionFuera(), 2000));
    expect(result.current.estadoDesvio).toBe('candidato');
    act(() => cambiarGps(rerender, { lat: 0.0005, lng: 0, accuracy: 10 }, 3000));

    expect(resolver).not.toHaveBeenCalled();
    expect(result.current.estadoDesvio).toBe('normal');
  });

  it('confirms a precise deviation when optional speed and heading are absent', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();

    act(() => cambiarGps(rerender, posicionFuera(), 2000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 3000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 4000));

    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.rutaAplicada).toBe(true));
  });

  it('does not confirm a deviation whose accuracy makes the distance ambiguous', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();

    const imprecisa = posicionFuera({ accuracy: 45 });
    act(() => cambiarGps(rerender, imprecisa, 2000));
    act(() => cambiarGps(rerender, { ...imprecisa }, 3000));
    act(() => cambiarGps(rerender, { ...imprecisa }, 4000));

    expect(resolver).not.toHaveBeenCalled();
    expect(result.current.estadoDesvio).toBe('normal');
  });

  it('uses coherent speed and heading as corroborating evidence', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();

    const movimientoCoherente = posicionFuera({ speed: 10, heading: 40 });
    act(() => cambiarGps(rerender, movimientoCoherente, 6000));
    act(() => cambiarGps(rerender, { ...movimientoCoherente, speed: 0, heading: 0 }, 7000));
    act(() => cambiarGps(rerender, { ...movimientoCoherente, speed: 0, heading: 0 }, 8000));

    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
  });

  it('rejects a deviation contradicted by optional speed and heading', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();

    const saltoIncoherente = posicionFuera({ speed: 0, heading: 180 });
    act(() => cambiarGps(rerender, saltoIncoherente, 2000));
    act(() => cambiarGps(rerender, { ...saltoIncoherente }, 3000));
    act(() => cambiarGps(rerender, { ...saltoIncoherente }, 4000));

    expect(resolver).not.toHaveBeenCalled();
    expect(result.current.estadoDesvio).toBe('normal');
  });

  it('keeps a deviation candidate inside the hysteresis band until it returns below the exit threshold', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));

    act(() => cambiarGps(rerender, posicionFuera(), 2000));
    expect(result.current.estadoDesvio).toBe('candidato');

    act(() => cambiarGps(rerender, { lat: 0.0005, lng: 0.00036, accuracy: 10 }, 3000));
    expect(result.current.estadoDesvio).toBe('candidato');

    act(() => cambiarGps(rerender, { lat: 0.0005, lng: 0.00027, accuracy: 10 }, 4000));
    expect(result.current.estadoDesvio).toBe('normal');
  });

  it('does not count deviation readings spread beyond the confirmation window', async () => {
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();

    act(() => cambiarGps(rerender, posicionFuera(), 1000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 17001));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 18001));

    expect(resolver).not.toHaveBeenCalled();
    expect(result.current.estadoDesvio).toBe('candidato');
  });

  it('requests a confirmed deviation immediately without waiting for the legacy cooldown', async () => {
    let resolveRecalculo;
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    resolver.mockClear();
    resolver.mockImplementation(() => new Promise((resolve) => { resolveRecalculo = resolve; }));

    act(() => cambiarGps(rerender, posicionFuera(), 2000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 3000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 4000));

    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    expect(result.current.recalculando).toBe(true);
    expect(result.current.estadoDesvio).toBe('solicitado');
    await act(async () => resolveRecalculo(route));
  });

  it('applies only the latest recalculation response', async () => {
    const pending = [];
    resolver
      .mockResolvedValueOnce(route)
      .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const { result, rerender } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));

    act(() => cambiarGps(rerender, posicionFuera(), 2000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 3000));
    act(() => cambiarGps(rerender, { ...posicionFuera() }, 4000));
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(2));

    act(() => result.current.recalcularAhora());
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(3));

    await act(async () => pending[1](routeAlternative));
    await waitFor(() => expect(result.current.ruta?.puntos).toEqual(routeAlternative.puntos));
    expect(result.current.recalculando).toBe(false);

    await act(async () => pending[0](route));
    expect(result.current.ruta?.puntos).toEqual(routeAlternative.puntos);
    expect(result.current.estado).toBe('navegando');
  });

  it('ignores a pending route response after navigation is stopped', async () => {
    let resolveRoute;
    resolver.mockImplementationOnce(() => new Promise((resolve) => { resolveRoute = resolve; }));
    const { result } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(site, 'walk'));
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    act(() => result.current.detener());

    await act(async () => resolveRoute(route));
    expect(result.current.estado).toBe('inactivo');
    expect(result.current.ruta).toBeNull();
    expect(result.current.recalculando).toBe(false);
  });

  it('ignores the previous session response after starting a new destination', async () => {
    const pending = [];
    resolver.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const destinationA = { name: 'Destino A', lat: 0.001, lng: 0 };
    const destinationB = { name: 'Destino B', lat: 0, lng: 0.002 };
    const { result } = renderHook(() => useNavegacion());

    act(() => result.current.iniciar(destinationA, 'walk'));
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    act(() => result.current.iniciar(destinationB, 'walk'));
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(2));

    await act(async () => pending[0](route));
    expect(result.current.ruta).toBeNull();
    expect(result.current.estado).toBe('calculando');

    await act(async () => pending[1](routeAlternative));
    await waitFor(() => expect(result.current.estado).toBe('navegando'));
    expect(result.current.destino).toMatchObject({ nombre: 'Destino B', lat: 0, lng: 0.002 });
    expect(result.current.ruta?.puntos).toEqual(routeAlternative.puntos);
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
      gps = { ...gps, position: posicionFueraDeRuta, ultimaActualizacion: 2000 };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta }, ultimaActualizacion: 3000 };
      rerender();
      gps = { ...gps, position: { ...posicionFueraDeRuta }, ultimaActualizacion: 4000 };
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
});
