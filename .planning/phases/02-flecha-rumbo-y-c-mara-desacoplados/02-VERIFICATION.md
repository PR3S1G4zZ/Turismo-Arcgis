---
phase: 02-flecha-rumbo-y-c-mara-desacoplados
status: human_needed
verified: 2026-09-01
requirements: [NAV-01, NAV-02, NAV-03, NAV-04]
---

# Verificación de Fase 2

## Automatizada

- `npm.cmd test`: 8 archivos, 49 tests, 0 fallos.
- `npm.cmd run lint`: 0 errores.
- `npm.cmd run build`: terminó con código 0; conserva únicamente el warning
  existente de chunks grandes de Vite.
- `git diff --check`: sin errores de whitespace.

## Trazabilidad de requisitos

| Requisito | Evidencia |
|---|---|
| NAV-01 | `seleccionarRumbo` prioriza GPS confiable en movimiento, brújula fresca en reposo y tangente de ruta como respaldo; integración cubierta por `InteractiveMap.test.jsx`. |
| NAV-02 | `siguiendo` solo guarda/omite el efecto `easeTo`; los tests de gesto y bearing verifican que el arrow cambia mientras la cámara está pausada. |
| NAV-03 | `useGeolocation` mantiene un watch único; `useOrientacion` tiene suscripción idempotente/cleanup; `useNavegacion` expone el avance sin conocer cámara. |
| NAV-04 | Las marcas `gps:aceptado`, `orientacion:cambio`, `flecha:render`, `marcador:render-inicio` y `camara:actualizada` quedan conectadas dev-only, sin datos sensibles. |

## Verificación física pendiente

El objetivo p95 (<250 ms rumbo→flecha y <500 ms GPS→cámara) requiere una
muestra real en Android Chrome y, si está disponible, iPhone Safari. Debe
revisarse `window.__diagnosticoLatencias.resumen()` durante una sesión de
navegación y confirmar que solo aparecen tramos, conteos y duraciones.

## Resultado

Automatización pasada; pendiente UAT físico para cerrar NAV-04 cuantitativo.
