---
phase: 02-flecha-rumbo-y-c-mara-desacoplados
plan: 02
subsystem: sensores-navegacion
tags: [geolocation, orientation, lifecycle, performance]
key-files: [frontend/src/hooks/useGeolocation.js, frontend/src/hooks/useOrientacion.js, frontend/src/hooks/useNavegacion.js]
metrics: { tests: 18, commit: fe87bb5 }
---

# Resumen 02-02

Se conservó el único `watchPosition`, se compartió el umbral GPS/mapa, y se
publicó `ultimaActualizacion` para lecturas de brújula válidas. La suscripción
de orientación ahora es idempotente, selecciona un evento preferido con
fallback y remueve exactamente el listener activo. `useNavegacion` expone
`avanceRuta` como el matching ya calculado, sin introducir dependencia de
cámara ni cambiar recálculo, voz o proveedores.

## Commits

| Commit | Descripción |
|---|---|
| `fe87bb5` | `feat(02-02): desacoplar lifecycle de sensores` |

## Deviations

None.

## Self-Check

PASSED — suites de hooks: 18/18.
