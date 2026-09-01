import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { capturarSiCorresponde } from './capturaGeometria.js';

const DIR_CAPTURA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..',
  '.planning', 'phases', '04-fidelidad-de-curvas-y-rotondas', 'captura'
);

function archivosCapturados() {
  try {
    return readdirSync(DIR_CAPTURA);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

test('no escribe archivos cuando CAPTURAR_GEOMETRIA no vale exactamente true', () => {
  const valorAnterior = process.env.CAPTURAR_GEOMETRIA;
  const nombres = ['', 'false', 'TRUE'].map(
    (valor, indice) => `guard-apagado-${process.pid}-${Date.now()}-${indice}`
  );

  try {
    for (let indice = 0; indice < nombres.length; indice += 1) {
      process.env.CAPTURAR_GEOMETRIA = ['', 'false', 'TRUE'][indice];
      capturarSiCorresponde(nombres[indice], { prueba: true });
    }
  } finally {
    if (valorAnterior === undefined) delete process.env.CAPTURAR_GEOMETRIA;
    else process.env.CAPTURAR_GEOMETRIA = valorAnterior;
  }

  const archivos = archivosCapturados();
  for (const nombre of nombres) {
    assert.equal(
      archivos.some((archivo) => archivo.endsWith(`-${nombre}.json`)),
      false,
      `se escribió una captura con el guard apagado: ${nombre}`
    );
  }
});
