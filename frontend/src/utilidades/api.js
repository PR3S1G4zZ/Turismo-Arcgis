// src/utilidades/api.js
// Cliente único de acceso al backend. La base se configura con VITE_API_URL
// (ver frontend/.env.example); en desarrollo cae por defecto a localhost:3001.
// OJO: usa "??" y no "||" — VITE_API_URL='' (mismo origen, monorepo detrás de
// un solo servicio) es un valor válido y NO debe caer al default de abajo.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Manejo del token de sesión (JWT) ───────────────────────
const TOKEN_KEY = 'turismo_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Petición genérica al backend. Inyecta el token si existe y normaliza errores
 * a un Error con mensaje legible. `body` (si es objeto) se envía como JSON.
 */
async function request(path, { method = 'GET', body, auth = false, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : (body != null ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('No se pudo contactar el servidor. ¿Está el backend en ejecución?');
  }

  // 204 sin contenido.
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error al procesar la solicitud.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── Autenticación ──────────────────────────────────────────
export const authApi = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me', { auth: true }),
  changePassword: (currentPassword, newPassword) =>
    request('/api/auth/password', { method: 'PATCH', auth: true, body: { currentPassword, newPassword } }),
};

// ─── Usuarios / administradores (super-admin) ───────────────
export const usersApi = {
  list: () => request('/api/users', { auth: true }),
  create: (payload) => request('/api/users', { method: 'POST', auth: true, body: payload }),
  update: (id, payload) => request(`/api/users/${id}`, { method: 'PATCH', auth: true, body: payload }),
  remove: (id) => request(`/api/users/${id}`, { method: 'DELETE', auth: true }),
};

// ─── Sitios ─────────────────────────────────────────────────
export const sitesApi = {
  list: () => request('/api/sites'),
  get: (id) => request(`/api/sites/${id}`),
  create: (payload) => request('/api/sites', { method: 'POST', auth: true, body: payload }),
  update: (id, payload) => request(`/api/sites/${id}`, { method: 'PUT', auth: true, body: payload }),
  remove: (id) => request(`/api/sites/${id}`, { method: 'DELETE', auth: true }),
  visit: (id) => request(`/api/sites/${id}/visit`, { method: 'POST' }),
};

// ─── Anuncios ───────────────────────────────────────────────
export const announcementsApi = {
  list: () => request('/api/announcements'),
  create: (payload) => request('/api/announcements', { method: 'POST', auth: true, body: payload }),
  update: (id, payload) => request(`/api/announcements/${id}`, { method: 'PUT', auth: true, body: payload }),
  remove: (id) => request(`/api/announcements/${id}`, { method: 'DELETE', auth: true }),
};

// ─── Eventos ────────────────────────────────────────────────
export const eventsApi = {
  list: () => request('/api/events'),
  create: (payload) => request('/api/events', { method: 'POST', auth: true, body: payload }),
  update: (id, payload) => request(`/api/events/${id}`, { method: 'PUT', auth: true, body: payload }),
  remove: (id) => request(`/api/events/${id}`, { method: 'DELETE', auth: true }),
};

// ─── PQRS ───────────────────────────────────────────────────
export const pqrsApi = {
  list: () => request('/api/pqrs', { auth: true }),
  create: (payload) => request('/api/pqrs', { method: 'POST', body: payload }),
  updateStatus: (id, status) => request(`/api/pqrs/${id}`, { method: 'PATCH', auth: true, body: { status } }),
  remove: (id) => request(`/api/pqrs/${id}`, { method: 'DELETE', auth: true }),
};

// ─── Estadísticas del panel (admin) ─────────────────────────
export const statsApi = {
  get: () => request('/api/stats', { auth: true }),
};

// ─── Geocodificación (admin) ────────────────────────────────
export const geocodeApi = {
  // Devuelve { lat, lng, found }.
  search: (address) => request(`/api/geocode?address=${encodeURIComponent(address)}`, { auth: true }),
};

// ─── Rutas y navegación ─────────────────────────────────────
// El backend hace de proxy del servicio de rutas: la credencial de ArcGIS vive
// solo allí y nunca llega al navegador.
export const rutasApi = {
  /**
   * Ruta real por calles entre dos puntos.
   * @returns {Promise<{fuente:string, puntos:Array<[number,number]>, pasos:Array, distanciaM:number, duracionMin:number}>}
   */
  resolver: (origen, destino, modo = 'walk', nombreDestino = '') =>
    request('/api/rutas/resolver', { method: 'POST', body: { origen, destino, modo, nombreDestino } }),

  // Diagnóstico: qué proveedor de ruteo está activo (arcgis u osrm).
  estado: () => request('/api/rutas/estado'),
};

// ─── Ajustes ────────────────────────────────────────────────
export const settingsApi = {
  get: () => request('/api/settings'),
  setGoogleCalendarUrl: (url) =>
    request('/api/settings/google-calendar', { method: 'PUT', auth: true, body: { url } }),
};

// ─── Subida de imágenes ─────────────────────────────────────
async function uploadTo(path, file, auth) {
  const form = new FormData();
  form.append('image', file);
  const data = await request(path, { method: 'POST', body: form, isForm: true, auth });
  return data.url;
}
export const uploadApi = {
  // Admin autenticado.
  image: (file) => uploadTo('/api/upload', file, true),
  // Público (formulario de PQRS).
  publicImage: (file) => uploadTo('/api/upload/public', file, false),
};

// ─── Calendario de Google (proxy) ───────────────────────────
/**
 * Pide al backend los eventos de un calendario compartido de Google (.ics).
 * Se mantiene la firma previa para no romper los componentes existentes.
 */
export async function fetchGoogleEvents(url, month) {
  const params = new URLSearchParams({ url });
  if (month) params.set('month', month);
  const data = await request(`/api/google-calendar?${params.toString()}`);
  return data.events || [];
}
