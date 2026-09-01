---
phase: 01-diagn-stico-e-instrumentaci-n
plan: 04
subsystem: ui
tags: [performance-api, vitest, react, maplibre, diagnostico]

# Dependency graph
requires:
  - phase: 01-diagn-stico-e-instrumentaci-n (Plan 01-01)
    provides: "diagnosticoLatencias.js y marcas de inicio para los tramos de recálculo y respuesta ArcGIS"
  - phase: 01-diagn-stico-e-instrumentaci-n (Plan 01-03)
    provides: "marcas GPS_ACEPTADO y ORIENTACION_CAMBIO desde los hooks de ubicación y orientación"
provides:
  - "Cierres de medición GPS→marcador, orientación→flecha y GPS→cámara en InteractiveMap.jsx"
  - "Cierre de medición respuesta→ruta renderizada condicionado a una ruta visible con puntos"
  - "Pruebas de nombres, límites de modo informativo y un único mark por ciclo de animación"
affects: [01-05, phase-2-navigation]

# Actuals (#2632)
actuals:
  tokens: 1715
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Los extremos de latencia reutilizan exclusivamente MARCAS/TRAMOS y el guard DEV de diagnosticoLatencias.js"
    - "El primer frame de RAF se marca dentro de la guarda inicio == null, evitando una medida por frame"

key-files:
  created: []
  modified:
    - frontend/src/componentes/detalle/InteractiveMap.jsx
    - frontend/src/componentes/detalle/InteractiveMap.test.jsx

key-decisions:
  - "La marca camara:actualizada se emite inmediatamente antes de map.easeTo y la medida inmediatamente después; la duración de easeTo permanece fuera del tramo, tal como define el plan."
  - "La ruta renderizada se mide solo cuando mostrarTrayecto es true y tramos.restante contiene puntos; el mapa informativo no emite la marca."

patterns-established:
  - "Instrumentación observacional en efectos React sin modificar parámetros ni ramas de navegación"

requirements-completed: [DIAG-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "InteractiveMap cierra los tramos GPS→marcador, orientación→flecha y GPS→cámara con nombres estáticos y el marcador del primer frame de animación."
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/componentes/detalle/InteractiveMap.test.jsx#measures GPS to the first marker animation frame once per animation cycle"
        status: pass
      - kind: unit
        ref: "frontend/src/componentes/detalle/InteractiveMap.test.jsx#measures an accepted orientation change to arrow rendering"
        status: pass
      - kind: unit
        ref: "frontend/src/componentes/detalle/InteractiveMap.test.jsx#measures accepted GPS to the live camera update"
        status: pass
    human_judgment: false
  - id: D2
    description: "InteractiveMap cierra respuesta→ruta renderizada únicamente para una ruta visible con puntos y conserva el comportamiento del mapa informativo."
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/componentes/detalle/InteractiveMap.test.jsx#measures an arriving route to its rendered remaining geometry"
        status: pass
      - kind: unit
        ref: "frontend/src/componentes/detalle/InteractiveMap.test.jsx#does not mark route rendering for an informational map"
        status: pass
    human_judgment: false
  - id: D3
    description: "La captura de latencias en hardware físico queda pendiente y no se simula con datos de escritorio."
    requirement: DIAG-01
    verification: []
    human_judgment: true
    rationale: "Requiere un Android físico, una sesión HTTPS y lectura humana de la consola remota; 01-05 contiene el procedimiento y el checkpoint."

# Metrics
duration: ~35min
completed: 2026-09-01
status: complete
---

# Phase 1 Plan 4: InteractiveMap latency endpoints Summary

**Los seis tramos de diagnóstico quedan conectados extremo a extremo sin alterar cámara, flecha ni renderizado de rutas.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-01T10:25:00-05:00 (approx.)
- **Completed:** 2026-09-01T10:33:16-05:00
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Añadidos los cierres de GPS→marcador, orientación→flecha y GPS→cámara, reutilizando las marcas de inicio creadas por los planes anteriores.
- Añadido el cierre respuesta→ruta renderizada solo para trayectos visibles con `tramos.restante` no vacío.
- Extendida la suite de `InteractiveMap` con cinco pruebas: cuatro medidas positivas y la exclusión explícita del mapa informativo; las seis pruebas de cámara existentes permanecen intactas.

## Task Commits

1. **Task 1: extremos finales de marcador, flecha y cámara** - `08c5e69` (tests), `7e550e2` (feat)
2. **Task 2: extremo final de respuesta a ruta renderizada** - `08c5e69` (tests), `7e550e2` (feat)

La separación de commits conserva la secuencia TDD RED → GREEN; ambos tasks comparten los commits porque se implementaron en el mismo componente y archivo de pruebas.

## Files Created/Modified

- `frontend/src/componentes/detalle/InteractiveMap.jsx` - emite las cuatro marcas finales y sus medidas dev-only.
- `frontend/src/componentes/detalle/InteractiveMap.test.jsx` - prueba los cuatro extremos nuevos, el ciclo de animación y la exclusión informativa.

## Decisions Made

- Se dejó intacto el cálculo de `rotacionFlecha`, el JSX de `Source`/`Layer` y todos los parámetros de `map.easeTo`/`fitBounds`.
- La medida del marcador ocurre en el primer callback de RAF, una sola vez por ciclo, no al final de los 600 ms de interpolación.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] Instalación de dependencias del frontend**
- **Encontrado durante:** verificación RED de Task 1.
- **Problema:** el worktree no tenía `node_modules`, por lo que Vitest no podía cargar `vitest/config` ni `@vitejs/plugin-react`.
- **Corrección:** ejecutado `npm ci` usando el `frontend/package-lock.json`; no se agregaron dependencias ni se modificaron archivos versionados.
- **Verificación:** la prueba objetivo terminó en 13/13 y la suite completa en 39/39.

---

**Total de desviaciones:** 1 auto-corregida (bloqueo de entorno).
**Impacto en el plan:** necesario para ejecutar las verificaciones; sin cambios de alcance ni de dependencias declaradas.

## Issues Encountered

La primera invocación de la prueba falló antes de descubrir el rojo funcional por la dependencia ausente; después de `npm ci`, el rojo esperado mostró cuatro medidas ausentes y nueve pruebas previas verdes. No quedan fallos de implementación.

## User Setup Required

Ninguna configuración adicional. La captura física de DIAG-01 sigue pendiente para el humano y está documentada en `01-DIAGNOSIS.md` dentro del Plan 01-05; no se han inventado mediciones.

## Next Phase Readiness

- Los seis nombres de tramo están conectados y la captura de hardware puede usar `window.__diagnosticoLatencias.resumen()`.
- Antes de considerar DIAG-01 cerrado, el dueño del milestone debe ejecutar la sesión Android física descrita en 01-DIAGNOSIS.md y reportar solo los seis grupos numéricos.

---
*Phase: 01-diagn-stico-e-instrumentaci-n*
*Completed: 2026-09-01*

## Self-Check: PASSED

Los archivos modificados existen, los commits `08c5e69` y `7e550e2` están en `git log`, la prueba objetivo pasó 13/13 y la suite completa pasó 39/39.
