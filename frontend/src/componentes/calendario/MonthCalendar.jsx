// src/componentes/calendario/MonthCalendar.jsx
import { WEEKDAY_NAMES, getMonthMatrix, groupEventsByDate } from '../../utilidades/events';
import './MonthCalendar.css';

const MAX_VISIBLE_PER_DAY = 3;

export const MonthCalendar = ({ year, month, events, onSelectDay }) => {
  const weeks = getMonthMatrix(year, month);
  const eventsByDate = groupEventsByDate(events);

  return (
    <div className="month-calendar">
      <div className="month-calendar__weekdays">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="month-calendar__weekday">{name}</div>
        ))}
      </div>

      <div className="month-calendar__grid">
        {weeks.flat().map((day) => {
          const dayEvents = eventsByDate[day.key] || [];
          const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const extra = dayEvents.length - visible.length;

          return (
            <button
              type="button"
              key={day.key}
              className={`month-calendar__cell${day.inMonth ? '' : ' month-calendar__cell--muted'}${day.isToday ? ' month-calendar__cell--today' : ''}`}
              onClick={() => onSelectDay(day.key, dayEvents)}
              aria-label={`${day.date.getDate()}, ${dayEvents.length} evento(s)`}
            >
              <span className="month-calendar__date">{day.date.getDate()}</span>

              <span className="month-calendar__events">
                {visible.map((event) => (
                  <span
                    key={event.id}
                    className={`month-calendar__event month-calendar__event--${event.source}`}
                    title={event.title}
                  >
                    {event.startTime && (
                      <span className="month-calendar__event-time">{event.startTime}</span>
                    )}
                    <span className="month-calendar__event-title">{event.title}</span>
                  </span>
                ))}
                {extra > 0 && (
                  <span className="month-calendar__more">+{extra} más</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
