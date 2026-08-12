// src/componentes/detalle/InteractiveMap.jsx
import { useEffect, useState, useContext, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RiNavigationLine, RiFocus3Line } from 'react-icons/ri';
import { NavegacionContext } from '../../contexto/NavegacionContext';
import './InteractiveMap.css';

// Zoom cercano mientras se navega, para ver la calle y la siguiente esquina.
const ZOOM_NAVEGACION = 17;
const ZOOM_VISTA = 15;

// Componente auxiliar para cambiar la vista del mapa reactivamente
function ChangeView({ center, zoom, activo = true }) {
  const map = useMap();
  useEffect(() => {
    if (center && activo) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map, activo]);
  return null;
}

/**
 * Cámara de navegación: sigue al usuario como un navegador de coche. El
 * seguimiento se suspende en cuanto se arrastra el mapa (para poder mirar el
 * recorrido) y se reanuda con el botón de recentrar.
 */
function CamaraNavegacion({ posicion, siguiendo, onArrastrar }) {
  const map = useMap();
  useMapEvent('dragstart', () => onArrastrar());

  useEffect(() => {
    if (!siguiendo || !posicion) return;
    map.setView([posicion.lat, posicion.lng], Math.max(map.getZoom(), ZOOM_NAVEGACION), {
      animate: true,
      duration: 0.6,
    });
  }, [posicion, siguiendo, map]);

  return null;
}

/** Encuadra la ruta completa una sola vez, al recibirla. */
function EncuadrarRuta({ puntos }) {
  const map = useMap();
  useEffect(() => {
    if (puntos && puntos.length > 1) {
      map.fitBounds(L.latLngBounds(puntos), { padding: [50, 50] });
    }
  }, [puntos, map]);
  return null;
}

// Icono personalizado para el GPS del usuario (Círculo azul/dorado pulsante)
const gpsIcon = L.divIcon({
  className: 'gps-pulse-icon',
  html: '<div class="gps-pulse-ring"></div><div class="gps-pulse-dot"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

// Icono personalizado para el sitio turístico (Círculo con borde azul y centro dorado)
const siteIcon = L.divIcon({
  className: 'site-map-icon',
  html: '<div class="site-marker-pin"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

export const InteractiveMap = ({ site, onStartRoute, showRoute = false }) => {
  const navegacion = useContext(NavegacionContext);
  const { posicion: userPosition, tramos, ruta, navegando, llegado } = navegacion || {};

  const [coordinates, setCoordinates] = useState(() => {
    if (site.lat && site.lng) return [parseFloat(site.lat), parseFloat(site.lng)];
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (site.lat && site.lng) return false;
    return true;
  });
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // La cámara sigue al usuario mientras navega, salvo que él mueva el mapa.
  // El mapa de navegación se monta al abrirse, así que arranca siempre en true.
  const [siguiendo, setSiguiendo] = useState(true);
  const dejarDeSeguir = useCallback(() => setSiguiendo(false), []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Si tiene coordenadas específicas guardadas, las usamos directamente (ya asignadas en lazy init, pero mantenemos por cambios de props)
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

    Promise.resolve().then(() => {
      setLoading(true);
    });
    const query = site.address.toLowerCase().includes('itagüí') || site.address.toLowerCase().includes('itagui')
      ? site.address
      : `${site.address}, Itagüí, Colombia`;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setCoordinates([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setCoordinates([6.1724, -75.6091]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Dynamic geocoding error:", err);
        setCoordinates([6.1724, -75.6091]);
        setLoading(false);
      });
  }, [site.address, site.lat, site.lng]);

  if (loading || !coordinates) {
    return (
      <div className="map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-alt)', minHeight: '300px' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Cargando ubicación en el mapa...</p>
      </div>
    );
  }

  const siteCenter = coordinates;
  const mapCenter = userPosition ? [userPosition.lat, userPosition.lng] : siteCenter;

  // El trayecto solo se pinta cuando esta instancia del mapa está en modo ruta
  // y hay una navegación viva; el resto del tiempo el mapa es informativo.
  const mostrarTrayecto = showRoute && ruta && (navegando || llegado);
  const enSeguimiento = mostrarTrayecto && navegando;

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="map-container">
      <MapContainer
        center={mapCenter}
        zoom={enSeguimiento ? ZOOM_NAVEGACION : ZOOM_VISTA}
        scrollWheelZoom={true}
      >
        {/* Fuera de navegación el mapa sigue centrado como antes. */}
        <ChangeView center={mapCenter} zoom={ZOOM_VISTA} activo={!mostrarTrayecto} />

        {/* Al recibir un trayecto nuevo se encuadra completo una vez... */}
        {mostrarTrayecto && <EncuadrarRuta puntos={ruta.puntos} />}
        {/* ...y a partir de ahí la cámara acompaña al usuario. */}
        {enSeguimiento && (
          <CamaraNavegacion
            posicion={userPosition}
            siguiendo={siguiendo}
            onArrastrar={dejarDeSeguir}
          />
        )}

        <TileLayer
          key={isDark ? 'dark-tiles' : 'light-tiles'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />

        {/* Marcador del sitio */}
        <Marker position={siteCenter} icon={siteIcon}>
          <Popup>
            <div>
              <h4>{site.name}</h4>
              <p>{site.address}</p>
            </div>
          </Popup>
        </Marker>

        {/* Marcador del usuario (si está disponible) */}
        {userPosition && (
          <>
            {/* Halo de precisión del GPS: transparencia honesta sobre el margen de error. */}
            {userPosition.accuracy > 25 && (
              <Circle
                center={[userPosition.lat, userPosition.lng]}
                radius={userPosition.accuracy}
                pathOptions={{ color: 'var(--color-accent)', weight: 1, opacity: 0.35, fillOpacity: 0.08 }}
              />
            )}
            <Marker position={[userPosition.lat, userPosition.lng]} icon={gpsIcon}>
              <Popup>
                <div>
                  <h4>Tu Ubicación</h4>
                  <p>Ubicación actual en Itagüí</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Trayecto: lo ya recorrido se atenúa, lo que falta va destacado. */}
        {mostrarTrayecto && tramos.recorrido.length > 1 && (
          <Polyline
            positions={tramos.recorrido}
            pathOptions={{ color: 'var(--color-text-secondary)', weight: 5, opacity: 0.45 }}
          />
        )}
        {mostrarTrayecto && tramos.restante.length > 1 && (
          <Polyline
            positions={tramos.restante}
            pathOptions={{ color: 'var(--color-accent)', weight: 6, opacity: 0.9 }}
          />
        )}
      </MapContainer>

      {/* Volver a centrar la cámara sobre el usuario tras mover el mapa. */}
      {enSeguimiento && !siguiendo && (
        <div className="map-actions map-actions--recentrar">
          <button className="map-actions__btn" onClick={() => setSiguiendo(true)}>
            <RiFocus3Line />
            <span>Centrar en mí</span>
          </button>
        </div>
      )}

      {/* Botón flotante para fijar ruta si se tiene la ubicación del usuario */}
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
