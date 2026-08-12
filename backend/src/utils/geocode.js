// backend/src/utils/geocode.js
// Geocodificación de direcciones vía Nominatim (OpenStreetMap), afinada para
// Itagüí (Antioquia, Colombia). Devuelve { lat, lng, found }. `found` indica si
// se resolvió una dirección real (true) o si se usó el centro de Itagüí como
// último recurso (false) — el panel usa ese dato para pedir ajuste manual.
const ITAGUI_FALLBACK = { lat: 6.1724, lng: -75.6091 };

// Caja delimitadora aproximada de Itagüí (left,top,right,bottom) para sesgar
// los resultados a la zona correcta.
const ITAGUI_VIEWBOX = '-75.6650,6.2100,-75.5650,6.1150';

const HEADERS = {
  // Nominatim exige un User-Agent identificable.
  'User-Agent': 'TurismoItagui/1.0 (portal turístico municipal Alcaldía de Itagüí)',
};

async function nominatim(params) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

// Quita menciones de la ciudad/departamento/país para aislar la calle.
const cleanStreet = (address) =>
  address
    .replace(/,?\s*itag[üu]í?\b/gi, '')
    .replace(/,?\s*antioquia\b/gi, '')
    .replace(/,?\s*colombia\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Resuelve una dirección a coordenadas { lat, lng, found }. Intenta, en orden:
 *  1) Búsqueda estructurada (street/city/state/country) restringida a Colombia.
 *  2) Búsqueda libre acotada a la caja de Itagüí (bounded).
 *  3) Búsqueda libre en Colombia sin acotar (por si el punto queda al borde).
 * Si todo falla, devuelve el centro de Itagüí con found=false.
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return { ...ITAGUI_FALLBACK, found: false };
  }

  const street = cleanStreet(address) || address;

  // 1) Estructurada.
  let hit = await nominatim(new URLSearchParams({
    format: 'json', limit: '1', countrycodes: 'co',
    street, city: 'Itagüí', state: 'Antioquia', country: 'Colombia',
  }).toString());

  // 2) Libre, acotada a Itagüí.
  if (!hit) {
    const q = /itag[üu]/i.test(address) ? address : `${address}, Itagüí, Antioquia, Colombia`;
    hit = await nominatim(new URLSearchParams({
      format: 'json', limit: '1', countrycodes: 'co', q,
      viewbox: ITAGUI_VIEWBOX, bounded: '1',
    }).toString());
  }

  // 3) Libre en Colombia sin acotar.
  if (!hit) {
    const q = /itag[üu]/i.test(address) ? address : `${address}, Itagüí, Antioquia, Colombia`;
    hit = await nominatim(new URLSearchParams({
      format: 'json', limit: '1', countrycodes: 'co', q,
    }).toString());
  }

  if (hit) {
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), found: true };
  }
  return { ...ITAGUI_FALLBACK, found: false };
}
