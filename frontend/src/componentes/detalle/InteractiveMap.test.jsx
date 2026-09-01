import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavegacionContext } from '../../contexto/NavegacionContext';

const map = {
  stop: vi.fn(),
  easeTo: vi.fn(),
  fitBounds: vi.fn(),
  getZoom: vi.fn(() => 16),
  getBearing: vi.fn(() => 23),
  cooperativeGestures: { enable: vi.fn(), disable: vi.fn() },
};
let mapProps;

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('./InteractiveMap.css', () => ({}));

vi.mock('react-map-gl/maplibre', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props, ref) => {
      const { onLoad, children } = props;
      mapProps = props;
      React.useImperativeHandle(ref, () => map);
      React.useEffect(() => onLoad?.({ target: map }), [onLoad]);
      return <div data-testid="map">{children}</div>;
    }),
    Marker: ({ children }) => <>{children}</>,
    Popup: ({ children }) => <>{children}</>,
    Source: ({ children }) => <>{children}</>,
    Layer: () => null,
    NavigationControl: () => null,
  };
});

vi.mock('../../hooks/useOrientacion', () => ({
  useOrientacion: () => ({ heading: null, necesitaPermiso: false, permiso: 'concedido', activar: vi.fn() }),
}));

vi.mock('../../utilidades/api', () => ({ mapaApi: { token: vi.fn().mockResolvedValue('token') } }));

import { InteractiveMap } from './InteractiveMap';

const site = { name: 'Destino', lat: '6.17', lng: '-75.61', address: 'Itagüí' };
const puntos = [[6.17, -75.61], [6.18, -75.62]];
const position = { lat: 6.171, lng: -75.611, heading: 90, accuracy: 5, speed: 1 };

function navigation(overrides = {}) {
  return {
    posicion: position,
    posicionSimulada: false,
    gpsConfiable: true,
    tramos: { recorrido: [], restante: puntos },
    ruta: { puntos },
    navegando: true,
    llegado: false,
    previsualizando: false,
    ...overrides,
  };
}

function renderMap(value, props = { showRoute: true }) {
  return render(
    <NavegacionContext.Provider value={value}>
      <InteractiveMap site={site} {...props} />
    </NavegacionContext.Provider>
  );
}

describe('InteractiveMap camera lifecycle', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    map.getZoom.mockReturnValue(16);
    map.getBearing.mockReturnValue(23);
  });

  it('keeps the preview route framed without starting live follow', async () => {
    renderMap(navigation({ navegando: false, previsualizando: true, gpsConfiable: false }));

    await waitFor(() => expect(map.fitBounds).toHaveBeenCalledTimes(1));
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('owns a trusted live camera update by stopping before a short course-up ease', async () => {
    renderMap(navigation());

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.stop).toHaveBeenCalledBefore(map.easeTo);
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({
      center: [-75.611, 6.171], bearing: 90, pitch: 50, duration: 250,
    }));
  });

  it('keeps the current bearing while following live GPS with no finite heading', async () => {
    renderMap(navigation({ posicion: { ...position, heading: null } }));

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.stop).toHaveBeenCalledBefore(map.easeTo);
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({
      center: [-75.611, 6.171], bearing: 23, pitch: 50, duration: 250,
    }));
  });

  it('does not recenter an informational map on every GPS update', async () => {
    const view = renderMap(navigation(), { showRoute: false });
    await waitFor(() => expect(map.easeTo).toHaveBeenCalledTimes(1));
    map.easeTo.mockClear();

    view.rerender(
      <NavegacionContext.Provider value={navigation({ posicion: { ...position, lat: 6.172 } })}>
        <InteractiveMap site={site} showRoute={false} />
      </NavegacionContext.Provider>
    );

    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it.each(['onDragStart', 'onRotateStart', 'onPitchStart'])('pauses follow on %s and exposes recenter', async (eventName) => {
    renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(mapProps[eventName]).toBeTypeOf('function');

    act(() => mapProps[eventName]());
    expect(screen.getByRole('button', { name: /centrar en mí/i })).toBeTruthy();
  });

  it('keeps the arrow aligned to the viewport after follow is paused', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    map.easeTo.mockClear();

    act(() => mapProps.onDragStart());
    view.rerender(
      <NavegacionContext.Provider value={navigation({ posicion: { ...position, heading: 100 } })}>
        <InteractiveMap site={site} showRoute />
      </NavegacionContext.Provider>,
    );

    await waitFor(() => expect(view.container.querySelector('.user-arrow').style.transform).toBe('rotate(10deg)'));
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('uses the current viewport bearing when the user rotates the paused map', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    map.easeTo.mockClear();
    act(() => mapProps.onDragStart());

    act(() => mapProps.onMove({ viewState: { bearing: 120 } }));

    await waitFor(() => expect(view.container.querySelector('.user-arrow').style.transform).toBe('rotate(-30deg)'));
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('restarts only camera follow when pressing recenter', async () => {
    renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    act(() => mapProps.onDragStart());
    map.easeTo.mockClear();

    act(() => screen.getByRole('button', { name: /centrar en/i }).click());

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ bearing: 90, duration: 250 }));
  });

  it('returns explicitly to north-up when live navigation exits', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    map.easeTo.mockClear();

    view.rerender(
      <NavegacionContext.Provider value={navigation({ ruta: null, navegando: false })}>
        <InteractiveMap site={site} showRoute />
      </NavegacionContext.Provider>
    );

    await waitFor(() => expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ bearing: 0, pitch: 0 })));
  });
});
