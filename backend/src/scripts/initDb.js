// backend/src/scripts/initDb.js
// Script independiente para crear la base de datos, el esquema y el super-admin
// inicial sin arrancar el servidor. Uso: npm run init-db
import { initDb } from '../db.js';

try {
  await initDb();
  console.log('[init-db] Base de datos y esquema listos.');
  process.exit(0);
} catch (err) {
  console.error('[init-db] Error:', err.message);
  process.exit(1);
}
