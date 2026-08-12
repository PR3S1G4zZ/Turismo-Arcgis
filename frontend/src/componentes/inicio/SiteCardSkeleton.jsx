// src/componentes/inicio/SiteCardSkeleton.jsx
import './SiteCard.css';

// Placeholder de SiteCard con shimmer, mientras se cargan los sitios.
// Replica la estructura de SiteCard para evitar saltos de layout.
export const SiteCardSkeleton = () => (
  <div className="site-card site-card--skeleton" aria-hidden="true">
    <div className="site-card__image-wrap skeleton" />

    <div className="site-card__body">
      <span className="skeleton site-card__skel-line site-card__skel-title" />
      <span className="skeleton site-card__skel-line" />
      <span className="skeleton site-card__skel-line site-card__skel-line--short" />

      <div className="site-card__tags">
        <span className="skeleton site-card__skel-tag" />
        <span className="skeleton site-card__skel-tag" />
      </div>

      <div className="site-card__footer">
        <span className="skeleton site-card__skel-line site-card__skel-line--meta" />
      </div>
    </div>
  </div>
);
