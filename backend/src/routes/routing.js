// backend/src/routes/routing.js
// Proxy del servicio de rutas. El frontend nunca ve la API key de ArcGIS ni
// habla directo con Esri: pide aquí y recibe la ruta ya normalizada.
//
// POST /api/rutas/resolver  { origen:{lat,lng}, destino:{lat,lng}, modo:'walk'|'car' }
//   → { fuente, puntos:[[lat,lng]…], pasos:[…], distanciaM, duracionMin }
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/http.js';
import { hayArcgis, resolverRutaArcgis } from '../utils/arcgisRouting.js';
import { resolverRutaOsrm } from '../utils/osrmRouting.js';

export const routingRouter = Router();

// Cada recálculo por desvío es una petición facturable en ArcGIS. Este límite
// es la red de seguridad ante un bucle en el cliente: un usuario navegando
// normalmente no pasa de ~20 peticiones en 5 minutos.
const limitador = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de ruta. Espera un momento e inténtalo de nuevo.' },
});

/** Valida y normaliza un punto {lat,lng} recibido del cliente. */
function leerPunto(valor, nombre) {
  const lat = Number(valor?.lat);
  const lng = Number(valor?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error(`El punto "${nombre}" no tiene coordenadas válidas.`), { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw Object.assign(new Error(`El punto "${nombre}" está fuera de rango.`), { status: 400 });
  }
  return { lat, lng };
}

routingRouter.post('/resolver', limitador, asyncHandler(async (req, res) => {
  let origen;
  let destino;
  try {
    origen = leerPunto(req.body?.origen, 'origen');
    destino = leerPunto(req.body?.destino, 'destino');
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const modo = req.body?.modo === 'car' ? 'car' : 'walk';
  // Nombre del sitio, para que las indicaciones lo mencionen. Se recorta por
  // si llega un texto largo desde el catálogo.
  const nombreDestino = String(req.body?.nombreDestino || '').trim().slice(0, 80);

  // 1) ArcGIS, si hay credenciales.
  if (hayArcgis()) {
    try {
      const ruta = await resolverRutaArcgis(origen, destino, modo, nombreDestino);
      return res.json(ruta);
    } catch (err) {
      console.warn('[rutas] ArcGIS falló, se usa el respaldo OSRM:', err.message);
    }
  }

  // 2) Respaldo OSRM.
  try {
    const ruta = await resolverRutaOsrm(origen, destino, modo);
    return res.json(ruta);
  } catch (err) {
    console.error('[rutas] Ningún servicio de ruteo respondió:', err.message);
    return res.status(502).json({
      error: 'No se pudo calcular la ruta en este momento. Inténtalo de nuevo en unos segundos.',
    });
  }
}));

// GET /api/rutas/estado — diagnóstico: indica qué proveedor está activo.
routingRouter.get('/estado', (_req, res) => {
  res.json({ proveedor: hayArcgis() ? 'arcgis' : 'osrm', arcgisConfigurado: hayArcgis() });
});
