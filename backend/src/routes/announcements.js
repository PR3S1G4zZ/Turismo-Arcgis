// backend/src/routes/announcements.js
// Anuncios del carrusel de inicio. Lectura pública; escritura solo admin.
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { mapAnnouncement } from '../utils/mappers.js';

export const announcementsRouter = Router();

// GET /api/announcements
announcementsRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM announcements ORDER BY id ASC');
  res.json(rows.map(mapAnnouncement));
}));

// POST /api/announcements
announcementsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.date) {
    return res.status(400).json({ error: 'Título y fecha/subtexto son obligatorios.' });
  }
  const result = await query(
    'INSERT INTO announcements (title, date, zone, image, cta) VALUES (?, ?, ?, ?, ?)',
    [b.title, b.date, b.zone || '', b.image || '', b.cta || 'Más información']
  );
  const rows = await query('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
  res.status(201).json(mapAnnouncement(rows[0]));
}));

// PUT /api/announcements/:id
announcementsRouter.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rows = await query('SELECT * FROM announcements WHERE id = ? LIMIT 1', [id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'Anuncio no encontrado.' });

  const b = req.body || {};
  await query(
    'UPDATE announcements SET title = ?, date = ?, zone = ?, image = ?, cta = ? WHERE id = ?',
    [
      b.title ?? existing.title,
      b.date ?? existing.date,
      b.zone ?? existing.zone,
      b.image ?? existing.image,
      b.cta ?? existing.cta,
      id,
    ]
  );
  const updated = await query('SELECT * FROM announcements WHERE id = ?', [id]);
  res.json(mapAnnouncement(updated[0]));
}));

// DELETE /api/announcements/:id
announcementsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM announcements WHERE id = ?', [Number(req.params.id)]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Anuncio no encontrado.' });
  res.json({ ok: true });
}));
