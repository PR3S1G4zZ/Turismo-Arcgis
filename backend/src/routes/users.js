// backend/src/routes/users.js
// Gestión de administradores. Reservada al super-administrador: él registra,
// activa/desactiva y elimina a los demás administradores.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireSuperadmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { mapUser } from '../utils/mappers.js';

export const usersRouter = Router();

// Todas las rutas exigen sesión + rol super-administrador.
usersRouter.use(requireAuth, requireSuperadmin);

// GET /api/users
usersRouter.get('/', asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM users ORDER BY created_at ASC');
  res.json(rows.map(mapUser));
}));

// POST /api/users — registrar un nuevo administrador.
usersRouter.post('/', asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');
  const role = req.body?.role === 'superadmin' ? 'superadmin' : 'admin';

  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Usuario, nombre y contraseña son obligatorios.' });
  }
  if (!/^[a-z0-9._-]{3,60}$/.test(username)) {
    return res.status(400).json({ error: 'El usuario debe tener entre 3 y 60 caracteres (letras, números, punto, guion o guion bajo).' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const existing = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Ya existe un administrador con ese nombre de usuario.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)',
    [username, name, hash, role]
  );
  const rows = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  res.status(201).json(mapUser(rows[0]));
}));

// PATCH /api/users/:id — activar/desactivar o resetear la contraseña.
usersRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  const target = rows[0];
  if (!target) return res.status(404).json({ error: 'Administrador no encontrado.' });

  if (target.role === 'superadmin' && req.body?.active === false) {
    return res.status(400).json({ error: 'No se puede desactivar al super-administrador.' });
  }

  if (typeof req.body?.active === 'boolean') {
    await query('UPDATE users SET active = ? WHERE id = ?', [req.body.active ? 1 : 0, id]);
  }
  if (req.body?.password) {
    if (String(req.body.password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    const hash = await bcrypt.hash(String(req.body.password), 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  }
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    await query('UPDATE users SET name = ? WHERE id = ?', [req.body.name.trim(), id]);
  }

  const updated = await query('SELECT * FROM users WHERE id = ?', [id]);
  res.json(mapUser(updated[0]));
}));

// DELETE /api/users/:id — eliminar un administrador (no a sí mismo ni al super-admin).
usersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === Number(req.user.sub)) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
  }
  const rows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Administrador no encontrado.' });
  if (rows[0].role === 'superadmin') {
    return res.status(400).json({ error: 'No se puede eliminar al super-administrador.' });
  }
  await query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ ok: true });
}));
