// src/componentes/detalle/InteractiveMap.jsx
// Mapa de navegación estilo Waze/Google Maps sobre MapLibre GL:
//  - la ubicación del usuario es una FLECHA que apunta a su dirección de marcha,
//  - al navegar, el MAPA ROTA para que la marcha quede siempre hacia arriba
//    (modo course-up) con una leve inclinación 3D,
//  - el basemap es el vectorial de ArcGIS ("navigation"), con respaldo raster
//    sin clave para que la navegación siga siendo comprobable en desarrollo.
// El motor de navegación (rutas, voz, recálculo) vive en useNavegacion y no se
// toca aquí: este componente solo dibuja y mueve la cámara.
import { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import Map, {
  AttributionControl,
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BasemapStyle } from '@esri/maplibre-arcgis';
import { RiNavigationLine, RiFocus3Line, RiCompass3Line } from 'react-icons/ri';
import { NavegacionContext } from '../../contexto/NavegacionContext';
import { useNavigationFrame } from '../../hooks/useNavigationFrame';
import { useNavigationCamera } from '../../hooks/useNavigationCamera';
import { BEARING_SOURCES, CAMERA_MODES } from '../../utilidades/navigationContracts';
import { mapaApi } from '../../utilidades/api';
import {
  normalizarRumbo,
  rotacionRelativaViewport,
} from '../../utilidades/geoRuta';
import { marcar, medir, MARCAS, TRAMOS } from '../../utilidades/diagnosticoLatencias';
import './InteractiveMap.css';

// Zoom cercano mientras se navega, para ver la calle y la siguiente esquina.
const ZOOM_NAVEGACION = 17;
const ZOOM_VISTA = 15;

// El scheduler de frame publica muchos pasos durante una interpolación. La
// cámara puede consumir ese mismo frame, pero no necesita reiniciar MapLibre
// por cambios submétricos de cada tick: hacerlo genera una realimentación de
// onMove y, en React, una cascada de renders sin valor visual.
const CAMERA_TARGET_POSITION_EPSILON_M = 0.75;
const CAMERA_TARGET_BEARING_EPSILON_DEG = 0.75;
const CAMERA_TARGET_SCALAR_EPSILON = 0.01;
const METROS_POR_GRADO = 111320;

function compactCameraTarget(target) {
  if (!target || !Array.isArray(target.center) || target.center.length < 2) return null;
  return {
    center: [Number(target.center[0]), Number(target.center[1])],
    bearing: Number(target.bearing),
    pitch: Number(target.pitch),
    zoom: Number(target.zoom),
    duration: Number.isFinite(target.duration) ? target.duration : 0,
  };
}

function circularCameraDifference(first, second) {
  if (![first, second].every(Number.isFinite)) return Infinity;
  return Math.abs((((first - second) % 360) + 540) % 360 - 180);
}

function cameraTargetsEquivalent(first, second) {
  const anterior = compactCameraTarget(first);
  const siguiente = compactCameraTarget(second);
  if (!anterior || !siguiente) return false;
  const latitudMedia = ((anterior.center[1] + siguiente.center[1]) / 2) * (Math.PI / 180);
  const deltaLngM = (anterior.center[0] - siguiente.center[0])
    * METROS_POR_GRADO
    * Math.max(0.2, Math.cos(latitudMedia));
  const deltaLatM = (anterior.center[1] - siguiente.center[1]) * METROS_POR_GRADO;
  return Math.hypot(deltaLngM, deltaLatM) <= CAMERA_TARGET_POSITION_EPSILON_M
    && circularCameraDifference(anterior.bearing, siguiente.bearing) <= CAMERA_TARGET_BEARING_EPSILON_DEG
    && Math.abs(anterior.pitch - siguiente.pitch) <= CAMERA_TARGET_SCALAR_EPSILON
    && Math.abs(anterior.zoom - siguiente.zoom) <= CAMERA_TARGET_SCALAR_EPSILON
    && anterior.duration === siguiente.duration;
}

// Respaldo raster sin credenciales si ArcGIS no está disponible. No sustituye
// al proveedor principal de rutas: solo evita que un basemap sin token deje la
// pantalla inutilizable durante la prueba móvil.
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm' }],
};

// Estilo inicial sin fuentes remotas. Cuando ArcGIS está configurado, evita
// solicitar tiles OSM durante la carga nominal del basemap vectorial.
const EMPTY_MAP_STYLE = {
  version: 8,
  sources: {},
  layers: [{
    id: 'map-loading-background',
    type: 'background',
    paint: { 'background-color': '#e7e8ea' },
  }],
};

const BASEMAP_STYLES = {
  light: 'arcgis/navigation',
  dark: 'arcgis/navigation-night',
};

const ORIENTACION_VACIA = Object.freeze({
  heading: null,
  necesitaPermiso: false,
  permiso: 'no-requiere',
  ultimaActualizacion: null,
  activar: () => {},
});

const BASEMAP_REASON_LABELS = {
  'not-configured': 'ArcGIS no está configurado; se usa OSM.',
  'invalid-token': 'ArcGIS rechazó la clave (401/498); verifica su vigencia.',
  'privilege-or-referrer': 'ArcGIS rechazó la clave (403/499); verifica Basemaps y los referrers.',
  'api-key-required': 'ArcGIS requiere una API key con privilegio Basemaps.',
  timeout: 'ArcGIS agotó el tiempo de respuesta; se usa OSM.',
  network: 'No se pudo contactar ArcGIS; se usa OSM.',
  'style-error': 'ArcGIS no pudo cargar el estilo; se usa OSM.',
};

function estadoBasemapError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? error?.response?.statusCode) || null;
  const message = String(error?.message || error?.originalMessage || '').toLowerCase();
  if ([401, 498].includes(status) || /invalid\s+(token|api\s*key)/i.test(message)) return 'invalid-token';
  if ([403, 499].includes(status) || /not\s+authorized|unauthori[sz]ed|referrer|privilege/i.test(message)) {
    return 'privilege-or-referrer';
  }
  if (/api\s*key\s*required/i.test(message)) return 'api-key-required';
  if (error?.name === 'AbortError' || /timeout|timed out|network/i.test(message)) return 'timeout';
  return 'network';
}

function etiquetaBasemap(motivo) {
  return BASEMAP_REASON_LABELS[motivo] || BASEMAP_REASON_LABELS['style-error'];
}

// ─── Helpers geométricos (todo en [lng, lat] para GeoJSON/MapLibre) ─────────

const RADIO_TIERRA_M = 6371000;

/** Punto a `distM` metros y `rumboDeg` grados de (lat,lng). Devuelve [lng,lat]. */
function puntoDestino(lat, lng, rumboDeg, distM) {
  const d = distM / RADIO_TIERRA_M;
  const br = (rumboDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** Polígono (círculo) del halo de precisión del GPS, en metros. */
function circuloGeoJSON(lat, lng, radioM, pasos = 48) {
  const anillo = [];
  for (let i = 0; i <= pasos; i++) anillo.push(puntoDestino(lat, lng, (i / pasos) * 360, radioM));
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [anillo] }, properties: {} };
}

/** LineString GeoJSON a partir de puntos [lat,lng]; null si hay menos de 2. */
function lineaGeoJSON(puntos) {
  if (!puntos || puntos.length < 2) return null;
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: puntos.map(([lat, lng]) => [lng, lat]) },
    properties: {},
  };
}

/** Flecha de navegación del usuario (SVG). Se rota por CSS según el modo. */
const FlechaUsuario = ({ rotacion }) => (
  <div className="user-arrow" style={{ transform: `rotate(${rotacion}deg)` }}>
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="user-arrow__halo" cx="18" cy="18" r="16" />
      <path className="user-arrow__shape" d="M18 5 L28 29 L18 23 L8 29 Z" />
    </svg>
  </div>
);

export const InteractiveMap = ({ site, onStartRoute, showRoute = false }) => {
  const navegacion = useContext(NavegacionContext);
  const {
    posicion: userPosition,
    posicionSimulada,
    gpsConfiable,
    ultimaActualizacion,
    tramos,
    ruta,
    avanceRuta,
    navegando,
    previsualizando,
    llegado,
    pose: navigationPose,
    modo,
    orientacion: navigationOrientation,
  } = navegacion || {};

  // La brújula se escucha una sola vez en useNavegacion. El mapa únicamente
  // consume sus acciones de permiso; el rumbo que pinta llega dentro de pose.
  const orientacion = navigationOrientation || ORIENTACION_VACIA;

  const mapRef = useRef(null);
  const mapaNativoRef = useRef(null);
  const basemapRef = useRef(null);
  const basemapTemaRef = useRef(null);
  const esriAttributionRef = useRef(null);
  const ultimoTargetCamaraRef = useRef(null);
  const cameraMapRef = useRef({
    easeTo: (target) => {
      const map = mapRef.current;
      const siguiente = compactCameraTarget(target);
      if (!map || typeof map.easeTo !== 'function' || !siguiente) return;
      if (cameraTargetsEquivalent(ultimoTargetCamaraRef.current, siguiente)) return;
      ultimoTargetCamaraRef.current = siguiente;
      map.easeTo(target);
    },
  });
  const [mapListo, setMapListo] = useState(false);
  const [bearingViewport, setBearingViewport] = useState(0);
  const bearingViewportRef = useRef(0);

  const actualizarBearingViewport = useCallback((evento) => {
    const delEvento = evento?.viewState?.bearing;
    const delMapa = mapRef.current?.getBearing?.();
    const siguiente = Number.isFinite(delEvento) ? delEvento : delMapa;
    const normalizado = normalizarRumbo(siguiente);
    if (normalizado == null) return;
    bearingViewportRef.current = normalizado;
    setBearingViewport((anterior) => (anterior === normalizado ? anterior : normalizado));
  }, []);

  const [coordinates, setCoordinates] = useState(() => {
    if (site.lat && site.lng) return [parseFloat(site.lat), parseFloat(site.lng)];
    return null;
  });
  const [loading, setLoading] = useState(() => !(site.lat && site.lng));
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Key pública y restringida del basemap ArcGIS (null → respaldo OSM).
  const [token, setToken] = useState(null);
  const [tokenListo, setTokenListo] = useState(false);
  // Se activa si ArcGIS rechaza la key o el estilo: entonces se cae al OSM.
  const [arcgisFallo, setArcgisFallo] = useState(false);
  const [basemapEstado, setBasemapEstado] = useState('loading');
  const [basemapMotivo, setBasemapMotivo] = useState(null);
  // Mensaje si el mapa no logra cargar (diagnóstico visible en el móvil).
  const [mapError, setMapError] = useState(null);

  // Colores de marca leídos de las variables CSS (MapLibre no entiende var()).
  // Se releen al cambiar de tema.
  const colores = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      acento: cs.getPropertyValue('--color-accent').trim() || '#E8B400',
      tenue: cs.getPropertyValue('--color-text-secondary').trim() || '#8A8F98',
      // Trazado de la ruta: un azul de navegación dedicado, distinto del
      // dorado de marca (que en el mapa ya es "botón/CTA") y del gris de
      // texto (que ya significa "texto secundario" en toda la interfaz).
      rutaActiva: cs.getPropertyValue('--color-route-active').trim() || '#2F6FED',
      rutaHecha: cs.getPropertyValue('--color-route-done').trim() || '#A7B0C2',
    };
    // `isDark` no se usa en el cuerpo pero es la señal de que las variables CSS
    // cambiaron: sin él, los colores quedarían congelados al cambiar de tema.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // El estado autoritativo de la cámara vive en useNavigationCamera. Este
  // espejo solo permite entregar su modo al frame en el siguiente render.
  const [cameraModeInput, setCameraModeInput] = useState(CAMERA_MODES.OVERVIEW);
  const vistaInformativaAplicadaRef = useRef(false);

  // Popups (uno a la vez): 'site' | 'user' | null.
  const [popup, setPopup] = useState(null);

  // Tema claro/oscuro: reacciona al cambio de clase en <html>.
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Credencial pública del basemap, una vez al montar. La API devuelve un
  // motivo estable cuando falta configuración o el backend no está accesible;
  // no se imprime la respuesta ni se confunde con un token de routing.
  useEffect(() => {
    let vivo = true;
    mapaApi.token().then((resultado) => {
      if (!vivo) return;
      // Compatibilidad con mocks/consumidores antiguos que devolvían string.
      const siguienteToken = typeof resultado === 'string' ? resultado : resultado?.token;
      const motivo = typeof resultado === 'string' ? null : resultado?.motivo;
      setToken(siguienteToken || null);
      setBasemapMotivo(motivo || (siguienteToken ? null : 'not-configured'));
      setBasemapEstado(siguienteToken ? 'loading' : 'osm-fallback');
      setTokenListo(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Resolución de coordenadas del sitio (lat/lng directo o geocodificación).
  useEffect(() => {
    if (site.lat && site.lng) {
      Promise.resolve().then(() => {
        setCoordinates([parseFloat(site.lat), parseFloat(site.lng)]);
        setLoading(false);
      });
      return;
    }
    if (!site.address) {
      Promise.resolve().then(() => {
        setCoordinates([6.1724, -75.6091]);
        setLoading(false);
      });
      return;
    }
    Promise.resolve().then(() => setLoading(true));
    const query =
      site.address.toLowerCase().includes('itagüí') || site.address.toLowerCase().includes('itagui')
        ? site.address
        : `${site.address}, Itagüí, Colombia`;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setCoordinates(data && data.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : [6.1724, -75.6091]);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Dynamic geocoding error:', err);
        setCoordinates([6.1724, -75.6091]);
        setLoading(false);
      });
  }, [site.address, site.lat, site.lng]);

  const siteCenter = coordinates;
  const mapCenter = siteCenter;

  // El trayecto solo se pinta cuando esta instancia del mapa está en modo ruta
  // y hay una navegación viva; el resto del tiempo el mapa es informativo.
  const mostrarTrayecto = showRoute && ruta && (previsualizando || navegando || llegado);

  // En una sesión normal la pose viene del motor compartido. El fallback
  // conserva compatibilidad con consumidores antiguos del contexto mientras
  // se actualizan: sigue produciendo una sola pose para ambos consumidores.
  const poseForFrame = useMemo(() => {
    if (navigationPose) return navigationPose;
    if (!userPosition) return null;
    return {
      rawPosition: { lat: userPosition.lat, lng: userPosition.lng },
      matchedPosition: null,
      targetPosition: { lat: userPosition.lat, lng: userPosition.lng },
      movementBearing: userPosition.heading,
      arrowBearing: userPosition.heading,
      cameraBearing: userPosition.heading,
      speedEstimateMps: userPosition.speed,
      accuracyM: userPosition.accuracy,
      routeSegmentIndex: avanceRuta?.indice ?? null,
      confidence: 'low',
      isMoving: Number.isFinite(userPosition.speed) && userPosition.speed > 0,
      isOffRoute: false,
      bearingSource: 'held',
      positionSource: 'raw',
      timestamp: Number.isFinite(ultimaActualizacion) ? ultimaActualizacion : 0,
    };
  }, [navigationPose, userPosition, avanceRuta?.indice, ultimaActualizacion]);

  const liveNavigation = Boolean(mostrarTrayecto && navegando);
  const gpsDisponibleParaCamara = Boolean(gpsConfiable && !posicionSimulada);
  const liveNavigationAnteriorRef = useRef(liveNavigation);
  useEffect(() => {
    if (liveNavigation && !liveNavigationAnteriorRef.current) {
      // Una ruta nueva puede empezar en el mismo punto de la sesión anterior;
      // el primer objetivo debe volver a aplicarse tras la vista informativa.
      ultimoTargetCamaraRef.current = null;
    }
    liveNavigationAnteriorRef.current = liveNavigation;
  }, [liveNavigation]);

  const registrarActualizacionCamara = useCallback((target, metadata = {}) => {
    const targetForGate = {
      ...target,
      duration: Number.isFinite(metadata.duration) ? metadata.duration : 0,
    };
    if (!mapListo || !mapRef.current || typeof mapRef.current.easeTo !== 'function') return;
    if (cameraTargetsEquivalent(ultimoTargetCamaraRef.current, targetForGate)) return;
    actualizarBearingViewport({ viewState: { bearing: target.bearing } });
    marcar(MARCAS.CAMARA_ACTUALIZADA);
    medir(TRAMOS.GPS_CAMARA, MARCAS.GPS_ACEPTADO, MARCAS.CAMARA_ACTUALIZADA);
  }, [actualizarBearingViewport, mapListo]);

  // El frame interpolado es la única fuente visual: el marcador y el hook de
  // cámara reciben exactamente esta misma referencia en cada render.
  const frame = useNavigationFrame({
    pose: poseForFrame,
    cameraMode: cameraModeInput,
    enabled: Boolean(poseForFrame),
  });
  const cameraState = useNavigationCamera({
    frame,
    profile: modo || 'walk',
    active: liveNavigation,
    gpsConfiable: gpsDisponibleParaCamara,
    mapRef: mapListo ? cameraMapRef : null,
    onCameraUpdate: registrarActualizacionCamara,
  });
  const {
    cameraMode,
    handleGesture,
    finishRecentering,
    recenter,
  } = cameraState;

  useEffect(() => {
    // El estado interno de la cámara y el metadato del frame deben converger
    // después de una transición de gesto/GPS; el scheduler sigue siendo único.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCameraModeInput((actual) => (
      actual === cameraMode ? actual : cameraMode
    ));
  }, [cameraMode]);

  // RECENTERING representa la transición de cámara; al terminar su duración
  // el hook vuelve a FOLLOWING para que el siguiente fix continúe acompañando.
  useEffect(() => {
    if (cameraMode !== CAMERA_MODES.RECENTERING) return undefined;
    const timeout = setTimeout(finishRecentering, 250);
    return () => clearTimeout(timeout);
  }, [cameraMode, finishRecentering]);

  const enSeguimiento = liveNavigation && gpsDisponibleParaCamara;
  const manejarInicioGesto = useCallback((event) => {
    // MapLibre emits the same lifecycle events for camera transitions started
    // by the application. Only an event with `originalEvent` is attributable
    // to a real pointer/touch/keyboard gesture by the user.
    if (!enSeguimiento) return;
    handleGesture(event);
  }, [enSeguimiento, handleGesture]);

  const rotacionFlecha = frame?.arrowBearing == null
    ? 0
    : rotacionRelativaViewport(frame.arrowBearing, bearingViewport) ?? 0;

  // La medición se ancla a la pose (un fix o una orientación aceptada), no a
  // cada frame de RAF; así el scheduler no duplica el tramo GPS→marcador.
  useEffect(() => {
    if (!poseForFrame || poseForFrame.arrowBearing == null) return;
    marcar(MARCAS.FLECHA_RENDER);
    const marcaInicio = poseForFrame.bearingSource === BEARING_SOURCES.COMPASS
      ? MARCAS.ORIENTACION_CAMBIO
      : MARCAS.GPS_ACEPTADO;
    medir(TRAMOS.ORIENTACION_FLECHA, marcaInicio, MARCAS.FLECHA_RENDER);
  }, [poseForFrame]);

  useEffect(() => {
    if (!poseForFrame?.targetPosition && !poseForFrame?.rawPosition) return;
    marcar(MARCAS.MARCADOR_RENDER);
    medir(TRAMOS.GPS_MARCADOR, MARCAS.GPS_ACEPTADO, MARCAS.MARCADOR_RENDER);
  }, [poseForFrame]);

  const mapStyle = useMemo(() => {
    // Con key configurada se monta una superficie local vacía mientras el
    // plugin solicita el estilo oficial; así ArcGIS es la ruta nominal y no
    // se solicita OSM antes de conocer el resultado de esa carga.
    if (token && !arcgisFallo) return EMPTY_MAP_STYLE;
    return OSM_RASTER_STYLE;
  }, [token, arcgisFallo]);

  // ─── Cámara ───────────────────────────────────────────────
  const manejarCargaMapa = useCallback((e) => {
    setMapListo(true);
    setMapError(null);
    actualizarBearingViewport({ viewState: { bearing: e?.target?.getBearing?.() } });
    const map = e?.target;
    mapaNativoRef.current = map || null;
    if (map?.cooperativeGestures) {
      if (showRoute) map.cooperativeGestures.disable();
      else map.cooperativeGestures.enable();
    }
  }, [actualizarBearingViewport, showRoute]);

  const activarFallbackBasemap = useCallback((motivo = 'style-error') => {
    const map = mapaNativoRef.current;
    if (map && esriAttributionRef.current) {
      map.removeControl?.(esriAttributionRef.current);
    }
    esriAttributionRef.current = null;
    basemapRef.current = null;
    basemapTemaRef.current = null;
    setArcgisFallo(true);
    setBasemapEstado('osm-fallback');
    setBasemapMotivo(motivo);
    // No se muestra el mensaje crudo del SDK: podría contener URL o token.
    console.warn('[mapa] Basemap fallback', { basemap: 'osm-fallback', motivo });
  }, []);

  const aplicarBasemapArcgis = useCallback((map, apiKey, dark) => {
    const style = dark ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light;
    try {
      const basemap = BasemapStyle.applyStyle(map, {
        style,
        token: apiKey,
        preferences: { language: 'es' },
        attributionControl: { compact: true },
      });
      basemapRef.current = basemap;
      basemapTemaRef.current = style;
      setBasemapEstado('arcgis-loading');
      setBasemapMotivo(null);

      basemap.on?.('BasemapStyleLoad', () => {
        if (basemapRef.current !== basemap) return;
        setBasemapEstado('arcgis');
        console.info('[mapa] Basemap ArcGIS activo', { basemap: 'arcgis', style, language: 'es' });
      });
      basemap.on?.('BasemapAttributionLoad', (control) => {
        esriAttributionRef.current = control;
      });
      basemap.on?.('BasemapStyleError', (error) => {
        if (basemapRef.current !== basemap) return;
        activarFallbackBasemap(estadoBasemapError(error));
      });
    } catch (error) {
      activarFallbackBasemap(estadoBasemapError(error));
    }
  }, [activarFallbackBasemap]);

  // El plugin controla el estilo vectorial y la atribución Esri. La key queda
  // fuera de las credenciales privadas de routing y no se añade manualmente a
  // URLs ajenas al estilo oficial.
  useEffect(() => {
    const map = mapaNativoRef.current;
    if (!mapListo || !map) return;

    if (!token || arcgisFallo) return;

    const style = isDark ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light;
    if (!basemapRef.current) {
      aplicarBasemapArcgis(map, token, isDark);
      return;
    }
    if (basemapTemaRef.current === style) return;

    const basemap = basemapRef.current;
    basemapTemaRef.current = style;
    setBasemapEstado('arcgis-loading');
    Promise.resolve(basemap.updateStyle?.({ style, preferences: { language: 'es' } }))
      .then(() => {
        if (basemapRef.current === basemap) setBasemapEstado('arcgis');
      })
      .catch((error) => {
        if (basemapRef.current === basemap) activarFallbackBasemap(estadoBasemapError(error));
      });
  }, [mapListo, token, isDark, arcgisFallo, aplicarBasemapArcgis, activarFallbackBasemap]);

  useEffect(() => {
    if (!mostrarTrayecto || !tramos?.restante?.length) return;
    marcar(MARCAS.RUTA_RENDERIZADA);
    medir(TRAMOS.RESPUESTA_RUTA_RENDERIZADA, MARCAS.RESPUESTA_RECIBIDA, MARCAS.RUTA_RENDERIZADA);
  }, [mostrarTrayecto, tramos]);

  // La vista informativa se inicializa una vez; las lecturas GPS posteriores no
  // deben pelear con quien explora el mapa. Al salir de navegación, además,
  // restablece norte-arriba y cámara plana de forma explícita.
  useEffect(() => {
    if (!mapListo || mostrarTrayecto || !mapCenter || vistaInformativaAplicadaRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.easeTo({ center: [mapCenter[1], mapCenter[0]], bearing: 0, pitch: 0, duration: 250 });
    vistaInformativaAplicadaRef.current = true;
  }, [mapListo, mostrarTrayecto, mapCenter]);

  useEffect(() => {
    if (mostrarTrayecto) vistaInformativaAplicadaRef.current = false;
  }, [mostrarTrayecto]);

  // Al recibir un trayecto nuevo se encuadra completo una sola vez; a partir de
  // ahí la cámara de seguimiento acompaña al usuario.
  useEffect(() => {
    if (!mapListo || !previsualizando || !ruta?.puntos || ruta.puntos.length < 2) return;
    // Captura dev-only del GeoJSON completo entregado a MapLibre (Fase 4 GEOM-01):
    // inactiva salvo que el humano active window.__capturarGeometria a mano en DevTools.
    if (import.meta.env.DEV && window.__capturarGeometria === true) {
      console.log('[captura-geometria] geojson-maplibre', JSON.stringify(lineaGeoJSON(ruta.puntos)));
    }
    const map = mapRef.current;
    if (!map) return;
    let oeste = Infinity, sur = Infinity, este = -Infinity, norte = -Infinity;
    for (const [lat, lng] of ruta.puntos) {
      if (lng < oeste) oeste = lng;
      if (lng > este) este = lng;
      if (lat < sur) sur = lat;
      if (lat > norte) norte = lat;
    }
    map.stop();
    map.fitBounds([[oeste, sur], [este, norte]], { padding: 50, duration: 250 });
  }, [mapListo, previsualizando, ruta]);

  if (loading || !coordinates || !tokenListo) {
    return (
      <div
        className="map-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-surface-alt)',
          minHeight: '300px',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Cargando ubicación en el mapa...</p>
      </div>
    );
  }

  // El marcador y la cámara usan `frame.displayPosition`; la precisión solo
  // controla el halo y no vuelve a introducir una segunda posición cruda.
  const displayPosition = frame?.displayPosition;
  const accuracyForFrame = poseForFrame?.accuracyM ?? userPosition?.accuracy;
  const haloVisible = displayPosition
    && Number.isFinite(accuracyForFrame)
    && accuracyForFrame > 25;

  return (
    <div
      className="map-container"
      data-camera-mode={cameraState.cameraMode}
      data-basemap-provider={basemapEstado === 'osm-fallback' ? 'osm-fallback' : basemapEstado === 'arcgis' ? 'arcgis' : undefined}
      data-basemap-style={basemapEstado === 'osm-fallback' ? 'osm-raster' : isDark ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light}
    >
      <Map
        ref={mapRef}
        cooperativeGestures={!showRoute}
        locale={{
          'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
          'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + scroll para hacer zoom',
          'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + scroll para hacer zoom',
        }}
        onLoad={manejarCargaMapa}
        initialViewState={{
          longitude: mapCenter[1],
          latitude: mapCenter[0],
          zoom: enSeguimiento ? ZOOM_NAVEGACION : ZOOM_VISTA,
        }}
        mapStyle={mapStyle}
        onMove={actualizarBearingViewport}
        onError={(e) => {
          // ArcGIS puede devolver HTTP 200 con "API KEY REQUIRED". Todo error
          // durante la carga nominal activa el fallback, pero solo se conserva
          // una categoría segura, nunca el objeto/URL crudo del SDK.
          if (token && !arcgisFallo && basemapEstado !== 'arcgis') {
            activarFallbackBasemap(estadoBasemapError(e?.error));
            return;
          }
          if (!mapListo) setMapError('No se pudo cargar el mapa. Revisa la red o la configuración del basemap.');
        }}
        onDragStart={manejarInicioGesto}
        onRotateStart={manejarInicioGesto}
        onPitchStart={manejarInicioGesto}
        onZoomStart={manejarInicioGesto}
        // BasemapStyle añade la atribución oficial de Esri/proveedores. Para
        // OSM se monta el control equivalente de react-map-gl debajo.
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {basemapEstado === 'osm-fallback' && (
          <AttributionControl compact customAttribution="© OpenStreetMap contributors" />
        )}
        <NavigationControl position="top-right" visualizePitch={true} showZoom={true} showCompass={true} />

        {/* Halo de precisión del GPS: transparencia honesta sobre el error. */}
        {haloVisible && (
          <Source id="halo-precision" type="geojson" data={circuloGeoJSON(displayPosition.lat, displayPosition.lng, accuracyForFrame)}>
            <Layer id="halo-precision-fill" type="fill" paint={{ 'fill-color': colores.acento, 'fill-opacity': 0.08 }} />
            <Layer id="halo-precision-line" type="line" paint={{ 'line-color': colores.acento, 'line-opacity': 0.35, 'line-width': 1 }} />
          </Source>
        )}

        {/* Trayecto: lo recorrido se atenúa, lo que falta va destacado. */}
        {mostrarTrayecto && lineaGeoJSON(tramos?.recorrido) && (
          <Source id="ruta-recorrida" type="geojson" data={lineaGeoJSON(tramos.recorrido)}>
            <Layer
              id="ruta-recorrida-linea"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colores.rutaHecha, 'line-width': 5, 'line-opacity': 0.6 }}
            />
          </Source>
        )}
        {mostrarTrayecto && lineaGeoJSON(tramos?.restante) && (
          <Source id="ruta-restante" type="geojson" data={lineaGeoJSON(tramos.restante)}>
            <Layer
              id="ruta-restante-linea"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colores.rutaActiva, 'line-width': 6, 'line-opacity': 0.9 }}
            />
          </Source>
        )}

        {/* Marcador del sitio turístico. */}
        <Marker
          longitude={siteCenter[1]}
          latitude={siteCenter[0]}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopup('site');
          }}
        >
          <div className="site-marker-pin" />
        </Marker>

        {/* Marcador del usuario: flecha de navegación. */}
        {displayPosition && (
          <Marker
            longitude={displayPosition.lng}
            latitude={displayPosition.lat}
            anchor="center"
            rotationAlignment="viewport"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopup('user');
            }}
          >
            <FlechaUsuario rotacion={rotacionFlecha} />
          </Marker>
        )}

        {popup === 'site' && (
          <Popup
            longitude={siteCenter[1]}
            latitude={siteCenter[0]}
            anchor="bottom"
            offset={16}
            closeButton
            closeOnClick={false}
            onClose={() => setPopup(null)}
          >
            <h4>{site.name}</h4>
            <p>{site.address}</p>
          </Popup>
        )}
        {popup === 'user' && displayPosition && (
          <Popup
            longitude={displayPosition.lng}
            latitude={displayPosition.lat}
            anchor="bottom"
            offset={18}
            closeButton
            closeOnClick={false}
            onClose={() => setPopup(null)}
          >
            <h4>Tu Ubicación</h4>
            <p>Ubicación actual en Itagüí</p>
          </Popup>
        )}
      </Map>

      {/* Diagnóstico no intrusivo y seguro: deja claro cuándo OSM es fallback. */}
      {basemapEstado === 'osm-fallback' && (
        <div
          className="map-basemap-status"
          role="status"
          data-basemap-provider="osm-fallback"
          style={{
            position: 'absolute',
            left: '8px',
            bottom: '8px',
            maxWidth: 'calc(100% - 16px)',
            padding: '5px 8px',
            borderRadius: '4px',
            background: 'rgba(20, 24, 32, 0.82)',
            color: '#fff',
            fontSize: '11px',
            zIndex: 2,
          }}
        >
          Basemap: OSM (fallback). {etiquetaBasemap(basemapMotivo)}
        </div>
      )}

      {/* Diagnóstico: el mapa no cargó (visible en el móvil). */}
      {mapError && (
        <div className="map-error-banner">
          <span>Mapa base no cargó: {mapError}</span>
          <button onClick={() => setMapError(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {/* Activar la brújula (iOS pide permiso con un toque). Se mantiene visible
          también durante una ruta: el usuario puede haber iniciado el
          seguimiento antes de conceder el permiso. Si iOS ya lo denegó, ningún
          toque vuelve a abrir el diálogo nativo — se avisa en vez de dejar un
          botón que parecería no hacer nada. */}
      {orientacion.necesitaPermiso && (
        orientacion.permiso === 'denegado' ? (
          <p className="map-compass-btn map-compass-btn--denegado" title="Actívalo desde Ajustes del navegador para este sitio">
            <RiCompass3Line />
            <span>Brújula bloqueada: actívala en Ajustes del sitio</span>
          </p>
        ) : (
          <button className="map-compass-btn" onClick={orientacion.activar} title="Activar brújula para orientar la flecha">
            <RiCompass3Line />
            <span>Brújula</span>
          </button>
        )
      )}

      {/* Volver a centrar la cámara sobre el usuario tras mover el mapa. */}
      {enSeguimiento && cameraMode === CAMERA_MODES.FREE && (
        <div className="map-actions map-actions--recentrar">
          <button className="map-actions__btn" onClick={recenter}>
            <RiFocus3Line />
            <span>Centrar en mí</span>
          </button>
        </div>
      )}

      {/* Botón flotante para fijar ruta si se tiene la ubicación del usuario. */}
      {userPosition && onStartRoute && !mostrarTrayecto && (
        <div className="map-actions">
          <button className="map-actions__btn" onClick={onStartRoute}>
            <RiNavigationLine />
            <span>Fijar Ruta de Destino</span>
          </button>
        </div>
      )}
    </div>
  );
};
