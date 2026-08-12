// backend/src/index.js
// Punto de entrada del backend: configura Express, middleware de seguridad,
// monta los routers de la API y arranca tras inicializar la base de datos.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { initDb } from './db.js';
import { UPLOADS_DIR } from './middleware/upload.js';

import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { sitesRouter } from './routes/sites.js';
import { announcementsRouter } from './routes/announcements.js';
import { eventsRouter } from './routes/events.js';
import { pqrsRouter } from './routes/pqrs.js';
import { settingsRouter } from './routes/settings.js';
import { uploadRouter } from './routes/upload.js';
import { statsRouter } from './routes/stats.js';
import { geocodeRouter } from './routes/geocode.js';
import { routingRouter } from './routes/routing.js';
import { googleCalendarRouter } from './routes/googleCalendar.js';

const app = express();

// Seguridad de cabeceras. Se permite el uso cruzado de recursos para que el
// frontend (otro origen en desarrollo) pueda cargar las imágenes de /uploads.
// img-src se amplía para las fotos de respaldo de Unsplash (SiteCard.jsx /
// SiteDetailPage.jsx) y los tiles del mapa de CARTO (InteractiveMap.jsx,
// subdominios a/b/c/d.basemaps.cartocdn.com). connect-src se amplía porque
// InteractiveMap.jsx geocodifica direcciones sin lat/lng directo contra
// Nominatim desde el propio navegador (no pasa por el backend).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://images.unsplash.com', 'https://*.basemaps.cartocdn.com'],
      'connect-src': ["'self'", 'https://nominatim.openstreetmap.org'],
    },
  },
}));

// En producción manda la lista blanca de CORS_ORIGIN. En desarrollo se acepta
// cualquier localhost: Vite salta de puerto (5173 → 5174 → …) cuando el
// anterior está ocupado, y no tiene sentido reconfigurar el .env cada vez.
const ORIGEN_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
  origin: config.isProduction
    ? config.corsOrigin
    : (origin, cb) => cb(null, !origin || ORIGEN_LOCAL.test(origin) || config.corsOrigin.includes(origin)),
}));
app.use(express.json({ limit: '2mb' }));

// Archivos estáticos subidos (imágenes de sitios, anuncios y PQRS).
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// Sonda de salud.
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// API.
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/pqrs', pqrsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/stats', statsRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/rutas', routingRouter);
app.use('/api/google-calendar', googleCalendarRouter);

// 404 para rutas de API desconocidas.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));

// Frontend compilado (despliegue de un solo servicio: mismo contenedor sirve
// la API y la SPA). En desarrollo el frontend corre aparte con Vite y esta
// carpeta no existe, así que esto no interfiere en local.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../public');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // Cualquier ruta que no sea /api ni /uploads es una vista de React Router
  // (ej. /site/3): se le sirve el mismo index.html y el router del cliente
  // decide qué mostrar.
  app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

// Manejo centralizado de errores (incluye errores de multer y de validación).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || /imagen/i.test(err?.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

async function start() {
  try {
    await initDb();
    console.log('[db] Base de datos lista.');
  } catch (err) {
    console.error('[db] No se pudo conectar/inicializar MySQL:', err.message);
    console.error('     Verifica que MySQL esté corriendo y las credenciales en backend/.env.');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`Backend de Turismo Itagüí escuchando en http://localhost:${config.port}`);
    console.log(
      config.isProduction
        ? `CORS permitido para: ${config.corsOrigin.join(', ')}`
        : `CORS permitido para: cualquier localhost (modo desarrollo) + ${config.corsOrigin.join(', ')}`
    );
  });
}

start();
