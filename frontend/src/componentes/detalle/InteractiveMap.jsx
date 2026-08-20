// src/componentes/detalle/InteractiveMap.jsx
// Mapa de navegación estilo Waze/Google Maps sobre MapLibre GL:
//  - la ubicación del usuario es una FLECHA que apunta a su dirección de marcha,
//  - al navegar, el MAPA ROTA para que la marcha quede siempre hacia arriba
//    (modo course-up) con una leve inclinación 3D,
//  - el basemap es el vectorial de ArcGIS ("navigation"), con respaldo a CARTO.
// El motor de navegación (rutas, voz, recálculo) vive en useNavegacion y no se
// toca aquí: este componente solo dibuja y mueve la cámara.
import { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RiNavigationLine, RiFocus3Line, RiCompass3Line } from 'react-icons/ri';
import { NavegacionContext } from '../../contexto/NavegacionContext';
import { useOrientacion } from '../../hooks/useOrientacion';
import { mapaApi } from '../../utilidades/api';
import './InteractiveMap.css';

// Zoom cercano mientras se navega, para ver la calle y la siguiente esquina.
const ZOOM_NAVEGACION = 17;
const ZOOM_VISTA = 15;
// Inclinación de la cámara al navegar: el toque 3D de Waze/Google (grados).
const PITCH_NAVEGACION = 50;

// Basemaps de respaldo (vectoriales, sin token) si ArcGIS no está disponible.
const CARTO_CLARO = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const CARTO_OSCURO = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** URL del estilo vectorial de ArcGIS ("navigation" / "navigation-night"). */
const estiloArcgis = (isDark, token) =>
  `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/${
    isDark ? 'navigation-night' : 'navigation'
  }?token=${encodeURIComponent(token)}`;

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
      if (inicio == null) inicio = t;
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
    tramos,
    ruta,
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
  const [mapListo, setMapListo] = useState(false);

  const [coordinates, setCoordinates] = useState(() => {
    if (site.lat && site.lng) return [parseFloat(site.lat), parseFloat(site.lng)];
    return null;
  });
  const [loading, setLoading] = useState(() => !(site.lat && site.lng));
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Token del basemap de ArcGIS (null → se usa el respaldo de CARTO).
  const [token, setToken] = useState(null);
  const [tokenListo, setTokenListo] = useState(false);
  // Se activa si ArcGIS rechaza el token: entonces se cae al respaldo de CARTO.
  const [arcgisFallo, setArcgisFallo] = useState(false);
  // Mensaje si el basemap no logra cargar (diagnóstico visible en el móvil).
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

  // Token del basemap, una vez al montar.
  useEffect(() => {
    let vivo = true;
    mapaApi.token().then((t) => {
      if (!vivo) return;
      setToken(t);
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

  const mapStyle = useMemo(() => {
    if (token && !arcgisFallo) return estiloArcgis(isDark, token);
    return isDark ? CARTO_OSCURO : CARTO_CLARO;
  }, [token, isDark, arcgisFallo]);

  // Asegura el token en TODA petición a ArcGIS (tiles, glyphs, sprites), no solo
  // en la URL del estilo: si el servicio no las devuelve ya firmadas, el mapa se
  // quedaría en blanco. Se evita el doble token si ya viene incluido.
  const transformRequest = useCallback(
    (url) => {
      if (token && url.includes('.arcgis.com') && !/[?&]token=/.test(url)) {
        return { url: `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` };
      }
      return { url };
    },
    [token]
  );

  // Cada entrada a una sesión de GPS en vivo recupera el seguimiento aunque la
  // sesión anterior hubiera quedado pausada por un gesto manual.
  useEffect(() => {
    if (enSeguimiento && !sesionEnVivoRef.current) setSiguiendo(true);
    sesionEnVivoRef.current = enSeguimiento;
  }, [enSeguimiento]);

  // ─── Cámara ───────────────────────────────────────────────
  // Al navegar y con seguimiento activo: centra en el usuario, ROTA el mapa
  // hacia su rumbo (course-up) e inclina la cámara para el efecto 3D.
  useEffect(() => {
    if (!mapListo || !enSeguimiento || !siguiendo || !userPosition) return;
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.easeTo({
      center: [userPosition.lng, userPosition.lat],
      bearing: Number.isFinite(userPosition.heading) ? userPosition.heading : map.getBearing(),
      pitch: PITCH_NAVEGACION,
      zoom: Math.max(map.getZoom(), ZOOM_NAVEGACION),
      duration: 250,
    });
  }, [mapListo, enSeguimiento, siguiendo, userPosition]);

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
  const moviendo = (userPosition?.speed ?? 0) > 0.7;
  let rotacionFlecha = 0;
  if (!enSeguimiento) {
    if (moviendo && userPosition?.heading != null) rotacionFlecha = userPosition.heading;
    else if (orientacion.heading != null) rotacionFlecha = orientacion.heading;
    else if (userPosition?.heading != null) rotacionFlecha = userPosition.heading;
  }

  // `posicionAnimada` puede tardar un render en ponerse al día justo cuando
  // `userPosition` pasa de null a un valor real (la transición la resuelve un
  // efecto, no el render); se exige también acá para no leer .lat de null.
  const haloVisible = userPosition && posicionAnimada && userPosition.accuracy > 25;

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        cooperativeGestures={!showRoute}
        locale={{
          'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
          'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + scroll para hacer zoom',
          'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + scroll para hacer zoom',
        }}
        onLoad={(e) => {
          setMapListo(true);
          setMapError(null);
          // Gestos cooperativos en el mapa informativo embebido: con UN dedo la
          // página hace scroll (no queda atrapado en el mapa) y con DOS dedos se
          // mueve el mapa. En el de ruta a pantalla completa se deja el pan de un
          // dedo. Se hace también imperativo por si la prop no se reenvía.
          const map = e?.target;
          if (map?.cooperativeGestures) {
            if (showRoute) map.cooperativeGestures.disable();
            else map.cooperativeGestures.enable();
          }
        }}
        initialViewState={{
          longitude: mapCenter[1],
          latitude: mapCenter[0],
          zoom: enSeguimiento ? ZOOM_NAVEGACION : ZOOM_VISTA,
        }}
        mapStyle={mapStyle}
        transformRequest={transformRequest}
        onError={(e) => {
          const status = e?.error?.status;
          const msg = e?.error?.message || String(e?.error || 'error desconocido');
          console.error('[mapa] MapLibre error:', status, msg, e);
          // Si ArcGIS rechaza el token (auth), se cambia al basemap de respaldo
          // en vez de dejar el mapa en blanco.
          if (token && !arcgisFallo && [401, 403, 498, 499].includes(status)) {
            console.warn(`[mapa] Basemap de ArcGIS rechazado (${status}); usando respaldo CARTO.`);
            setArcgisFallo(true);
            return;
          }
          // El aviso solo aparece si el mapa aún no cargó su estilo (fallo real
          // del basemap); los errores transitorios de tiles ya en marcha se ignoran.
          if (!mapListo) setMapError(`${status ? status + ' – ' : ''}${msg}`);
        }}
        onDragStart={() => {
          if (enSeguimiento) dejarDeSeguir();
        }}
        onRotateStart={() => {
          if (enSeguimiento) dejarDeSeguir();
        }}
        onPitchStart={() => {
          if (enSeguimiento) dejarDeSeguir();
        }}
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%' }}
      >
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

      {/* Diagnóstico: el basemap no cargó (visible en el móvil). */}
      {mapError && (
        <div className="map-error-banner">
          <span>Mapa base no cargó: {mapError}</span>
          <button onClick={() => setMapError(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {/* Activar la brújula (iOS pide permiso con un toque). Solo se ofrece en el
          mapa informativo, cuando la plataforma lo exige y aún no se concedió.
          Si iOS ya lo denegó, ningún toque vuelve a abrir el diálogo nativo —
          se avisa en vez de dejar un botón que parecería no hacer nada. */}
      {!mostrarTrayecto && orientacion.necesitaPermiso && (
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
