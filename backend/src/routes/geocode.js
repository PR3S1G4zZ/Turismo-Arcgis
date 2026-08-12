// backend/src/routes/geocode.js
// Geocodificación bajo demanda para el selector de mapa del panel: convierte
// una dirección de texto en { lat, lng, found }. Reservado a administradores.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { geocodeAddress } from '../utils/geocode.js';

export const geocodeRouter = Router();

// GET /api/geocode?address=...
geocodeRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const address = String(req.query.address || '').trim();
  if (!address) {
    return res.status(400).json({ error: 'Falta el parámetro "address".' });
  }
  const result = await geocodeAddress(address);
  res.json(result);
}));
