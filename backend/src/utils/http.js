// backend/src/utils/http.js
// Utilidades HTTP compartidas.

/** Envuelve un handler async y reenvía cualquier error al middleware de errores. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Convierte a array desde un JSON de MySQL que puede venir como null/objeto/array. */
export const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

/** Objeto JSON de MySQL que puede venir como null/string/objeto. */
export const asObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
  }
  return {};
};
