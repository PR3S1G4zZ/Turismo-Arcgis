---
status: testing
phase: 02-flecha-rumbo-y-c-mara-desacoplados
source: [02-VERIFICATION.md]
started: 2026-09-01T00:00:00-05:00
updated: 2026-09-01T00:00:00-05:00
---

## Current Test

number: 1
name: Validar p95 rumbo→flecha en dispositivo real
expected: |
  En una sesión de navegación real, `window.__diagnosticoLatencias.resumen()`
  muestra `diag:orientacion-flecha.p95Ms < 250` y
  `diag:gps-camara.p95Ms < 500`, sin coordenadas, rutas ni tokens.
awaiting: user response

## Tests

### 1. Validar p95 rumbo→flecha en Android Chrome
expected: `diag:orientacion-flecha.p95Ms < 250`; las medidas contienen solo nombres y duraciones.
result: [pending]

### 2. Validar p95 GPS→cámara en Android Chrome
expected: `diag:gps-camara.p95Ms < 500`; la cámara sigue actualizando mientras la flecha continúa orientada.
result: [pending]

### 3. Repetir sensores y permisos en iPhone Safari si está disponible
expected: permiso de orientación funciona, no se duplican listeners y la flecha permanece estable al cruzar norte.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
