// src/utilidades/image.js

/**
 * Resuelve una URL de imagen. Si es un enlace a una publicación o reel de Instagram,
 * lo convierte en el enlace directo a la imagen utilizando el endpoint de media.
 * 
 * @param {string} url - La URL original.
 * @returns {string} La URL procesada.
 */
export const resolveImage = (url) => {
  if (!url) return '';
  
  // Detectar enlaces de posts o reels de Instagram
  if (
    url.includes('instagram.com/p/') || 
    url.includes('instagram.com/reel/') || 
    url.includes('instagr.am/p/') ||
    url.includes('instagr.am/reel/')
  ) {
    // Limpiar parámetros de consulta (like ?igsh=...)
    const baseUrl = url.split('?')[0];
    // Asegurar que termine con barra inclinada
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${cleanUrl}media/?size=l`;
  }
  
  return url;
};
