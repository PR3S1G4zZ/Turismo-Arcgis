// backend/src/utils/mappers.js
// Convierte filas crudas de MySQL a los objetos que el frontend ya consume,
// preservando exactamente la forma que usan los componentes existentes.
import { asArray, asObject } from './http.js';

export const mapSite = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  zone: row.zone,
  description: row.description || '',
  images: asArray(row.images),
  rating: row.rating != null ? Number(row.rating) : 5.0,
  address: row.address || '',
  lat: row.lat != null ? Number(row.lat) : null,
  lng: row.lng != null ? Number(row.lng) : null,
  hours: row.hours || '',
  phone: row.phone || '',
  instagram: row.instagram || '',
  facebook: row.facebook || '',
  website: row.website || '',
  tags: asArray(row.tags),
  visits: row.visits ?? 0,
});

export const mapAnnouncement = (row) => ({
  id: row.id,
  title: row.title,
  date: row.date || '',
  zone: row.zone || '',
  image: row.image || '',
  cta: row.cta || '',
});

// Fecha DATE de MySQL → 'YYYY-MM-DD' local (evita desfase por toISOString UTC).
const toDateKey = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const mapEvent = (row) => ({
  id: row.id,
  title: row.title,
  date: toDateKey(row.date),
  startTime: row.start_time || '',
  endTime: row.end_time || '',
  location: row.location || '',
  description: row.description || '',
  source: row.source || 'manual',
});

// El PQRS aplana los campos específicos del establecimiento (guardados en meta)
// al nivel superior, porque así los leen los componentes del panel.
export const mapPqrs = (row) => ({
  id: row.id,
  type: row.type,
  name: row.name,
  email: row.email,
  subject: row.subject || '',
  details: row.details || '',
  status: row.status,
  date: toDateKey(row.created_at),
  ...asObject(row.meta),
});

export const mapUser = (row) => ({
  id: row.id,
  username: row.username,
  name: row.name,
  role: row.role,
  active: !!row.active,
  createdAt: row.created_at,
});
