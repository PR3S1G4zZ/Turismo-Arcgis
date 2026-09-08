// backend/src/routes/mapa.js
// Credencial pública de basemap para el cliente. El frontend dibuja el mapa con
// MapLibre GL sobre el estilo vectorial oficial de ArcGIS. Esta key es distinta
// de las credenciales privadas de routing y solo puede tener privilegio Basemaps.
// Nunca se genera ni se entrega aquí un OAuth token de routing.
//
// GET /api/mapa/token → { token } | { token:null, motivo }.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { hayArcgis } from '../utils/arcgisRouting.js';
import { config } from '../config.js';

export const mapaRouter = Router();

const limitador = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de token de mapa. Espera un momento.' },
});

mapaRouter.get('/token', limitador, (_req, res) => {
  // Cache corto en el navegador: no hace falta pedir la key pública en cada
  // montaje del mapa. La respuesta no incluye ninguna credencial de routing.
  res.set('Cache-Control', 'private, max-age=300');
  if (!config.arcgis.basemapApiKey) {
    return res.json({
      token: null,
      proveedor: 'osm-fallback',
      motivo: 'not-configured',
    });
  }
  return res.json({ token: config.arcgis.basemapApiKey, proveedor: 'arcgis', motivo: null });
});

// Diagnóstico agregado: no devuelve tokens, secretos ni coordenadas. El estado
// de routing es nominal; la respuesta real de /api/rutas/estado sigue siendo
// la fuente de verdad después de un fallo durante una resolución.
mapaRouter.get('/estado', (_req, res) => {
  const basemapActivo = Boolean(config.arcgis.basemapApiKey);
  res.json({
    basemap: basemapActivo ? 'arcgis' : 'osm-fallback',
    motivoBasemap: basemapActivo ? null : 'not-configured',
    proveedorRutas: hayArcgis() ? 'arcgis' : 'osrm',
  });
});
