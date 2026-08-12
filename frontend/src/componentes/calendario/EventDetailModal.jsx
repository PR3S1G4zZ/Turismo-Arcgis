// src/componentes/calendario/EventDetailModal.jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiTimeLine, RiMapPin2Line, RiGoogleFill, RiCalendarEventLine } from 'react-icons/ri';
import { MONTH_NAMES } from '../../utilidades/events';
import './EventDetailModal.css';

// Título legible en español a partir de una clave YYYY-MM-DD.
const formatDayTitle = (dateKey) => {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
};

export const EventDetailModal = ({ isOpen, dateKey, events, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="event-modal-backdrop" onClick={onClose}>
      <div className="event-modal" onClick={(e) => e.stopPropagation()}>
        <button className="event-modal__close" onClick={onClose} aria-label="Cerrar">
          <RiCloseLine />
        </button>

        <div className="event-modal__header">
          <RiCalendarEventLine className="event-modal__header-icon" />
          <div>
            <p className="event-modal__eyebrow">Eventos del día</p>
            <h3 className="event-modal__title">{formatDayTitle(dateKey)}</h3>
          </div>
        </div>

        <div className="event-modal__body">
          {events.length === 0 ? (
            <p className="event-modal__empty">No hay eventos programados para este día.</p>
          ) : (
            <ul className="event-modal__list">
              {events.map((event) => (
                <li key={event.id} className={`event-modal__item event-modal__item--${event.source}`}>
                  <div className="event-modal__item-head">
                    <h4 className="event-modal__item-title">{event.title}</h4>
                    {event.source === 'google' && (
                      <span className="event-modal__badge" title="Importado de Google Calendar">
                        <RiGoogleFill /> Google
                      </span>
                    )}
                  </div>

                  <div className="event-modal__meta">
                    {(event.startTime || event.endTime) && (
                      <span className="event-modal__meta-item">
                        <RiTimeLine />
                        {event.startTime || '—'}{event.endTime ? ` – ${event.endTime}` : ''}
                      </span>
                    )}
                    {!event.startTime && !event.endTime && (
                      <span className="event-modal__meta-item">Todo el día</span>
                    )}
                    {event.location && (
                      <span className="event-modal__meta-item">
                        <RiMapPin2Line />
                        {event.location}
                      </span>
                    )}
                  </div>

                  {event.description && (
                    <p className="event-modal__desc">{event.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
