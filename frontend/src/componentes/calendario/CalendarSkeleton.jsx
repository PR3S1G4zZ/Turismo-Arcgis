// src/componentes/calendario/CalendarSkeleton.jsx
import { WEEKDAY_NAMES } from '../../utilidades/events';
import './MonthCalendar.css';

// Placeholder del calendario con shimmer, mientras se cargan los eventos.
// Replica la estructura de MonthCalendar (7 columnas × 6 filas) para evitar
// saltos de layout al pasar del skeleton al contenido real.
export const CalendarSkeleton = () => {
  // Patrón fijo de "eventos" por celda para que el shimmer no parezca aleatorio.
  const eventCounts = [0, 1, 0, 2, 1, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 1, 0];

  return (
    <div className="month-calendar" aria-hidden="true">
      <div className="month-calendar__weekdays">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="month-calendar__weekday">{name}</div>
        ))}
      </div>

      <div className="month-calendar__grid">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="month-calendar__cell month-calendar__cell--skeleton">
            <span className="skeleton month-calendar__skeleton-date" />
            <span className="month-calendar__events">
              {Array.from({ length: eventCounts[i % eventCounts.length] }).map((__, j) => (
                <span key={j} className="skeleton month-calendar__skeleton-event" />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
