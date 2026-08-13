// backend/src/routes/mapa.js
// Token de basemap para el cliente. El frontend dibuja el mapa con MapLibre GL
// sobre el basemap vectorial de ArcGIS, que se autentica con un token de ArcGIS.
// Aquí se entrega uno de corta duración (el mismo token de aplicación que ya usa
// el ruteo). Si no hay credenciales, se responde 204 y el cliente cae al basemap
// de respaldo (CARTO), igual que el ruteo cae a OSRM.
//
// GET /api/mapa/token → { token, expiraEn } | 204 si no hay ArcGIS configurado.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { hayArcgis, obtenerTokenBasemap } from '../utils/arcgisRouting.js';

export const mapaRouter = Router();

const limitador = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de token de mapa. Espera un momento.' },
});

mapaRouter.get('/token', limitador, async (_req, res) => {
  if (!hayArcgis()) return res.status(204).end();
  try {
    const { token, expiraEn } = await obtenerTokenBasemap();
    // Cache corto en el navegador: no hace falta pedirlo en cada montaje del mapa.
    res.set('Cache-Control', 'private, max-age=300');
    return res.json({ token, expiraEn });
  } catch (err) {
    console.warn('[mapa] No se pudo obtener el token de basemap de ArcGIS:', err.message);
    // La ausencia de token le dice al cliente "usa el basemap de respaldo".
    return res.status(204).end();
  }
});
