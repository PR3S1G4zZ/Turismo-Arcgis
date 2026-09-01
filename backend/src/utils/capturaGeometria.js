// backend/src/utils/capturaGeometria.js
// Captura dev-only de las etapas del pipeline geométrico (Fase 4 GEOM-01/GEOM-02).
// Guardada por la variable de entorno CAPTURAR_GEOMETRIA=true: en cualquier otro
// caso (incluida producción, que nunca define esa variable) esta función es un
// no-op que no toca el sistema de archivos ni cambia la respuesta real de ruteo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tres niveles arriba de backend/src/utils/ llegan a la raíz del repo.
const DIR_CAPTURA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..',
  '.planning', 'phases', '04-fidelidad-de-curvas-y-rotondas', 'captura'
);

/**
 * Si CAPTURAR_GEOMETRIA=true, escribe `contenido` a un archivo JSON dentro del
 * directorio de captura de la Fase 4. Nunca lanza: un fallo de escritura solo
 * se loguea, para no interrumpir la respuesta real de ruteo al usuario.
 */
export function capturarSiCorresponde(nombre, contenido) {
  if (process.env.CAPTURAR_GEOMETRIA !== 'true') return;
  try {
    mkdirSync(DIR_CAPTURA, { recursive: true });
    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(DIR_CAPTURA, `${marca}-${nombre}.json`), JSON.stringify(contenido, null, 2));
  } catch (err) {
    console.warn('[captura-geometria]', err.message);
  }
}
