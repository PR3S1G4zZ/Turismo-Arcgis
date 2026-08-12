// backend/src/googleCalendar.js
import ical from 'node-ical';

/**
 * Error de dominio para distinguir fallos de descarga/parseo del .ics
 * de errores de validación de entrada.
 */
export class CalendarFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalendarFetchError';
  }
}

/**
 * Normaliza la URL de entrada a una dirección iCal (.ics) descargable.
 *
 * Google Calendar ofrece varios enlaces y solo el iCal es parseable:
 *  - El enlace de la interfaz (`.../calendar/u/1?cid=<base64>`) NO es un .ics;
 *    aquí se decodifica el `cid` y se construye la dirección pública iCal.
 *    (Solo funciona si el calendario está marcado como público en Google.)
 *  - Una dirección iCal pública o secreta (contiene `/ical/` o termina en `.ics`)
 *    se usa tal cual.
 */
export function normalizeCalendarUrl(input) {
  const trimmed = (input || '').trim();

  // Ya es una dirección iCal → usar tal cual.
  if (trimmed.includes('/ical/') || trimmed.toLowerCase().endsWith('.ics')) {
    return trimmed;
  }

  // Enlace de la interfaz de Google Calendar con parámetro cid.
  try {
    const parsed = new URL(trimmed);
    const isGoogleCalendar = /(^|\.)calendar\.google\.com$/.test(parsed.hostname);
    const cid = parsed.searchParams.get('cid');
    if (isGoogleCalendar && cid) {
      // El cid es el id del calendario en base64 (url-safe, sin padding).
      const calendarId = Buffer.from(cid, 'base64').toString('utf-8').trim();
      if (calendarId) {
        return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
      }
    }
  } catch {
    // Entrada que no es una URL válida; se devuelve tal cual y fallará más adelante.
  }

  return trimmed;
}

// Fecha local en formato YYYY-MM-DD (sin desfase de zona horaria por toISOString).
const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Hora local HH:mm; para eventos de día completo devuelve cadena vacía.
const toTime = (date, isDateOnly) => {
  if (isDateOnly) return '';
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
};

// Rango [inicio, fin) del mes pedido (YYYY-MM). Si no es válido, devuelve null.
const monthRange = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  const start = new Date(year, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, m, 1, 0, 0, 0, 0);
  return { start, end };
};

const normalizeEvent = (event, occurrenceStart) => {
  const start = occurrenceStart || event.start;
  const isDateOnly = event.datetype === 'date';

  // Duración original del evento, para reconstruir el fin de cada ocurrencia recurrente.
  let end = event.end;
  if (occurrenceStart && event.start && event.end) {
    const duration = event.end.getTime() - event.start.getTime();
    end = new Date(occurrenceStart.getTime() + duration);
  }

  return {
    id: `${event.uid || 'evt'}-${toDateKey(start)}`,
    title: event.summary || 'Evento sin título',
    date: toDateKey(start),
    startTime: toTime(start, isDateOnly),
    endTime: end ? toTime(end, isDateOnly) : '',
    location: event.location || '',
    description: event.description || '',
    source: 'google'
  };
};

/**
 * Descarga un calendario .ics público de Google, lo parsea y devuelve
 * un arreglo de eventos normalizados. Si `month` (YYYY-MM) viene, filtra
 * a ese mes y expande los eventos recurrentes que caen dentro.
 */
export async function fetchGoogleCalendarEvents(url, month) {
  const icalUrl = normalizeCalendarUrl(url);

  let data;
  try {
    data = await ical.async.fromURL(icalUrl);
  } catch (err) {
    // Google devuelve una página HTML 404 cuando el calendario no es público
    // o la dirección iCal no existe; node-ical falla al parsearla.
    const notPublic = /404|Unexpected|Invalid|<html/i.test(err.message);
    const hint = notPublic
      ? ' Verifica que el calendario esté marcado como público en Google Calendar y que la dirección sea la de formato iCal (.ics).'
      : '';
    throw new CalendarFetchError(`No se pudo descargar o leer el calendario.${hint}`);
  }

  const range = monthRange(month);
  const events = [];

  for (const item of Object.values(data)) {
    if (!item || item.type !== 'VEVENT') continue;

    // Eventos recurrentes: expandir ocurrencias dentro del mes solicitado.
    if (item.rrule && range) {
      const occurrences = item.rrule.between(range.start, range.end, true);
      for (const occ of occurrences) {
        events.push(normalizeEvent(item, occ));
      }
      continue;
    }

    const normalized = normalizeEvent(item);
    if (range) {
      const key = normalized.date;
      const startKey = toDateKey(range.start);
      const endKey = toDateKey(new Date(range.end.getTime() - 1));
      if (key < startKey || key > endKey) continue;
    }
    events.push(normalized);
  }

  events.sort((a, b) => (a.date === b.date
    ? a.startTime.localeCompare(b.startTime)
    : a.date.localeCompare(b.date)));

  return events;
}
