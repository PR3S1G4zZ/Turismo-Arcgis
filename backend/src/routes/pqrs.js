// backend/src/routes/pqrs.js
// Solicitudes PQRS / inclusión de comercios. El envío es público (formulario de
// contacto); listar, cambiar estado y eliminar exige sesión de administrador.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { mapPqrs } from '../utils/mappers.js';

export const pqrsRouter = Router();

const TYPES = ['inclusion', 'update', 'pqrs'];
const STATUSES = ['pending', 'validated', 'rejected'];

// Campos específicos del establecimiento que se guardan en la columna JSON meta.
const META_FIELDS = [
  'establishmentName', 'category', 'zone', 'address', 'phone', 'hours',
  'tags', 'imageUrl', 'instagram', 'facebook', 'website',
];

// Anti spam: máx. 5 envíos por IP cada 10 minutos.
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has enviado demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.' },
});

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// POST /api/pqrs — envío público del formulario.
pqrsRouter.post('/', submitLimiter, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const type = TYPES.includes(b.type) ? b.type : 'pqrs';

  if (!b.name?.trim() || !isEmail(b.email) || !b.subject?.trim() || !b.details?.trim()) {
    return res.status(400).json({ error: 'Nombre, correo válido, asunto y detalles son obligatorios.' });
  }

  const meta = {};
  for (const key of META_FIELDS) {
    if (b[key] != null && b[key] !== '') meta[key] = b[key];
  }

  const result = await query(
    'INSERT INTO pqrs (type, name, email, subject, details, status, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [type, b.name.trim(), b.email.trim(), b.subject.trim(), b.details.trim(), 'pending', JSON.stringify(meta)]
  );
  const rows = await query('SELECT * FROM pqrs WHERE id = ?', [result.insertId]);
  res.status(201).json(mapPqrs(rows[0]));
}));

// GET /api/pqrs — listado (admin).
pqrsRouter.get('/', requireAuth, asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM pqrs ORDER BY created_at DESC');
  res.json(rows.map(mapPqrs));
}));

// PATCH /api/pqrs/:id — cambiar estado (admin).
pqrsRouter.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }
  const result = await query('UPDATE pqrs SET status = ? WHERE id = ?', [status, id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  const rows = await query('SELECT * FROM pqrs WHERE id = ?', [id]);
  res.json(mapPqrs(rows[0]));
}));

// DELETE /api/pqrs/:id (admin).
pqrsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM pqrs WHERE id = ?', [Number(req.params.id)]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  res.json({ ok: true });
}));
