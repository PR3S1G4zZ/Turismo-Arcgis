import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavegacionContext } from '../../contexto/NavegacionContext';
import { CAMERA_MODES } from '../../utilidades/navigationContracts';
import { rotacionRelativaViewport, tangenteRuta } from '../../utilidades/geoRuta';
import { frameFromPose } from '../../hooks/useNavigationFrame';
import { buildCameraTarget } from '../../hooks/useNavigationCamera';

const map = {
  stop: vi.fn(),
  easeTo: vi.fn(),
  fitBounds: vi.fn(),
  addControl: vi.fn(),
  removeControl: vi.fn(),
  setStyle: vi.fn(),
  getZoom: vi.fn(() => 16),
  getBearing: vi.fn(() => 23),
  getContainer: vi.fn(() => ({ clientHeight: 500 })),
  cooperativeGestures: { enable: vi.fn(), disable: vi.fn() },
};
let mapProps;
let markerProps;

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('./InteractiveMap.css', () => ({}));

const orientationState = vi.hoisted(() => ({
  heading: null,
  ultimaActualizacion: null,
  necesitaPermiso: false,
  permiso: 'concedido',
  activar: vi.fn(),
}));

const basemapState = vi.hoisted(() => ({
  applyStyle: vi.fn(() => ({
    on: vi.fn(),
    updateStyle: vi.fn().mockResolvedValue(undefined),
  })),
}));

const mapaApiMock = vi.hoisted(() => ({
  token: vi.fn().mockResolvedValue({ token: 'basemap-test-key', motivo: null }),
}));

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
    Marker: (props) => {
      markerProps.push(props);
      return <>{props.children}</>;
    },
    Popup: ({ children }) => <>{children}</>,
    Source: ({ children }) => <>{children}</>,
    Layer: () => null,
    AttributionControl: () => null,
    NavigationControl: () => null,
  };
});

vi.mock('@esri/maplibre-arcgis', () => ({
  BasemapStyle: { applyStyle: basemapState.applyStyle },
}));

vi.mock('../../hooks/useOrientacion', () => ({
  useOrientacion: () => ({
    heading: orientationState.heading,
    ultimaActualizacion: orientationState.ultimaActualizacion,
    necesitaPermiso: orientationState.necesitaPermiso,
    permiso: orientationState.permiso,
    activar: orientationState.activar,
  }),
}));

vi.mock('../../utilidades/api', () => ({ mapaApi: mapaApiMock }));

import { InteractiveMap } from './InteractiveMap';

const site = { name: 'Destino', lat: '6.17', lng: '-75.61', address: 'Itagüí' };
const puntos = [[6.17, -75.61], [6.18, -75.62]];
const position = { lat: 6.171, lng: -75.611, heading: 90, accuracy: 5, speed: 1 };

function navigation(overrides = {}) {
  const positionValue = overrides.posicion || position;
  const compassHeading = Number.isFinite(orientationState.heading) && !(positionValue.speed > 0)
    ? orientationState.heading
    : null;
  const routeHeading = tangenteRuta({ puntos });
  const arrowBearing = compassHeading ?? positionValue.heading ?? routeHeading;
  const cameraBearing = positionValue.speed > 0 && Number.isFinite(positionValue.heading)
    ? positionValue.heading
    : routeHeading;
  const selectedBearingSource = compassHeading != null
    ? 'compass'
    : positionValue.heading != null
      ? 'gps'
      : 'route-tangent';
  const pose = overrides.pose || {
    rawPosition: { lat: positionValue.lat, lng: positionValue.lng },
    matchedPosition: { lat: positionValue.lat, lng: positionValue.lng },
    targetPosition: { lat: positionValue.lat, lng: positionValue.lng },
    arrowBearing,
    cameraBearing,
    speedEstimateMps: positionValue.speed,
    confidence: 'high',
    isMoving: positionValue.speed > 0,
    isOffRoute: false,
    bearingSource: selectedBearingSource,
    positionSource: 'matched',
    routeSegmentIndex: 0,
    accuracyM: positionValue.accuracy,
    timestamp: 1000,
  };
  return {
    posicion: positionValue,
    posicionSimulada: false,
    gpsConfiable: true,
    tramos: { recorrido: [], restante: puntos },
    ruta: { puntos },
    modo: 'walk',
    pose,
    orientacion: {
      heading: orientationState.heading,
      ultimaActualizacion: orientationState.ultimaActualizacion,
      necesitaPermiso: orientationState.necesitaPermiso,
      permiso: orientationState.permiso,
      activar: orientationState.activar,
    },
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

describe('InteractiveMap basemap ArcGIS Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markerProps = [];
    document.documentElement.classList.remove('dark');
    mapaApiMock.token.mockResolvedValue({ token: 'basemap-test-key', motivo: null });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    cleanup();
  });

  it('uses the official light Navigation style in Spanish without requesting OSM first', async () => {
    renderMap(navigation());

    await waitFor(() => expect(basemapState.applyStyle).toHaveBeenCalled());
    expect(basemapState.applyStyle).toHaveBeenCalledWith(
      map,
      expect.objectContaining({
        style: 'arcgis/navigation',
        token: 'basemap-test-key',
        preferences: { language: 'es' },
        attributionControl: { compact: true },
      }),
    );
    expect(mapProps.mapStyle.sources).toEqual({});
    expect(mapProps.transformRequest).toBeUndefined();
  });

  it('uses Navigation Night when the document theme is dark', async () => {
    document.documentElement.classList.add('dark');
    renderMap(navigation());

    await waitFor(() => expect(basemapState.applyStyle).toHaveBeenCalled());
    expect(basemapState.applyStyle).toHaveBeenCalledWith(
      map,
      expect.objectContaining({
        style: 'arcgis/navigation-night',
        preferences: { language: 'es' },
      }),
    );
  });

  it('updates the official style when the theme changes', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(basemapState.applyStyle).toHaveBeenCalled());
    const basemap = basemapState.applyStyle.mock.results[0].value;

    act(() => document.documentElement.classList.add('dark'));

    await waitFor(() => expect(basemap.updateStyle).toHaveBeenCalledWith({
      style: 'arcgis/navigation-night',
      preferences: { language: 'es' },
    }));
    expect(view.container.querySelector('[data-basemap-style="arcgis/navigation-night"]')).not.toBeNull();
  });

  it('reports a network fallback from the basemap credential endpoint', async () => {
    mapaApiMock.token.mockResolvedValueOnce({ token: null, motivo: 'network', status: null });
    renderMap(navigation());

    expect(await screen.findByText(/No se pudo contactar ArcGIS/i)).toBeTruthy();
    expect(document.querySelector('[data-basemap-provider="osm-fallback"]')).not.toBeNull();
  });

  it.each([
    [401, /ArcGIS rechazó la clave/],
    [403, /ArcGIS rechazó la clave/],
  ])('exposes an explicit OSM fallback for ArcGIS HTTP %s without raw error data', async (status, message) => {
    const handlers = {};
    basemapState.applyStyle.mockImplementationOnce(() => ({
      on: vi.fn((eventName, handler) => { handlers[eventName] = handler; }),
      updateStyle: vi.fn().mockResolvedValue(undefined),
    }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderMap(navigation());

    await waitFor(() => expect(handlers.BasemapStyleError).toBeTypeOf('function'));
    act(() => handlers.BasemapStyleError({ status, message: 'Unauthorized API key' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(document.querySelector('[data-basemap-provider="osm-fallback"]')).not.toBeNull();
    expect(warning).toHaveBeenCalledWith('[mapa] Basemap fallback', {
      basemap: 'osm-fallback',
      motivo: status === 401 ? 'invalid-token' : 'privilege-or-referrer',
    });
    warning.mockRestore();
  });

  it('shows API KEY REQUIRED as a configuration error instead of a silent OSM state', async () => {
    const handlers = {};
    basemapState.applyStyle.mockImplementationOnce(() => ({
      on: vi.fn((eventName, handler) => { handlers[eventName] = handler; }),
      updateStyle: vi.fn().mockResolvedValue(undefined),
    }));
    renderMap(navigation());

    await waitFor(() => expect(handlers.BasemapStyleError).toBeTypeOf('function'));
    act(() => handlers.BasemapStyleError(new Error('API KEY REQUIRED')));

    expect(await screen.findByText(/ArcGIS requiere una API key con privilegio Basemaps/i)).toBeTruthy();
  });
});

describe('InteractiveMap camera lifecycle', () => {
  afterEach(() => {
    delete window.__capturarGeometria;
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    markerProps = [];
    document.documentElement.classList.remove('dark');
    orientationState.heading = null;
    orientationState.ultimaActualizacion = null;
    orientationState.necesitaPermiso = false;
    orientationState.permiso = 'concedido';
    map.getZoom.mockReturnValue(16);
    map.getBearing.mockReturnValue(23);
    mapaApiMock.token.mockResolvedValue({ token: 'basemap-test-key', motivo: null });
  });

  it('keeps the preview route framed without starting live follow', async () => {
    renderMap(navigation({ navegando: false, previsualizando: true, gpsConfiable: false }));

    await waitFor(() => expect(map.fitBounds).toHaveBeenCalledTimes(1));
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('uses one shared pose-derived frame for the marker and camera target', async () => {
    const pose = {
      rawPosition: { lat: 9, lng: 9 },
      matchedPosition: { lat: 6.171, lng: -75.611 },
      targetPosition: { lat: 6.171, lng: -75.611 },
      arrowBearing: 90,
      cameraBearing: 90,
      speedEstimateMps: 0,
      confidence: 'high',
      isMoving: false,
      isOffRoute: false,
      bearingSource: 'route-tangent',
      positionSource: 'matched',
      routeSegmentIndex: 0,
      accuracyM: 5,
      timestamp: 2000,
    };
    const frame = frameFromPose(pose, CAMERA_MODES.FOLLOWING);
    const target = buildCameraTarget(frame, { profile: 'walk' });
    expect(target.anchorRatio).toBe(0.7);
    const view = renderMap(navigation({ pose, posicion: { ...position, lat: 9, lng: 9 } }));

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    const userMarkers = markerProps.filter((props) => props.rotationAlignment === 'viewport');
    const userMarker = userMarkers[userMarkers.length - 1];
    expect(userMarker).toMatchObject({
      longitude: frame.displayPosition.lng,
      latitude: frame.displayPosition.lat,
    });
    expect(map.getContainer).toHaveBeenCalled();
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({
      center: target.center,
      bearing: target.bearing,
      pitch: target.pitch,
      zoom: target.zoom,
      offset: [0, 100],
      duration: 0,
    }));
    expect(view.container.querySelector('[data-camera-mode="FOLLOWING"]')).not.toBeNull();
  });

  it('exposes GPS_DEGRADED to the map while retaining the shared frame', async () => {
    const view = renderMap(navigation({ gpsConfiable: false }));

    await waitFor(() => expect(view.container.querySelector('[data-camera-mode="GPS_DEGRADED"]')).not.toBeNull());
    expect(markerProps.find((props) => props.rotationAlignment === 'viewport')).toMatchObject({
      longitude: position.lng,
      latitude: position.lat,
    });
  });

  it('keeps geometry capture silent unless the manual flag is enabled', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    renderMap(navigation({ navegando: false, previsualizando: true, gpsConfiable: false }));

    await waitFor(() => expect(map.fitBounds).toHaveBeenCalledTimes(1));
    expect(log).not.toHaveBeenCalledWith(
      '[captura-geometria] geojson-maplibre',
      expect.any(String)
    );
    log.mockRestore();
  });

  it('logs the complete MapLibre GeoJSON when the dev-only flag is enabled', async () => {
    window.__capturarGeometria = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    renderMap(navigation({ navegando: false, previsualizando: true, gpsConfiable: false }));

    await waitFor(() => expect(log).toHaveBeenCalledWith(
      '[captura-geometria] geojson-maplibre',
      JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: puntos.map(([lat, lng]) => [lng, lat]),
        },
        properties: {},
      })
    ));
    log.mockRestore();
  });

  it('owns a trusted live camera update with one short course-up ease', async () => {
    const value = navigation();
    const expected = buildCameraTarget(frameFromPose(value.pose, CAMERA_MODES.FOLLOWING), { profile: 'walk' });
    renderMap(value);

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // MapLibre's easeTo already cancels the previous transition internally;
    // an explicit stop here would restart the animation on every GPS fix.
    expect(map.stop).not.toHaveBeenCalled();
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({
      center: expected.center,
      bearing: expected.bearing,
      pitch: expected.pitch,
      zoom: expected.zoom,
      duration: 0,
    }));
  });

  it('uses the route tangent while following live GPS with no finite heading', async () => {
    const value = navigation({ posicion: { ...position, heading: null } });
    const expected = buildCameraTarget(frameFromPose(value.pose, CAMERA_MODES.FOLLOWING), { profile: 'walk' });
    renderMap(value);

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.stop).not.toHaveBeenCalled();
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({
      center: expected.center,
      bearing: expected.bearing,
      pitch: expected.pitch,
      zoom: expected.zoom,
      duration: 0,
    }));
  });

  it('uses compass for the stopped arrow while camera keeps the conservative course', async () => {
    orientationState.heading = 180;
    orientationState.ultimaActualizacion = Date.now();
    const value = navigation({ posicion: { ...position, heading: 90, speed: 0 } });
    const expected = buildCameraTarget(frameFromPose(value.pose, CAMERA_MODES.FOLLOWING), { profile: 'walk' });
    const view = renderMap(value);

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({
      center: expected.center,
      bearing: expected.bearing,
      pitch: expected.pitch,
      zoom: expected.zoom,
      duration: 0,
    }));
    const userMarkers = markerProps.filter((props) => props.rotationAlignment === 'viewport');
    const userMarker = userMarkers[userMarkers.length - 1];
    expect(userMarker.children.props.rotacion).toBe(
      rotacionRelativaViewport(value.pose.arrowBearing, expected.bearing),
    );
    expect(view.container.querySelector('.user-arrow')).not.toBeNull();
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

    act(() => mapProps[eventName]({ originalEvent: { type: 'pointerdown' } }));
    expect(screen.getByRole('button', { name: /centrar en mí/i })).toBeTruthy();
  });

  it('pauses follow on zoom and exposes recenter', async () => {
    renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(mapProps.onZoomStart).toBeTypeOf('function');

    act(() => mapProps.onZoomStart({ originalEvent: { type: 'wheel' } }));
    expect(screen.getByRole('button', { name: /centrar en mí/i })).toBeTruthy();
  });

  it('does not pause follow for a programmatic camera start without an original event', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());

    act(() => mapProps.onZoomStart({ type: 'zoomstart' }));

    expect(view.container.querySelector('.map-actions--recentrar')).toBeNull();
  });

  it('keeps the compass activation action available during live navigation', async () => {
    orientationState.necesitaPermiso = true;
    orientationState.permiso = 'pendiente';
    renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());

    const boton = screen.getByRole('button', { name: /brújula/i });
    act(() => boton.click());

    expect(orientationState.activar).toHaveBeenCalledTimes(1);
  });

  it('keeps the arrow aligned to the viewport after follow is paused', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    map.easeTo.mockClear();

    act(() => mapProps.onDragStart({ originalEvent: { type: 'pointerdown' } }));
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
    act(() => mapProps.onDragStart({ originalEvent: { type: 'pointerdown' } }));

    act(() => mapProps.onMove({ viewState: { bearing: 120 } }));

    await waitFor(() => expect(view.container.querySelector('.user-arrow').style.transform).toBe('rotate(-30deg)'));
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('restarts only camera follow when pressing recenter', async () => {
    renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    act(() => mapProps.onDragStart({ originalEvent: { type: 'pointerdown' } }));
    map.easeTo.mockClear();

    act(() => screen.getByRole('button', { name: /centrar en/i }).click());

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ bearing: 90, duration: 250 }));
  });

  it('keeps follow paused when GPS recovers during the same navigation session', async () => {
    const view = renderMap(navigation());
    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    act(() => mapProps.onDragStart({ originalEvent: { type: 'pointerdown' } }));

    view.rerender(
      <NavegacionContext.Provider value={navigation({ gpsConfiable: false })}>
        <InteractiveMap site={site} showRoute />
      </NavegacionContext.Provider>,
    );
    view.rerender(
      <NavegacionContext.Provider value={navigation({ gpsConfiable: true })}>
        <InteractiveMap site={site} showRoute />
      </NavegacionContext.Provider>,
    );

    expect(view.container.querySelector('.map-actions--recentrar')).not.toBeNull();
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

describe('InteractiveMap latency instrumentation', () => {
  let markSpy;
  let measureSpy;

  beforeEach(() => {
    markSpy = vi.spyOn(performance, 'mark');
    measureSpy = vi.spyOn(performance, 'measure').mockReturnValue({ duration: 1 });
    markerProps = [];
    orientationState.heading = null;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('measures accepted GPS to the live camera update', async () => {
    renderMap(navigation());

    await waitFor(() => expect(measureSpy).toHaveBeenCalledWith(
      'diag:gps-camara',
      'gps:aceptado',
      'camara:actualizada',
    ));
    expect(markSpy).toHaveBeenCalledWith('camara:actualizada');
  });

  it('measures an accepted orientation change to arrow rendering', async () => {
    orientationState.heading = 45;
    renderMap(navigation({ posicion: { ...position, speed: 0 } }));

    await waitFor(() => expect(measureSpy).toHaveBeenCalledWith(
      'diag:orientacion-flecha',
      'orientacion:cambio',
      'flecha:render',
    ));
    expect(markSpy).toHaveBeenCalledWith('flecha:render');
  });

  it('measures GPS to the first marker animation frame once per animation cycle', async () => {
    const view = renderMap(navigation());

    await waitFor(() => expect(measureSpy).toHaveBeenCalledWith(
      'diag:gps-marcador',
      'gps:aceptado',
      'marcador:render-inicio',
    ));
    measureSpy.mockClear();
    markSpy.mockClear();

    view.rerender(
      <NavegacionContext.Provider value={navigation({ posicion: { ...position, lat: 6.172 } })}>
        <InteractiveMap site={site} showRoute />
      </NavegacionContext.Provider>
    );

    await waitFor(() => expect(measureSpy).toHaveBeenCalledWith(
      'diag:gps-marcador',
      'gps:aceptado',
      'marcador:render-inicio',
    ));
    expect(measureSpy.mock.calls.filter(([name]) => name === 'diag:gps-marcador')).toHaveLength(1);
    expect(markSpy).toHaveBeenCalledWith('marcador:render-inicio');
  });

  it('measures an arriving route to its rendered remaining geometry', async () => {
    renderMap(navigation());

    await waitFor(() => expect(measureSpy).toHaveBeenCalledWith(
      'diag:respuesta-ruta-renderizada',
      'respuesta:recibida',
      'ruta:renderizada',
    ));
    expect(markSpy).toHaveBeenCalledWith('ruta:renderizada');
  });

  it('does not mark route rendering for an informational map', async () => {
    renderMap(navigation(), { showRoute: false });

    await waitFor(() => expect(map.easeTo).toHaveBeenCalled());
    expect(markSpy).not.toHaveBeenCalledWith('ruta:renderizada');
    expect(measureSpy).not.toHaveBeenCalledWith(
      'diag:respuesta-ruta-renderizada',
      'respuesta:recibida',
      'ruta:renderizada',
    );
  });
});
