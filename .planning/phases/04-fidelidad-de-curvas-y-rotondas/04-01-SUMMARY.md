---
phase: 04-fidelidad-de-curvas-y-rotondas
plan: 01
subsystem: routing-geometry
tags: [arcgis, osrm, maplibre, dev-instrumentation, privacy]
status: complete
requirements: [GEOM-01]
requirements_completed: []
commit: 7e7733f
completed: 2026-09-01
---

# Fase 4 Plan 1: instrumentación geométrica dev-only

Se instrumentaron las primeras cuatro etapas del pipeline sin cambiar el
trazado lógico ni el renderizado: ArcGIS crudo, ArcGIS normalizado, OSRM crudo y
normalizado si interviene, y GeoJSON entregado a MapLibre.

## Archivos

- `backend/src/utils/capturaGeometria.js`: escritura JSON tolerante a fallos,
  activa solo con `CAPTURAR_GEOMETRIA=true`.
- `backend/src/utils/capturaGeometria.test.js`: prueba que valores ausentes o
  distintos de `true` no crean archivos.
- `backend/src/utils/arcgisRouting.js`: captura antes y después de normalizar;
  conserva `esriNAOutputLineTrueShape`.
- `backend/src/utils/osrmRouting.js`: captura equivalente para el respaldo.
- `frontend/src/componentes/detalle/InteractiveMap.jsx`: log de la ruta completa
  solo en desarrollo y con `window.__capturarGeometria === true`.
- `frontend/src/componentes/detalle/InteractiveMap.test.jsx`: prueba el guard
  apagado y la conversión exacta a GeoJSON al activarlo.
- `04-COMPARACION-GEOMETRIA.md`: tabla, procedimiento seguro y criterios para
  comparar las cinco etapas.

## Verificación

- `node --check` sobre los cuatro archivos backend: exit 0.
- `node --test src/utils/capturaGeometria.test.js`: 1/1.
- `npm test -- --run src/componentes/detalle/InteractiveMap.test.jsx`: 10/10.
- `npm run lint`: exit 0.
- `npm run build`: exit 0; solo advertencias preexistentes de tamaño de chunks.

## Decisiones y desviaciones

- Se añadió cobertura automatizada de ambos guards; el plan original solo
  proponía una comprobación indirecta del backend.
- El procedimiento se adaptó a PowerShell y pasó de ocho a nueve pasos.
- Para cumplir privacidad, la captura exige bloquear GPS, elegir manualmente un
  sitio turístico público como origen y abortar si la UI muestra “Mi ubicación”.
- No se aplicó casing, ancho, opacidad, densificación ni cambio de navegación:
  cualquier ajuste visual requiere primero evidencia real.

## Estado del requisito

La instrumentación está completa, pero GEOM-01 no se marca como cumplido: falta
la captura real y la comparación humana del Plan 04-02. GEOM-02 tampoco puede
validarse sin observar el resultado sobre una rotonda/curva real.
