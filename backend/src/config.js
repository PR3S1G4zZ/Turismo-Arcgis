// backend/src/config.js
// Carga y centraliza la configuración de entorno. Un único punto de verdad
// para el resto del backend, con valores por defecto seguros para desarrollo.
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET_PLACEHOLDERS = new Set([
  'dev-secreto-inseguro-cambiar',
  'cambia-esto-por-un-secreto-largo-y-aleatorio',
]);

if (
  isProduction
  && (
    !process.env.JWT_SECRET
    || process.env.JWT_SECRET.length < 32
    || JWT_SECRET_PLACEHOLDERS.has(process.env.JWT_SECRET)
  )
) {
  throw new Error('[config] JWT_SECRET must be a unique production secret of at least 32 characters.');
}

const required = (name, value) => {
  if (!value) {
    if (isProduction) {
      throw new Error(`[config] Missing required production variable: ${name}.`);
    }
    console.warn(`[config] Falta la variable de entorno ${name}; usando valor por defecto de desarrollo.`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT) || 3001,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3001').replace(/\/$/, ''),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'turismo_itagui',
  },

  jwt: {
    secret: required('JWT_SECRET', process.env.JWT_SECRET) || 'dev-secreto-inseguro-cambiar',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  // Servicio de rutas de ArcGIS. Admite API key directa o credenciales OAuth de
  // aplicación (client_id/secret), con las que el backend genera el token solo.
  // Sin ninguna de las dos, el ruteo cae al respaldo OSRM.
  arcgis: {
    apiKey: process.env.ARCGIS_API_KEY || '',
    clientId: process.env.ARCGIS_CLIENT_ID || '',
    clientSecret: process.env.ARCGIS_CLIENT_SECRET || '',
    // Debe coincidir con una de las "URL de referencia" registradas en las
    // credenciales. Node no envía cabecera Referer por su cuenta, así que el
    // backend la manda explícitamente o ArcGIS rechaza el token.
    referer: process.env.ARCGIS_REFERER || '',
  },

  seedAdmin: {
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    password: process.env.SEED_ADMIN_PASSWORD || (isProduction ? '' : 'Itagui2026*Cambiar'),
    name: process.env.SEED_ADMIN_NAME || 'Administrador Principal',
  },

  isProduction,
};
