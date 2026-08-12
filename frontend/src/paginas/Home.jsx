import { useContext, useState, useEffect } from 'react';
import { AppContext } from '../contexto/AppContext';
import { zoneOptions, DEFAULT_ZONE } from '../datos/zones';
import { EventSlider } from '../componentes/inicio/EventSlider';
import { SiteCard } from '../componentes/inicio/SiteCard';
import { SiteCardSkeleton } from '../componentes/inicio/SiteCardSkeleton';
import { 
  RiGridLine, 
  RiLeafLine, 
  RiPaletteLine, 
  RiRestaurantLine, 
  RiBuildingLine, 
  RiStore2Line,
  RiSearchLine,
  RiArrowDownSLine
} from 'react-icons/ri';
import './Home.css';

const CATEGORIES = [
  { id: 'Todos', name: 'Todos', icon: RiGridLine },
  { id: 'Parque', name: 'Parques', icon: RiLeafLine },
  { id: 'Cultura', name: 'Cultura', icon: RiPaletteLine },
  { id: 'Restaurante', name: 'Gastronomía', icon: RiRestaurantLine },
  { id: 'Museo', name: 'Museos', icon: RiBuildingLine },
  { id: 'Comercio', name: 'Comercio', icon: RiStore2Line }
];

export const Home = () => {
  const { sites, announcements, loading } = useContext(AppContext);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado para simular la georreferenciación por zonas
  const [currentZone, setCurrentZone] = useState(() => {
    return localStorage.getItem('user_simulated_zone') || DEFAULT_ZONE;
  });

  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);

  // Skeletons de las tarjetas: se muestran mientras el backend responde y, como
  // mínimo, un breve instante para una sensación de carga pulida.
  const [minDelayDone, setMinDelayDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinDelayDone(true), 550);
    return () => clearTimeout(timer);
  }, []);
  const isLoading = loading || !minDelayDone;

  useEffect(() => {
    if (!isZoneDropdownOpen) return;
    const handleClose = () => setIsZoneDropdownOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isZoneDropdownOpen]);

  const handleZoneChange = (zone) => {
    setCurrentZone(zone);
    localStorage.setItem('user_simulated_zone', zone);
  };

  // Filtrar anuncios basados en la zona seleccionada (si el anuncio tiene una zona asociada)
  const zoneAnnouncements = announcements.filter(ann => !ann.zone || ann.zone === currentZone);
  const displayAnnouncements = zoneAnnouncements.length > 0 ? zoneAnnouncements : announcements;

  // Sitios de interés sugeridos en la zona actual
  const nearbySites = sites.filter(site => site.zone === currentZone);

  // Sitios generales aplicando categoría y búsqueda
  const filteredSites = sites.filter(site => {
    const matchesCategory = selectedCategory === 'Todos' || site.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      site.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="home-section container">
      
      {/* SIMULADOR DE GEORREFERENCIACIÓN */}
      {/* Carrusel de Anuncios Priorizado por Zona */}
      <div className="announcements-section">
        <div className="announcements-section__header">
          {/* Badge de zona que actúa como selector de comuna */}
          <div className="custom-dropdown zone-badge-dropdown" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`section-badge zone-badge-trigger ${isZoneDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)}
            >
              <span>Zona actual: {currentZone}</span>
              <RiArrowDownSLine className={`dropdown-arrow ${isZoneDropdownOpen ? 'open' : ''}`} />
            </button>
            {isZoneDropdownOpen && (
              <div className="custom-dropdown-menu zone-badge-menu">
                {zoneOptions.map(opt => (
                  <div
                    key={opt.value}
                    className={`custom-dropdown-option ${currentZone === opt.value ? 'selected' : ''}`}
                    onClick={() => {
                      handleZoneChange(opt.value);
                      setIsZoneDropdownOpen(false);
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <EventSlider announcements={displayAnnouncements} />
      </div>

      {/* Sugerencias de Sitios Cercanos (Georreferenciación) */}
      <div className="nearby-suggestions-section">
        <div className="home-section__header">
          <h3 className="home-section__title-double">Sugerencias Cercanas en {currentZone}</h3>
          <p className="home-section__subtitle">Descubrimientos a la mano en tu sector actual.</p>
        </div>
        
        {isLoading ? (
          <div className="sites-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <SiteCardSkeleton key={i} />
            ))}
          </div>
        ) : nearbySites.length > 0 ? (
          <div className="sites-grid">
            {nearbySites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        ) : (
          <div className="empty-state-zone">
            <p>No hay sitios registrados en esta zona de Itagüí. ¡Explora otras comunas simulando tu ubicación con el selector!</p>
          </div>
        )}
      </div>

      {/* Búsqueda General */}
      <div className="home-section__header main-explorer-title">
        <h3 className="home-section__title-double">Explorador General</h3>
      </div>

      {/* Categorías y Barra de Búsqueda de Filtro (Stitch Style) */}
      <div className="category-search-section">
        <div className="category-filters">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                className={`filter-btn ${selectedCategory === cat.id ? 'filter-btn--active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon size={16} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        <div className="search-bar">
          <RiSearchLine className="search-bar-icon" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="¿Qué buscas explorar?" 
            className="search-input"
          />
        </div>
      </div>

      {/* Grid de Sitios Generales */}
      {isLoading ? (
        <div className="sites-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SiteCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSites.length > 0 ? (
        <div className="sites-grid">
          {filteredSites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h4>No se encontraron sitios</h4>
          <p>No hay destinos registrados que coincidan con tu búsqueda en "{selectedCategory}".</p>
        </div>
      )}
    </div>
  );
};

export default Home;
