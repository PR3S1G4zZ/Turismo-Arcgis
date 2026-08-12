// backend/src/routes/upload.js
// Subida de imágenes a /uploads. El panel de admin sube autenticado; el
// formulario público de PQRS puede subir la foto de su establecimiento con
// límite de frecuencia para evitar abuso.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { uploadImage } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

export const uploadRouter = Router();

const publicUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas imágenes subidas. Espera unos minutos.' },
});

const fileToUrl = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  }
  const url = `${config.publicUrl}/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename });
};

// POST /api/upload — subida autenticada (panel de administración).
uploadRouter.post('/', requireAuth, uploadImage.single('image'), fileToUrl);

// POST /api/upload/public — subida pública para el formulario de PQRS.
uploadRouter.post('/public', publicUploadLimiter, uploadImage.single('image'), fileToUrl);
