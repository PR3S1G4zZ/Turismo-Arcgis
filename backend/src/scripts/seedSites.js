// backend/src/scripts/seedSites.js
// Datos semilla para probar el catálogo, el mapa y la navegación en un
// despliegue nuevo (p. ej. Railway) sin depender de que alguien los cargue a
// mano desde el panel. Idempotente: no inserta nada si ya hay sitios.
// Coordenadas verificadas contra el servicio real de rutas de ArcGIS (todas
// resuelven un trayecto real por calle, no solo una posición en el mapa).
// Uso: npm run seed-sites
import { initDb, query } from '../db.js';

const SITIOS_SEMILLA = [
  {
    name: 'Casa de la Cultura Débora Arango',
    category: 'Cultura',
    zone: 'Centro',
    description: 'Casa de la Cultura de Itagüí, espacio de exposiciones y talleres artísticos.',
    rating: 4.7,
    address: 'Cra. 51 #51-55, Itagüí',
    lat: 6.1724,
    lng: -75.6091,
    hours: '8:00am - 5:00pm',
    tags: ['cultura', 'gratis'],
  },
  {
    name: 'Parque Ditaires',
    category: 'Recreación',
    zone: 'Centro',
    description: 'Parque principal de Itagüí, punto de encuentro y eventos municipales.',
    rating: 4.5,
    address: 'Cl. 51 #50-30, Itagüí',
    lat: 6.1713,
    lng: -75.6119,
    hours: '24 horas',
    tags: ['parque', 'aire libre'],
  },
  {
    name: 'Parque Obrero',
    category: 'Recreación',
    zone: 'Centro',
    description: 'Parque tradicional del centro de Itagüí, rodeado de comercio local.',
    rating: 4.3,
    address: 'Parque Obrero, Itagüí',
    lat: 6.1718293,
    lng: -75.6116404,
    hours: '24 horas',
    tags: ['parque'],
  },
  {
    name: 'Unidad Deportiva Ditaires',
    category: 'Recreación',
    zone: 'Centro',
    description: 'Complejo deportivo municipal para actividades al aire libre.',
    rating: 4.4,
    address: 'Ditaires, Itagüí',
    lat: 6.1706,
    lng: -75.6128,
    hours: '6:00am - 9:00pm',
    tags: ['deporte', 'aire libre'],
  },
  {
    name: 'Centro Comercial Los Molinos',
    category: 'Comercio',
    zone: 'Suroriental',
    description: 'Centro comercial de referencia en el sur del Valle de Aburrá.',
    rating: 4.2,
    address: 'Los Molinos, Itagüí',
    lat: 6.1651,
    lng: -75.6068,
    hours: '10:00am - 8:00pm',
    tags: ['comercio', 'compras'],
  },
];

async function seedSites() {
  await initDb();

  const [{ total }] = await query('SELECT COUNT(*) AS total FROM sites');
  if (total > 0) {
    console.log(`[seed-sites] Ya hay ${total} sitio(s) en la base de datos; no se inserta nada.`);
    return;
  }

  for (const s of SITIOS_SEMILLA) {
    await query(
      `INSERT INTO sites (name, category, zone, description, images, rating, address, lat, lng, hours, phone, tags, visits)
       VALUES (?, ?, ?, ?, JSON_ARRAY(), ?, ?, ?, ?, ?, '', ?, 0)`,
      [s.name, s.category, s.zone, s.description, s.rating, s.address, s.lat, s.lng, s.hours, JSON.stringify(s.tags)]
    );
    console.log(`[seed-sites] Insertado: ${s.name}`);
  }
  console.log(`[seed-sites] Listo: ${SITIOS_SEMILLA.length} sitios de ejemplo cargados.`);
}

try {
  await seedSites();
  process.exit(0);
} catch (err) {
  console.error('[seed-sites] Error:', err.message);
  process.exit(1);
}
