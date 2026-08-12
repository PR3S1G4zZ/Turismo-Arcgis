// src/componentes/estructura/Header.jsx
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RiSunLine, RiMoonLine, RiMenuLine, RiCloseLine } from 'react-icons/ri';
import { useDarkMode } from '../../hooks/useDarkMode';
import './Header.css';

export const Header = () => {
  const [isDark, toggleDark] = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="container header__container">
        <Link to="/" className="header__logo" onClick={handleLinkClick}>
          {/* Escudo SVG de Itagüí / Icono estilizado */}
          <svg className="header__logo-img" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span className="header__title">Turismo Itagüí</span>
        </Link>

        <nav className="header__nav">
          <ul className={`header__nav-list ${menuOpen ? 'header__nav-list--open' : ''}`}>
            <li>
              <Link 
                to="/" 
                className={`header__nav-link ${isActive('/') ? 'header__nav-link--active' : ''}`}
                onClick={handleLinkClick}
              >
                Inicio
              </Link>
            </li>
            <li>
              <Link
                to="/calendario"
                className={`header__nav-link ${isActive('/calendario') ? 'header__nav-link--active' : ''}`}
                onClick={handleLinkClick}
              >
                Calendario
              </Link>
            </li>
            <li>
              <Link
                to="/pqrs"
                className={`header__nav-link ${isActive('/pqrs') ? 'header__nav-link--active' : ''}`}
                onClick={handleLinkClick}
              >
                PQRS
              </Link>
            </li>
            <li>
              <Link 
                to="/admin" 
                className={`header__nav-link ${isActive('/admin') ? 'header__nav-link--active' : ''}`}
                onClick={handleLinkClick}
              >
                Administrador
              </Link>
            </li>
          </ul>

          <div className="header__controls">
            <button 
              className="header__btn" 
              onClick={toggleDark}
              aria-label="Alternar modo de color"
              title={isDark ? "Activar modo claro" : "Activar modo oscuro"}
            >
              {isDark ? <RiSunLine /> : <RiMoonLine />}
            </button>

            <button 
              className="header__btn header__mobile-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú móvil"
            >
              {menuOpen ? <RiCloseLine /> : <RiMenuLine />}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
