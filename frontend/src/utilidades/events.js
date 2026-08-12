// src/utilidades/events.js
// Utilidades puras de fechas y eventos para el calendario mensual. Sin dependencias.

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Encabezados del calendario, empezando en lunes.
export const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Clave de fecha local YYYY-MM-DD (sin desfase por zona horaria).
export const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Mes en formato YYYY-MM (el que espera el backend).
export const toMonthKey = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;

export const formatMonthLabel = (year, month) => `${MONTH_NAMES[month]} ${year}`;

/**
 * Devuelve una matriz de semanas (cada una con 7 objetos de día) que cubre
 * el mes indicado, rellenando con días de los meses vecinos para completar
 * la cuadrícula. La semana empieza en lunes.
 *
 * Cada día: { date: Date, key: 'YYYY-MM-DD', inMonth: boolean, isToday: boolean }
 */
export const getMonthMatrix = (year, month) => {
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0=Dom … 6=Sáb. Convertimos a lunes=0.
  const startOffset = (firstOfMonth.getDay() + 6) % 7;

  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = toDateKey(new Date());

  const weeks = [];
  const cursor = new Date(gridStart);

  // 6 semanas × 7 días cubren cualquier mes.
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      const key = toDateKey(date);
      week.push({
        date,
        key,
        inMonth: date.getMonth() === month,
        isToday: key === todayKey
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
};

/** Agrupa una lista de eventos por su fecha (clave YYYY-MM-DD). */
export const groupEventsByDate = (events) => {
  const map = {};
  for (const event of events) {
    if (!event.date) continue;
    if (!map[event.date]) map[event.date] = [];
    map[event.date].push(event);
  }
  // Ordenar cada día por hora de inicio (los sin hora primero).
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }
  return map;
};

/** Filtra los eventos que pertenecen al mes (year, month) indicado. */
export const filterEventsByMonth = (events, year, month) => {
  const prefix = toMonthKey(year, month);
  return events.filter((e) => typeof e.date === 'string' && e.date.startsWith(prefix));
};
