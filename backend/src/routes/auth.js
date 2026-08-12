// backend/src/routes/auth.js
// Autenticación de administradores: login, perfil y cambio de contraseña.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { mapUser } from '../utils/mappers.js';

export const authRouter = Router();

// Anti fuerza bruta: máx. 10 intentos de login por IP cada 15 minutos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.' },
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  const user = rows[0];

  // Mensaje genérico para no revelar si el usuario existe.
  const invalid = () => res.status(401).json({ error: 'Credenciales incorrectas.' });

  if (!user || !user.active) return invalid();

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return invalid();

  const token = signToken(user);
  return res.json({ token, user: mapUser(user) });
}));

// GET /api/auth/me — datos del usuario autenticado (valida el token).
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
  if (!rows[0] || !rows[0].active) {
    return res.status(401).json({ error: 'La cuenta ya no está disponible.' });
  }
  return res.json({ user: mapUser(rows[0]) });
}));

// PATCH /api/auth/password — el usuario cambia su propia contraseña.
authRouter.patch('/password', requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });

  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  return res.json({ ok: true });
}));
