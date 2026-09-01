---
phase: 02-flecha-rumbo-y-c-mara-desacoplados
plan: 03
subsystem: mapa-flecha-camara
tags: [maplibre, camera-follow, arrow, diagnostics]
key-files: [frontend/src/componentes/detalle/InteractiveMap.jsx, frontend/src/componentes/detalle/InteractiveMap.test.jsx]
metrics: { tests: 16, commit: 9d0bd76 }
---

# Resumen 02-03

La flecha se calcula con el rumbo elegido relativo al bearing real del
viewport, incluso después de drag/rotate/pitch. `siguiendo` solo controla
`easeTo`; el bearing se actualiza desde `onLoad`/`onMove` y el recenter vuelve a
activar únicamente la cámara. Se conservaron las marcas dev-only, se
añadieron mediciones de marcador, flecha y cámara sin coordenadas ni tokens, y
`resumen()` ahora expone `p95Ms` para comprobar NAV-04.

## Commits

| Commit | Descripción |
|---|---|
| `9d0bd76` | `feat(02-03): desacoplar flecha y cámara` |

## Deviations

None.

## Self-Check

PASSED — suites de `InteractiveMap` y diagnóstico: 16/16.
