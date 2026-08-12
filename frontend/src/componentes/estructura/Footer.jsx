// src/componentes/estructura/Footer.jsx
import { Link } from 'react-router-dom';
import './Footer.css';

export const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <span className="footer__brand-title">Turismo Itagüí</span>
            <p className="footer__brand-desc">
              Portal oficial de información turística y rutas de interés del Municipio de Itagüí, Antioquia. Descubre nuestra cultura, gastronomía y reservas naturales.
            </p>
          </div>
          <div>
            <h4 className="footer__section-title">Mapa del Sitio</h4>
            <ul className="footer__links">
              <li><Link to="/" className="footer__link">Inicio</Link></li>
              <li><Link to="/pqrs" className="footer__link">PQRS y Contacto</Link></li>
              <li><Link to="/admin" className="footer__link">Administrador</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="footer__section-title">Enlaces Externos</h4>
            <ul className="footer__links">
              <li><a href="https://www.itagui.gov.co" target="_blank" rel="noopener noreferrer" className="footer__link">Alcaldía de Itagüí</a></li>
              <li><a href="https://corantioquia.gov.co" target="_blank" rel="noopener noreferrer" className="footer__link">Corantioquia</a></li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span className="footer__copy">
            &copy; {new Date().getFullYear()} Alcaldía de Itagüí. Todos los derechos reservados.
          </span>
          <span className="footer__author">
            Itagüí, Antioquia, Colombia
          </span>
        </div>
      </div>
    </footer>
  );
};
