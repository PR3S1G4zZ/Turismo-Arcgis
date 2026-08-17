// src/componentes/admin/LocationPicker.jsx
// Selector de ubicación real para el formulario de sitios: un mapa con un
// marcador que el administrador puede arrastrar (o colocar con un clic) para
// fijar la ubicación EXACTA. El botón "Buscar dirección" geocodifica el texto
// vía el backend y centra el marcador; luego se ajusta a mano si hace falta.
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RiMapPin2Line, RiSearchLine } from 'react-icons/ri';
import { geocodeApi } from '../../utilidades/api';
import './LocationPicker.css';

const ITAGUI_CENTER = [6.1724, -75.6091];

const pinIcon = L.divIcon({
  className: 'picker-map-icon',
  html: '<div class="picker-marker-pin"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Centra el mapa cuando cambian las coordenadas seleccionadas.
function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      const zoom = map.getZoom() < 15 ? 16 : map.getZoom();
      map.setView(center, zoom);
    }
  }, [center, map]);
  return null;
}

// Marcador arrastrable + colocación por clic en el mapa.
function DraggableMarker({ position, onMove }) {
  useMapEvents({
    click(e) { onMove(e.latlng.lat, e.latlng.lng); },
  });
  if (!position) return null;
  return (
    <Marker
      position={position}
      icon={pinIcon}
      draggable
      eventHandlers={{
        dragend(e) {
          const m = e.target.getLatLng();
          onMove(m.lat, m.lng);
        },
      }}
    />
  );
}

export function LocationPicker({ address, lat, lng, onChange, showAlert, showSearch = true }) {
  const [searching, setSearching] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const hasCoords =
    lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const position = hasCoords ? [Number(lat), Number(lng)] : null;
  const center = position || ITAGUI_CENTER;

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const handleSearch = async () => {
    if (!address || !address.trim()) {
      showAlert?.('Dirección vacía', 'Escribe primero la dirección para buscarla en el mapa.', 'warning');
      return;
    }
    setSearching(true);
    try {
      const r = await geocodeApi.search(address);
      onChange(r.lat, r.lng);
      if (!r.found) {
        showAlert?.(
          'Ubicación aproximada',
          'No se encontró la dirección exacta. Arrastra el marcador al punto correcto en el mapa.',
          'warning'
        );
      }
    } catch (err) {
      showAlert?.('Error', err.message || 'No se pudo buscar la dirección.', 'danger');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="location-picker">
      <div className="location-picker__toolbar">
        {showSearch && (
          <button type="button" className="btn-secondary location-picker__search-btn" onClick={handleSearch} disabled={searching}>
            <RiSearchLine size={16} />
            <span>{searching ? 'Buscando…' : 'Buscar dirección en el mapa'}</span>
          </button>
        )}
        <span className="location-picker__coords font-mono">
          {hasCoords ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : 'Sin ubicación fijada'}
        </span>
      </div>

      <div className="location-picker__map">
        <MapContainer center={center} zoom={hasCoords ? 16 : 14} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <Recenter center={position} />
          <TileLayer
            key={isDark ? 'dark' : 'light'}
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url={tileUrl}
          />
          <DraggableMarker position={position} onMove={onChange} />
        </MapContainer>
      </div>

      <p className="location-picker__hint">
        <RiMapPin2Line size={14} />
        <span>Haz clic o arrastra el marcador para fijar la ubicación exacta del sitio.</span>
      </p>
    </div>
  );
}
