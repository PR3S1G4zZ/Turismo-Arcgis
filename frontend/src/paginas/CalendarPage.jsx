// src/paginas/CalendarPage.jsx
import { useContext, useState, useEffect, useMemo } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCalendarEventLine, RiErrorWarningLine } from 'react-icons/ri';
import { AppContext } from '../contexto/AppContext';
import { MonthCalendar } from '../componentes/calendario/MonthCalendar';
import { CalendarSkeleton } from '../componentes/calendario/CalendarSkeleton';
import { EventDetailModal } from '../componentes/calendario/EventDetailModal';
import { fetchGoogleEvents } from '../utilidades/api';
import { formatMonthLabel, filterEventsByMonth, toMonthKey } from '../utilidades/events';
import './CalendarPage.css';

export const CalendarPage = () => {
  const { events, googleCalendarUrl } = useContext(AppContext);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [googleEvents, setGoogleEvents] = useState([]);
  // Si hay un calendario de Google configurado, arrancamos mostrando el skeleton
  // en lugar de un mensaje de carga, tanto al montar como al cambiar de mes.
  const [googleLoading, setGoogleLoading] = useState(() => Boolean(googleCalendarUrl));
  const [googleError, setGoogleError] = useState('');

  const [selectedDay, setSelectedDay] = useState(null); // { dateKey, events }

  const monthKey = toMonthKey(viewYear, viewMonth);

  // Traer los eventos de Google del mes visible cuando cambia el mes o la URL configurada.
  useEffect(() => {
    let cancelled = false;

    if (!googleCalendarUrl) {
      // Limpieza diferida a una microtarea para no hacer setState sincrónico en el efecto.
      Promise.resolve().then(() => {
        if (!cancelled) {
          setGoogleEvents([]);
          setGoogleError('');
        }
      });
      return () => { cancelled = true; };
    }

    Promise.resolve().then(() => {
      if (cancelled) return;
      setGoogleLoading(true);
      setGoogleError('');

      fetchGoogleEvents(googleCalendarUrl, monthKey)
        .then((evts) => {
          if (!cancelled) setGoogleEvents(evts);
        })
        .catch((err) => {
          if (!cancelled) {
            setGoogleEvents([]);
            setGoogleError(err.message);
          }
        })
        .finally(() => {
          if (!cancelled) setGoogleLoading(false);
        });
    });

    return () => { cancelled = true; };
  }, [googleCalendarUrl, monthKey]);

  // Eventos manuales del mes + eventos de Google, unificados para la cuadrícula.
  const monthEvents = useMemo(() => {
    const manual = filterEventsByMonth(events, viewYear, viewMonth);
    return [...manual, ...googleEvents];
  }, [events, googleEvents, viewYear, viewMonth]);

  // Cambia el mes visible. Si hay calendario de Google y el mes cambia,
  // activa el skeleton de inmediato (en el mismo render que el cambio de mes)
  // para que no haya parpadeo del contenido anterior.
  const applyMonth = (year, month) => {
    const changed = year !== viewYear || month !== viewMonth;
    setViewYear(year);
    setViewMonth(month);
    if (changed && googleCalendarUrl) {
      setGoogleLoading(true);
    }
  };

  const goToPreviousMonth = () => {
    if (viewMonth === 0) applyMonth(viewYear - 1, 11);
    else applyMonth(viewYear, viewMonth - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) applyMonth(viewYear + 1, 0);
    else applyMonth(viewYear, viewMonth + 1);
  };

  const goToToday = () => {
    applyMonth(today.getFullYear(), today.getMonth());
  };

  const handleSelectDay = (dateKey, dayEvents) => {
    setSelectedDay({ dateKey, events: dayEvents });
  };

  return (
    <div className="calendar-page container">
      <header className="calendar-page__header">
        <div className="calendar-page__title-group">
          <RiCalendarEventLine className="calendar-page__title-icon" />
          <div>
            <h1 className="calendar-page__title">Calendario de Eventos</h1>
            <p className="calendar-page__subtitle">
              Agenda cultural, deportiva y ciudadana de la Alcaldía de Itagüí.
            </p>
          </div>
        </div>
      </header>

      <div className="calendar-page__toolbar">
        <div className="calendar-page__nav">
          <button className="calendar-page__nav-btn" onClick={goToPreviousMonth} aria-label="Mes anterior">
            <RiArrowLeftSLine />
          </button>
          <h2 className="calendar-page__month-label">{formatMonthLabel(viewYear, viewMonth)}</h2>
          <button className="calendar-page__nav-btn" onClick={goToNextMonth} aria-label="Mes siguiente">
            <RiArrowRightSLine />
          </button>
        </div>
        <button className="calendar-page__today-btn" onClick={goToToday}>Hoy</button>
      </div>

      {/* Aviso de error de sincronización (no intrusivo) */}
      {googleError && !googleLoading && (
        <p className="calendar-page__status calendar-page__status--error">
          <RiErrorWarningLine /> No se pudieron cargar los eventos de Google: {googleError}
        </p>
      )}

      {/* Mientras se cargan los eventos de Google, mostramos un skeleton en
          lugar de un mensaje de carga para no romper el layout. */}
      {googleLoading ? (
        <CalendarSkeleton />
      ) : (
        <MonthCalendar
          year={viewYear}
          month={viewMonth}
          events={monthEvents}
          onSelectDay={handleSelectDay}
        />
      )}

      <EventDetailModal
        isOpen={selectedDay !== null}
        dateKey={selectedDay?.dateKey}
        events={selectedDay?.events || []}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
};

export default CalendarPage;
