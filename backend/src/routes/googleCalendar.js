// backend/src/routes/googleCalendar.js
// Proxy del calendario compartido (.ics) de Google, que resuelve el bloqueo de
// CORS que impide leerlo directamente desde el navegador.
import { Router } from 'express';
import { fetchGoogleCalendarEvents, CalendarFetchError } from '../googleCalendar.js';
import { asyncHandler } from '../utils/http.js';

export const googleCalendarRouter = Router();

// GET /api/google-calendar?url=<ics_url>&month=YYYY-MM
googleCalendarRouter.get('/', asyncHandler(async (req, res) => {
  const { url, month } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Falta el parámetro "url" del calendario .ics.' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'La URL del calendario no es válida.' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'La URL del calendario debe usar http o https.' });
  }

  try {
    const events = await fetchGoogleCalendarEvents(url, month);
    return res.json({ events });
  } catch (err) {
    if (err instanceof CalendarFetchError) {
      return res.status(502).json({ error: err.message });
    }
    console.error('Error inesperado al resolver el calendario:', err);
    return res.status(500).json({ error: 'Error interno al procesar el calendario.' });
  }
}));
