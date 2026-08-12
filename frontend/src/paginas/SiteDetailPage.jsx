// src/paginas/SiteDetailPage.jsx
import { useContext, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RiArrowLeftLine,
  RiTimeLine,
  RiMapPin2Line,
  RiPhoneLine,
  RiRoadMapLine
} from 'react-icons/ri';
import { AppContext } from '../contexto/AppContext';
import { NavegacionContext } from '../contexto/NavegacionContext';
import { InteractiveMap } from '../componentes/detalle/InteractiveMap';
import { resolveImage } from '../utilidades/image';
import './SiteDetailPage.css';

export const SiteDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sites, incrementVisit, setActiveRouteSite, setIsRouteOpen, siteVisits } = useContext(AppContext);
  const { gpsCargando: geoLoading } = useContext(NavegacionContext);

  const site = sites.find(s => s.id === parseInt(id));

  // Incrementar visita una sola vez por sitio, evitando el doble conteo
  // que provoca el doble montaje de React StrictMode.
  const countedSiteId = useRef(null);
  useEffect(() => {
    if (site && countedSiteId.current !== site.id) {
      countedSiteId.current = site.id;
      incrementVisit(site.id);
    }
  }, [site, incrementVisit]);

  if (!site) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2>Sitio no encontrado</h2>
        <button className="detail-back-btn" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
          <RiArrowLeftLine /> Volver al Inicio
        </button>
      </div>
    );
  }

  // Coordenadas para mostrar
  const latStr = site.lat ? `${parseFloat(site.lat).toFixed(4)}° N` : '6.1718° N';
  const lngStr = site.lng ? `${Math.abs(parseFloat(site.lng)).toFixed(4)}° W` : '75.6094° W';

  // Gestión de imágenes secundarias
  const mainImage = site.images && site.images[0] ? resolveImage(site.images[0]) : 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=800&q=80';
  const secImage1 = site.images && site.images[1] ? resolveImage(site.images[1]) : 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&q=80';
  const secImage2 = site.images && site.images[2] ? resolveImage(site.images[2]) : 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80';

  const hasMultipleImages = site.images && site.images.length >= 3;

  const handleStartRoute = () => {
    setActiveRouteSite(site);
    setIsRouteOpen(true);
  };

  return (
    <div className="detail-page-container">
      {/* Botón de volver */}
      <div className="container">
        <button className="detail-back-btn" onClick={() => navigate('/')}>
          <RiArrowLeftLine />
          <span>Volver a Inicio</span>
        </button>
      </div>

      {/* Hero Gallery Section (Stitch Style) */}
      <section className="detail-gallery-section">
        <div className={`detail-gallery-grid ${hasMultipleImages ? 'detail-gallery-grid--split' : 'detail-gallery-grid--single'}`}>
          <div className="detail-gallery__main">
            <img src={mainImage} alt={site.name} className="detail-gallery__img" />
          </div>
          {hasMultipleImages && (
            <div className="detail-gallery__secondary">
              <div className="detail-gallery__sub-wrap">
                <img src={secImage1} alt="Vista secundaria 1" className="detail-gallery__img" />
              </div>
              <div className="detail-gallery__sub-wrap">
                <img src={secImage2} alt="Vista secundaria 2" className="detail-gallery__img" />
              </div>
            </div>
          )}
        </div>

        {/* Overlay Info Card */}
        <div className="detail-gallery__overlay">
          <div className="container detail-gallery__overlay-container">
            <div className="detail-gallery__info-card">
              <span className="detail-gallery__coords">COORDS: {latStr}, {lngStr}</span>
              <h1 className="detail-gallery__title">{site.name}</h1>
              <div className="detail-gallery__meta-row">
                <span className="detail-gallery__meta-tag">{site.category}</span>
                <span className="detail-gallery__dot-sep"></span>
                <span className="detail-gallery__meta-tag">{site.hours}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Layout Grid (Stitch Style) */}
      <section className="container detail-content-section">
        <div className="detail-layout-grid">
          {/* Main Description (Left) */}
          <div className="detail-main-content">
            <h2 className="detail-section-subtitle">El corazón cultural de la ciudad</h2>
            <div className="detail-description-text">
              {site.description.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            {/* Statistics Block */}
            <div className="detail-stats-grid">
              <div className="detail-stat-card">
                <p className="detail-stat-title">INTERACCIONES</p>
                <p className="detail-stat-value">{siteVisits[site.id] || 0}</p>
              </div>
              <div className="detail-stat-card">
                <p className="detail-stat-title">CALIFICACIÓN</p>
                <p className="detail-stat-value">
                  {site.rating.toFixed(1)} <span className="detail-stat-sub">/ 5.0</span>
                </p>
              </div>
              <div className="detail-stat-card">
                <p className="detail-stat-title">UBICACIÓN</p>
                <p className="detail-stat-value" style={{ fontSize: '20px', fontWeight: '700' }}>ITAGÜÍ</p>
              </div>
              <div className="detail-stat-card">
                <p className="detail-stat-title">ESTADO</p>
                <p className="detail-stat-value" style={{ fontSize: '20px', color: 'var(--color-success)', fontWeight: '700' }}>ACTIVO</p>
              </div>
            </div>
          </div>

          {/* Sidebar (Right) */}
          <div className="detail-sidebar">
            {/* Action Card */}
            <div className="detail-action-card">
              <h3 className="detail-action-card__title">Inicia tu visita</h3>
              <p className="detail-action-card__desc">Descubre las rutas recomendadas y los puntos de interés cercanos a este destino.</p>
              <button className="detail-action-card__btn" onClick={handleStartRoute}>
                <RiRoadMapLine size={18} />
                <span>INICIAR RUTA</span>
              </button>
            </div>

            {/* Contact & Info List */}
            <div className="detail-contact-card">
              <ul className="detail-contact-list">
                <li className="detail-contact-item">
                  <RiMapPin2Line size={18} className="detail-contact-icon" />
                  <div>
                    <p className="detail-contact-label">Dirección</p>
                    <p className="detail-contact-value">{site.address}</p>
                  </div>
                </li>
                <li className="detail-contact-item">
                  <RiTimeLine size={18} className="detail-contact-icon" />
                  <div>
                    <p className="detail-contact-label">Horarios</p>
                    <p className="detail-contact-value">{site.hours}</p>
                  </div>
                </li>
                {site.phone && (
                  <li className="detail-contact-item">
                    <RiPhoneLine size={18} className="detail-contact-icon" />
                    <div>
                      <p className="detail-contact-label">Teléfono</p>
                      <p className="detail-contact-value">{site.phone}</p>
                    </div>
                  </li>
                )}
                {(site.instagram || site.facebook || site.website) && (
                  <li className="detail-contact-item detail-contact-item--socials">
                    <p className="detail-contact-label">Compartir y Contacto</p>
                    <div className="detail-social-row">
                      {site.website && (
                        <a href={site.website.startsWith('http') ? site.website : `https://${site.website}`} target="_blank" rel="noopener noreferrer" className="detail-social-pill" title="Sitio Web">
                          WEB
                        </a>
                      )}
                      {site.instagram && (
                        <a href={site.instagram.startsWith('http') ? site.instagram : `https://instagram.com/${site.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="detail-social-pill" title="Instagram">
                          IG
                        </a>
                      )}
                      {site.facebook && (
                        <a href={site.facebook.startsWith('http') ? site.facebook : `https://facebook.com/${site.facebook}`} target="_blank" rel="noopener noreferrer" className="detail-social-pill" title="Facebook">
                          FB
                        </a>
                      )}
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section (Stitch Style) */}
      <section className="container detail-map-section">
        <h3 className="detail-map-heading">Ubicación Geográfica</h3>
        <div className="detail-map-wrapper">
          <InteractiveMap
            site={site}
            onStartRoute={handleStartRoute}
          />
        </div>
        {geoLoading && (
          <p className="detail-map-loading">
            Buscando señal de GPS para sincronizar tu ruta...
          </p>
        )}
      </section>
    </div>
  );
};
export default SiteDetailPage;
