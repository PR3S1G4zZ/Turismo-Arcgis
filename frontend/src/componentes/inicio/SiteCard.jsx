// src/componentes/inicio/SiteCard.jsx
import { useNavigate } from 'react-router-dom';
import { RiTimeLine, RiArrowRightLine } from 'react-icons/ri';
import { resolveImage } from '../../utilidades/image';
import './SiteCard.css';

export const SiteCard = ({ site }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/site/${site.id}`);
  };

  // Convertir tags o clasificaciones a array seguro
  const tagsList = Array.isArray(site.tags) 
    ? site.tags 
    : typeof site.tags === 'string' && site.tags.trim() !== ''
      ? site.tags.split(',').map(t => t.trim())
      : site.classifications 
        ? Array.isArray(site.classifications)
          ? site.classifications
          : typeof site.classifications === 'string' && site.classifications.trim() !== ''
            ? site.classifications.split(',').map(t => t.trim())
            : []
        : [];

  return (
    <div className="site-card" onClick={handleCardClick}>
      <div className="site-card__image-wrap">
        <img 
          src={site.images && site.images[0] ? resolveImage(site.images[0]) : 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=800&q=80'} 
          alt={site.name} 
          loading="lazy"
        />
        <div className="site-card__image-badge">
          <span>{site.category}</span>
        </div>
      </div>

      <div className="site-card__body">
        <h3 className="site-card__name">{site.name}</h3>
        <p className="site-card__desc">{site.description}</p>
        
        {tagsList.length > 0 && (
          <div className="site-card__tags">
            {tagsList.map((tag, idx) => (
              <span key={idx} className="site-card__tag-badge">
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="site-card__footer">
          <div className="site-card__meta">
            <RiTimeLine className="site-card__meta-icon" />
            <span className="site-card__meta-text">{site.hours || 'Horario por confirmar'}</span>
          </div>
          <div className="site-card__action">
            <span className="site-card__action-text">Explorar</span>
            <RiArrowRightLine className="site-card__action-icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

