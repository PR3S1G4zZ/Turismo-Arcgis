// backend/src/routes/events.js
// Eventos manuales del calendario. Lectura pública; escritura solo admin.
// Los eventos de Google se sirven aparte (router googleCalendar).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { mapEvent } from '../utils/mappers.js';

export const eventsRouter = Router();

const isValidDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// GET /api/events
eventsRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM events ORDER BY date ASC, start_time ASC');
  res.json(rows.map(mapEvent));
}));

// POST /api/events
eventsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.title?.trim() || !isValidDate(b.date)) {
    return res.status(400).json({ error: 'El evento necesita un título y una fecha válida (YYYY-MM-DD).' });
  }
  const result = await query(
    'INSERT INTO events (title, date, start_time, end_time, location, description, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [b.title.trim(), b.date, b.startTime || '', b.endTime || '', b.location || '', b.description || '', 'manual']
  );
  const rows = await query('SELECT * FROM events WHERE id = ?', [result.insertId]);
  res.status(201).json(mapEvent(rows[0]));
}));

// PUT /api/events/:id
eventsRouter.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rows = await query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'Evento no encontrado.' });

  const b = req.body || {};
  if (b.date != null && !isValidDate(b.date)) {
    return res.status(400).json({ error: 'La fecha debe tener el formato YYYY-MM-DD.' });
  }
  await query(
    'UPDATE events SET title = ?, date = ?, start_time = ?, end_time = ?, location = ?, description = ? WHERE id = ?',
    [
      b.title ?? existing.title,
      b.date ?? existing.date,
      b.startTime ?? existing.start_time,
      b.endTime ?? existing.end_time,
      b.location ?? existing.location,
      b.description ?? existing.description,
      id,
    ]
  );
  const updated = await query('SELECT * FROM events WHERE id = ?', [id]);
  res.json(mapEvent(updated[0]));
}));

// DELETE /api/events/:id
eventsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM events WHERE id = ?', [Number(req.params.id)]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Evento no encontrado.' });
  res.json({ ok: true });
}));
