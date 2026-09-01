---
phase: 02-flecha-rumbo-y-c-mara-desacoplados
plan: 01
subsystem: rumbo-visual
tags: [geoRuta, rumbo, viewport, tdd]
key-files: [frontend/src/utilidades/geoRuta.js, frontend/src/utilidades/geoRuta.test.js]
metrics: { tests: 9, commit: 4f7c5b9 }
---

# Resumen 02-01

Se añadieron las primitivas puras para normalización, diferencia angular corta,
tangente de ruta y precedencia movimiento → brújula fresca → tangente. El
umbral compartido de movimiento quedó en `geoRuta` y no se modificó la
geometría ni el matching existente.

## Commits

| Commit | Descripción |
|---|---|
| `4f7c5b9` | `feat(02-01): desacoplar selección de rumbo` |

## Deviations

None.

## Self-Check

PASSED — suite de `geoRuta`: 9/9.
