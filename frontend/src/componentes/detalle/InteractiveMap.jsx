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
import { useOrientacion } from '../../hooks/useOrientacion';
import { mapaApi } from '../../utilidades/api';
import {
  EDAD_MAXIMA_BRUJULA_MS,
  VELOCIDAD_MIN_MS,
  normalizarRumbo,
  rotacionRelativaViewport,
  seleccionarRumbo,
  tangenteRuta,
} from '../../utilidades/geoRuta';
import { marcar, medir, MARCAS, TRAMOS } from '../../utilidades/diagnosticoLatencias';
import './InteractiveMap.css';

// Zoom cercano mientras se navega, para ver la calle y la siguiente esquina.
const ZOOM_NAVEGACION = 17;
const ZOOM_VISTA = 15;
// Inclinación de la cámara al navegar: el toque 3D de Waze/Google (grados).
const PITCH_NAVEGACION = 50;

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

/**
 * Interpola suavemente la posición DIBUJADA del usuario entre lecturas reales
 * del GPS (llegan más o menos 1 por segundo): sin esto, el punto salta de
 * golpe en vez de deslizarse. La posición REAL (la que usan el avance sobre
 * la ruta, el ETA y la cámara) no se toca — esto solo suaviza lo visual.
 */
function usePosicionAnimada(objetivo, duracionMs = 600) {
  const [mostrada, setMostrada] = useState(objetivo);
  const mostradaRef = useRef(objetivo);
  const rafRef = useRef(null);

  useEffect(() => {
    // Nada que animar: sin destino no hay hacia dónde deslizarse. El valor
    // de retorno del hook ya cae a `null` más abajo sin tocar este estado.
    if (!objetivo) return;

    const origen = mostradaRef.current;
    if (!origen) {
      mostradaRef.current = objetivo;
      setMostrada(objetivo);
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let inicio = null;
    const paso = (t) => {
      if (inicio == null) {
        inicio = t;
        marcar(MARCAS.MARCADOR_RENDER);
        medir(TRAMOS.GPS_MARCADOR, MARCAS.GPS_ACEPTADO, MARCAS.MARCADOR_RENDER);
      }
      const avance = Math.min(1, (t - inicio) / duracionMs);
      const suavizado = 1 - (1 - avance) ** 3; // ease-out cúbico
      const punto = {
        lat: origen.lat + (objetivo.lat - origen.lat) * suavizado,
        lng: origen.lng + (objetivo.lng - origen.lng) * suavizado,
      };
      mostradaRef.current = punto;
      setMostrada(punto);
      if (avance < 1) rafRef.current = requestAnimationFrame(paso);
    };
    rafRef.current = requestAnimationFrame(paso);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo?.lat, objetivo?.lng, duracionMs]);

  return objetivo ? mostrada : null;
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
  } = navegacion || {};

  // Brújula del dispositivo: hace girar la flecha cuando el usuario está parado.
  const orientacion = useOrientacion();

  // Posición dibujada del usuario, deslizándose entre lecturas reales del GPS
  // en vez de saltar. Se usa solo para el marcador y su halo — el avance de
  // ruta y la cámara siguen leyendo `userPosition` directo, sin retraso.
  const posicionAnimada = usePosicionAnimada(
    userPosition ? { lat: userPosition.lat, lng: userPosition.lng } : null
  );

  const mapRef = useRef(null);
  const mapaNativoRef = useRef(null);
  const basemapRef = useRef(null);
  const basemapTemaRef = useRef(null);
  const esriAttributionRef = useRef(null);
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

  // La cámara sigue al usuario mientras navega, salvo que él mueva el mapa.
  const [siguiendo, setSiguiendo] = useState(true);
  const dejarDeSeguir = useCallback(() => setSiguiendo(false), []);
  const sesionEnVivoRef = useRef(false);
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
  const enSeguimiento = mostrarTrayecto && navegando && gpsConfiable && !posicionSimulada;

  const manejarInicioGesto = useCallback((event) => {
    // MapLibre emits the same lifecycle events for camera transitions started
    // by the application. Only an event with `originalEvent` is attributable
    // to a real pointer/touch/keyboard gesture by the user.
    if (!event?.originalEvent) return;
    if (enSeguimiento) dejarDeSeguir();
  }, [enSeguimiento, dejarDeSeguir]);

  const moviendo = (userPosition?.speed ?? 0) > VELOCIDAD_MIN_MS;
  const rumboElegido = seleccionarRumbo({
    moviendo,
    rumboMovimiento: userPosition?.heading,
    gpsConfiable,
    rumboBrujula: orientacion.heading,
    permisoBrujula: orientacion.permiso,
    ultimaLecturaBrujula: orientacion.ultimaActualizacion,
    // En cada render provocado por GPS o brújula, el timestamp más reciente
    // ofrece un reloj estable sin ejecutar una función impura durante render.
    ahora: Math.max(
      Number.isFinite(ultimaActualizacion) ? ultimaActualizacion : 0,
      Number.isFinite(orientacion.ultimaActualizacion) ? orientacion.ultimaActualizacion : 0,
    ),
    maxEdadBrujulaMs: EDAD_MAXIMA_BRUJULA_MS,
    rumboRespaldo: tangenteRuta(ruta, avanceRuta?.indice),
  });
  const rotacionFlecha = rumboElegido
    ? rotacionRelativaViewport(rumboElegido.rumbo, bearingViewport) ?? 0
    : 0;
  const rumboVisual = rumboElegido?.rumbo ?? null;
  const fuenteRumbo = rumboElegido?.fuente ?? null;

  // El efecto se declara antes del retorno de carga para conservar el orden
  // de hooks en todos los estados del mapa.
  useEffect(() => {
    if (!userPosition || rumboVisual == null) return;
    marcar(MARCAS.FLECHA_RENDER);
    medir(
      TRAMOS.ORIENTACION_FLECHA,
      fuenteRumbo === 'brujula' ? MARCAS.ORIENTACION_CAMBIO : MARCAS.GPS_ACEPTADO,
      MARCAS.FLECHA_RENDER,
    );
  }, [userPosition, rumboVisual, fuenteRumbo, rotacionFlecha]);

  const mapStyle = useMemo(() => {
    // Con key configurada se monta una superficie local vacía mientras el
    // plugin solicita el estilo oficial; así ArcGIS es la ruta nominal y no
    // se solicita OSM antes de conocer el resultado de esa carga.
    if (token && !arcgisFallo) return EMPTY_MAP_STYLE;
    return OSM_RASTER_STYLE;
  }, [token, arcgisFallo]);

  // Solo una transición real de la navegación inactiva a activa inicia el
  // seguimiento. Una pérdida y recuperación de GPS no debe deshacer una pausa
  // manual de la cámara dentro de la misma sesión.
  useEffect(() => {
    const sesionActiva = mostrarTrayecto && navegando;
    if (!sesionActiva) {
      sesionEnVivoRef.current = false;
      return;
    }
    if (!sesionEnVivoRef.current) setSiguiendo(true);
    sesionEnVivoRef.current = true;
  }, [mostrarTrayecto, navegando]);

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

  // Al navegar y con seguimiento activo: centra en el usuario, ROTA el mapa
  // hacia su rumbo (course-up) e inclina la cámara para el efecto 3D.
  useEffect(() => {
    if (!mapListo || !enSeguimiento || !siguiendo || !userPosition) return;
    const map = mapRef.current;
    if (!map) return;
    const bearingMapa = map.getBearing?.();
    const rumboCamara = normalizarRumbo(rumboVisual);
    const bearing = rumboCamara != null
      ? rumboCamara
      : Number.isFinite(bearingMapa)
        ? bearingMapa
        : bearingViewportRef.current;
    map.easeTo({
      center: [userPosition.lng, userPosition.lat],
      bearing,
      pitch: PITCH_NAVEGACION,
      zoom: Math.max(map.getZoom(), ZOOM_NAVEGACION),
      duration: 250,
    });
    actualizarBearingViewport({ viewState: { bearing } });
    marcar(MARCAS.CAMARA_ACTUALIZADA);
    medir(TRAMOS.GPS_CAMARA, MARCAS.GPS_ACEPTADO, MARCAS.CAMARA_ACTUALIZADA);
  }, [mapListo, enSeguimiento, siguiendo, userPosition, rumboVisual, actualizarBearingViewport]);

  useEffect(() => {
    if (orientacion.heading == null) return;
    marcar(MARCAS.FLECHA_RENDER);
    medir(TRAMOS.ORIENTACION_FLECHA, MARCAS.ORIENTACION_CAMBIO, MARCAS.FLECHA_RENDER);
  }, [orientacion.heading]);

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

  // Rotación de la flecha:
  //  - Navegando: el mapa ya gira (course-up), así que la flecha apunta arriba.
  //  - Caminando (hay velocidad): manda el rumbo del GPS (dirección de marcha).
  //  - Parado: manda la brújula (hacia dónde apuntas), como el cono de Google.
  // `posicionAnimada` puede tardar un render en ponerse al día justo cuando
  // `userPosition` pasa de null a un valor real (la transición la resuelve un
  // efecto, no el render); se exige también acá para no leer .lat de null.
  const haloVisible = userPosition && posicionAnimada && userPosition.accuracy > 25;

  return (
    <div
      className="map-container"
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
          <Source id="halo-precision" type="geojson" data={circuloGeoJSON(posicionAnimada.lat, posicionAnimada.lng, userPosition.accuracy)}>
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
        {userPosition && posicionAnimada && (
          <Marker
            longitude={posicionAnimada.lng}
            latitude={posicionAnimada.lat}
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
        {popup === 'user' && userPosition && posicionAnimada && (
          <Popup
            longitude={posicionAnimada.lng}
            latitude={posicionAnimada.lat}
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
      {enSeguimiento && !siguiendo && (
        <div className="map-actions map-actions--recentrar">
          <button className="map-actions__btn" onClick={() => setSiguiendo(true)}>
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
