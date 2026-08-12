// backend/src/routes/sites.js
// Sitios turísticos. Lectura y conteo de visitas son públicos; crear, editar
// y eliminar exige sesión de administrador.
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, asArray } from '../utils/http.js';
import { mapSite } from '../utils/mappers.js';
import { geocodeAddress } from '../utils/geocode.js';

export const sitesRouter = Router();

const CATEGORIES = ['Parque', 'Cultura', 'Restaurante', 'Museo', 'Comercio', 'Hospedaje', 'Entretenimiento'];

// Normaliza tags que pueden venir como string separada por comas o como array.
const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// ─── Público ────────────────────────────────────────────────

// GET /api/sites
sitesRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM sites ORDER BY id ASC');
  res.json(rows.map(mapSite));
}));

// GET /api/sites/:id
sitesRouter.get('/:id', asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM sites WHERE id = ? LIMIT 1', [Number(req.params.id)]);
  if (!rows[0]) return res.status(404).json({ error: 'Sitio no encontrado.' });
  res.json(mapSite(rows[0]));
}));

// POST /api/sites/:id/visit — incrementa el contador de visitas (público).
sitesRouter.post('/:id/visit', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await query('UPDATE sites SET visits = visits + 1 WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Sitio no encontrado.' });
  // Registro histórico para las métricas temporales del panel.
  await query('INSERT INTO visit_log (site_id) VALUES (?)', [id]);
  const rows = await query('SELECT visits FROM sites WHERE id = ?', [id]);
  res.json({ id, visits: rows[0].visits });
}));

// ─── Protegido (admin) ──────────────────────────────────────

// POST /api/sites
sitesRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.description || !b.address) {
    return res.status(400).json({ error: 'Nombre, descripción y dirección son obligatorios.' });
  }

  // El backend resuelve las coordenadas a partir de la dirección.
  let { lat, lng } = b;
  if (lat == null || lng == null) {
    ({ lat, lng } = await geocodeAddress(b.address));
  }

  const category = CATEGORIES.includes(b.category) ? b.category : 'Comercio';
  const images = asArray(b.images).length ? asArray(b.images) : [];

  const result = await query(
    `INSERT INTO sites
      (name, category, zone, description, images, rating, address, lat, lng, hours, phone, instagram, facebook, website, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(b.name).trim(),
      category,
      b.zone || '',
      b.description || '',
      JSON.stringify(images),
      Number(b.rating) || 5.0,
      b.address || '',
      lat, lng,
      b.hours || '',
      b.phone || '',
      b.instagram || '',
      b.facebook || '',
      b.website || '',
      JSON.stringify(normalizeTags(b.tags)),
    ]
  );
  const rows = await query('SELECT * FROM sites WHERE id = ?', [result.insertId]);
  res.status(201).json(mapSite(rows[0]));
}));

// PUT /api/sites/:id
sitesRouter.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rows = await query('SELECT * FROM sites WHERE id = ? LIMIT 1', [id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'Sitio no encontrado.' });

  const b = req.body || {};
  const address = b.address ?? existing.address;

  // Re-geocodificar solo si cambió la dirección y no vienen coords explícitas.
  let lat = b.lat ?? existing.lat;
  let lng = b.lng ?? existing.lng;
  if (b.address && b.address !== existing.address && (b.lat == null || b.lng == null)) {
    ({ lat, lng } = await geocodeAddress(address));
  }

  const category = b.category != null
    ? (CATEGORIES.includes(b.category) ? b.category : existing.category)
    : existing.category;

  await query(
    `UPDATE sites SET
      name = ?, category = ?, zone = ?, description = ?, images = ?, rating = ?,
      address = ?, lat = ?, lng = ?, hours = ?, phone = ?, instagram = ?,
      facebook = ?, website = ?, tags = ?
     WHERE id = ?`,
    [
      b.name ?? existing.name,
      category,
      b.zone ?? existing.zone,
      b.description ?? existing.description,
      JSON.stringify(b.images != null ? asArray(b.images) : asArray(existing.images)),
      b.rating != null ? Number(b.rating) : existing.rating,
      address,
      lat, lng,
      b.hours ?? existing.hours,
      b.phone ?? existing.phone,
      b.instagram ?? existing.instagram,
      b.facebook ?? existing.facebook,
      b.website ?? existing.website,
      JSON.stringify(b.tags != null ? normalizeTags(b.tags) : asArray(existing.tags)),
      id,
    ]
  );
  const updated = await query('SELECT * FROM sites WHERE id = ?', [id]);
  res.json(mapSite(updated[0]));
}));

// DELETE /api/sites/:id
sitesRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await query('DELETE FROM sites WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Sitio no encontrado.' });
  // Se elimina también el historial de visitas del sitio (sus estadísticas).
  await query('DELETE FROM visit_log WHERE site_id = ?', [id]);
  res.json({ ok: true });
}));
