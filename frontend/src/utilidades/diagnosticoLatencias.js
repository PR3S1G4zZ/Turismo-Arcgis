// src/utilidades/diagnosticoLatencias.js
// Instrumentación de diagnóstico de latencias de navegación (Fase 1, DIAG-01).
//
// Mide, solo en desarrollo, cuánto tarda cada tramo interno del flujo de
// navegación (GPS→marcador, orientación→flecha, GPS→cámara, desvío→solicitud,
// solicitud→respuesta ArcGIS, respuesta→ruta renderizada) usando la API
// estándar del navegador (performance.mark/performance.measure). Nunca
// registra coordenadas, rumbo ni geometría de ruta -- solo nombres de tramo
// y duraciones numéricas (ver 01-CONTEXT.md D-04). Se apaga sola en
// producción: cada función comprueba import.meta.env.DEV en el momento de la
// llamada (no se cachea al cargar el módulo), para que Vite pueda eliminar
// por dead-code-elimination las ramas guardadas del bundle de producción.

// Nombres de marca puntual: un instante concreto del flujo.
export const MARCAS = Object.freeze({
  GPS_ACEPTADO: 'gps:aceptado',
  MARCADOR_RENDER: 'marcador:render-inicio',
  CAMARA_ACTUALIZADA: 'camara:actualizada',
  ORIENTACION_CAMBIO: 'orientacion:cambio',
  FLECHA_RENDER: 'flecha:render',
  DESVIO_DETECTADO: 'desvio:detectado',
  RECALCULO_SOLICITADO: 'recalculo:solicitado',
  SOLICITUD_ENVIADA: 'solicitud:enviada',
  RESPUESTA_RECIBIDA: 'respuesta:recibida',
  RUTA_RENDERIZADA: 'ruta:renderizada',
});

// Nombres de medida (duración entre dos marcas). Todos con prefijo 'diag:'
// para que resumen() los pueda filtrar sin ambigüedad frente a measures de
// otras herramientas (p. ej. React DevTools) que compartan el mismo
// Performance timeline del navegador.
export const TRAMOS = Object.freeze({
  GPS_MARCADOR: 'diag:gps-marcador',
  ORIENTACION_FLECHA: 'diag:orientacion-flecha',
  GPS_CAMARA: 'diag:gps-camara',
  DESVIO_SOLICITUD: 'diag:desvio-solicitud',
  SOLICITUD_RESPUESTA_ARCGIS: 'diag:solicitud-respuesta-arcgis',
  RESPUESTA_RUTA_RENDERIZADA: 'diag:respuesta-ruta-renderizada',
});

/** Registra una marca puntual del flujo. No-op fuera de desarrollo. */
export function marcar(nombre) {
  if (!import.meta.env.DEV) return;
  try {
    performance.mark(nombre);
  } catch {
    // Performance API no disponible o nombre inválido: no debe romper el
    // flujo de navegación real por un fallo de instrumentación.
  }
}

/**
 * Mide la duración entre dos marcas ya registradas y la reporta a consola
 * (solo tramo + duración numérica, nunca coordenadas). No-op fuera de
 * desarrollo. Si alguna marca no existe (p. ej. un ciclo se saltó),
 * performance.measure lanza -- se captura para no romper el flujo real.
 */
export function medir(tramo, inicio, fin) {
  if (!import.meta.env.DEV) return;
  try {
    const medida = performance.measure(tramo, inicio, fin);
    console.debug('[diag]', tramo, Math.round(medida.duration), 'ms');
  } catch {
    // Marca de inicio/fin ausente: se ignora, no es una condición de error real.
  }
}

/**
 * Agrupa las medidas de diagnóstico ('diag:*') acumuladas en el Performance
 * timeline por tramo, y lo limpia después de leer para no dejarlo crecer sin
 * límite durante una sesión larga de captura en dispositivo físico
 * (ver Plan 01-05).
 * @returns {Object<string, {count:number, avgMs:number, minMs:number, maxMs:number}>}
 */
export function resumen() {
  const entradas = performance
    .getEntriesByType('measure')
    .filter((entrada) => entrada.name.startsWith('diag:'));

  const agrupado = {};
  for (const entrada of entradas) {
    if (!agrupado[entrada.name]) {
      agrupado[entrada.name] = { count: 0, avgMs: 0, minMs: Infinity, maxMs: -Infinity, _sumaMs: 0 };
    }
    const g = agrupado[entrada.name];
    g.count += 1;
    g._sumaMs += entrada.duration;
    g.minMs = Math.min(g.minMs, entrada.duration);
    g.maxMs = Math.max(g.maxMs, entrada.duration);
  }

  for (const nombre of Object.keys(agrupado)) {
    const g = agrupado[nombre];
    g.avgMs = Math.round((g._sumaMs / g.count) * 100) / 100;
    g.minMs = Math.round(g.minMs * 100) / 100;
    g.maxMs = Math.round(g.maxMs * 100) / 100;
    delete g._sumaMs;
  }

  performance.clearMarks();
  performance.clearMeasures();
  return agrupado;
}

// Punto de entrada manual desde DevTools, solo en desarrollo -- sin HUD
// visual nuevo ni export a JSON, por decisión D-04 de 01-CONTEXT.md. Se
// evalúa una sola vez al cargar el módulo (no en cada llamada) porque es un
// registro global, no una medición: si el módulo se carga con DEV=false
// (build de producción), no se asigna nada a window.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__diagnosticoLatencias = { resumen, MARCAS, TRAMOS };
}
