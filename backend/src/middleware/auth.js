// backend/src/middleware/auth.js
// Verificación de JWT y control de roles para proteger las rutas del admin.
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/** Firma un token para un usuario autenticado. */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Middleware: exige un JWT válido en el header Authorization: Bearer <token>.
 * Adjunta el payload a req.user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión para continuar.' });
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
  }
}

/** Middleware: exige que el usuario autenticado sea super-administrador. */
export function requireSuperadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acción reservada al super-administrador.' });
  }
  return next();
}
