// src/componentes/inicio/EventSlider.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';
import { resolveImage } from '../../utilidades/image';
import './EventSlider.css';

export const EventSlider = ({ announcements }) => {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef(null);

  const length = announcements.length;

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev === length - 1 ? 0 : prev + 1));
  }, [length]);

  const prevSlide = () => {
    setCurrent((prev) => (prev === 0 ? length - 1 : prev - 1));
  };

  useEffect(() => {
    if (isHovered || length === 0) return;

    timeoutRef.current = setTimeout(nextSlide, 4000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [current, isHovered, length, nextSlide]);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // mínimo de 50px de deslizamiento
    
    if (diff > threshold) {
      nextSlide();
    } else if (diff < -threshold) {
      prevSlide();
    }
    
    // resetear valores
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (!Array.isArray(announcements) || length <= 0) {
    return null;
  }

  return (
    <div 
      className="slider"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Contenedor de slides */}
      <div 
        className="slider__track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {announcements.map((slide) => (
          <div className="slider__slide" key={slide.id}>
            <img src={resolveImage(slide.image)} alt={slide.title} className="slider__img" />
            <div className="slider__overlay">
              <span className="slider__badge">ANUNCIO DESTACADO</span>
              <h2 className="slider__title">{slide.title}</h2>
              <p className="slider__desc">{slide.date} • {slide.cta}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controles de Navegación del Carrusel en la parte inferior derecha */}
      <div className="slider__controls">
        <button className="slider__control-btn" onClick={prevSlide} aria-label="Anuncio anterior">
          <RiArrowLeftSLine size={20} />
        </button>
        <button className="slider__control-btn" onClick={nextSlide} aria-label="Siguiente anuncio">
          <RiArrowRightSLine size={20} />
        </button>
      </div>

      {/* Puntos indicadores */}
      <div className="slider__dots">
        {announcements.map((_, idx) => (
          <button
            key={idx}
            className={`slider__dot ${current === idx ? 'slider__dot--active' : ''}`}
            onClick={() => setCurrent(idx)}
            aria-label={`Ir al anuncio ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
