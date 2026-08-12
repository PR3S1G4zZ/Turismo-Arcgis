// backend/src/routes/settings.js
// Ajustes globales del portal. Por ahora: la URL del calendario de Google.
// La lectura es pública (el calendario público la necesita); escribir es admin.
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

export const settingsRouter = Router();

const GCAL_KEY = 'google_calendar_url';

const getSetting = async (key) => {
  const rows = await query('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [key]);
  return rows[0]?.setting_value ?? '';
};

const setSetting = async (key, value) => {
  await query(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, value]
  );
};

// GET /api/settings — ajustes públicos.
settingsRouter.get('/', asyncHandler(async (_req, res) => {
  const googleCalendarUrl = await getSetting(GCAL_KEY);
  res.json({ googleCalendarUrl });
}));

// PUT /api/settings/google-calendar (admin).
settingsRouter.put('/google-calendar', requireAuth, asyncHandler(async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
    } catch {
      return res.status(400).json({ error: 'La URL del calendario no es válida (usa http o https).' });
    }
  }
  await setSetting(GCAL_KEY, url);
  res.json({ googleCalendarUrl: url });
}));
