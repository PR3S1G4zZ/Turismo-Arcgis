---
phase: 05-mantener-la-pantalla-activa
plan: 01
subsystem: navigation
tags: [screen-wake-lock, react-hooks, vitest, visibility-api, graceful-degradation]

# Dependency graph
requires:
  - phase: 01-diagn-stico-e-instrumentaci-n
    provides: "useNavegacion con estados y marcas de rendimiento preservadas para el ciclo de navegación"
provides:
  - "useWakeLock aislado con sentinel único, guardia de generaciones, release y recuperación por visibilitychange"
  - "Contrato wakeLock expuesto por useNavegacion para consumidores del NavegacionContext"
  - "Aviso no bloqueante en RouteModal cuando Screen Wake Lock no está disponible"
affects: [07-endurecimiento-y-uat]

# Actuals
actuals:
  tokens: 12000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen Wake Lock se administra con refs imperativas y un único listener release; la UI solo consume estado categórico"
    - "Promesas tardías se invalidan con un contador de generación y se liberan sin propagar errores"
    - "Las pruebas de hooks desmontan sus árboles renderHook para no compartir listeners entre casos"

key-files:
  created:
    - frontend/src/hooks/useWakeLock.js
    - frontend/src/hooks/useWakeLock.test.js
  modified:
    - frontend/src/hooks/useNavegacion.js
    - frontend/src/hooks/useNavegacion.test.js
    - frontend/src/componentes/detalle/RouteModal.jsx

key-decisions:
  - "La demanda del lock es estado === calculando o navegando; previsualizando, llegado, error e inactivo no consumen el recurso."
  - "La recuperación automática ocurre únicamente ante visibilitychange a visible; una liberación del sistema se vuelve observable sin reintento inmediato agresivo."
  - "Unsupported, denied, error y released son estados no fatales y comparten el copy discreto aprobado, sin mostrar la excepción técnica."

requirements-completed: [WAKE-01]

coverage:
  - id: W1
    description: "La navegación real solicita request('screen'), conserva el lock durante el ciclo y lo libera al desactivar o desmontar."
    requirement: WAKE-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useWakeLock.test.js#solicita screen y libera el sentinel al desactivar"
        status: pass
      - kind: unit
        ref: "frontend/src/hooks/useWakeLock.test.js#libera el sentinel vigente al desmontar"
        status: pass
      - kind: unit
        ref: "frontend/src/hooks/useNavegacion.test.js#sends origin then destination when it requests route A to B"
        status: pass
    human_judgment: false
  - id: W2
    description: "El hook detecta release externo y reintenta una sola vez al volver a visible, sin duplicar solicitudes."
    requirement: WAKE-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useWakeLock.test.js#detecta release del sistema y reintenta una sola vez al volver a visible"
        status: pass
    human_judgment: false
  - id: W3
    description: "La ausencia o falla de la API no interrumpe la navegación y expone una advertencia discreta en el seguimiento real."
    requirement: WAKE-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useWakeLock.test.js#degrada de forma segura cuando el navegador no soporta Wake Lock"
        status: pass
      - kind: unit
        ref: "frontend/src/hooks/useWakeLock.test.js#convierte el rechazo de request en estado no fatal"
        status: pass
      - kind: static/build
        ref: "RouteModal.jsx#route-gps-status--warn con RiErrorWarningLine y copy aprobado"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-01
status: complete
---

# Phase 5 Plan 1: Screen Wake Lock Summary

**La navegación real mantiene un Screen Wake Lock opcional durante `calculando`/`navegando`, lo recupera después de volver a primer plano y continúa sin interrupciones cuando el navegador no lo permite.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `useWakeLock.js` administra un solo sentinel, captura rechazo/errores, observa el evento `release`, reintenta al volver a `visible` y libera recursos al cancelar o desmontar.
- Una guardia de generación libera respuestas tardías de `request()` sin reactivar el lock tras finalizar el ciclo.
- `useNavegacion` es el único dueño del ciclo: activa Wake Lock solo para navegación real y expone el estado bajo `wakeLock`.
- `RouteModal` muestra el aviso aprobado dentro de `route-gps-status--warn`, solo durante tracking no simulado, sin bloquear acciones.
- La instrumentación de Fase 1 en `useNavegacion.js`, `useGeolocation.js` y `useOrientacion.js` quedó preservada.

## Task Commits

1. **Task 1: hook y pruebas del ciclo de vida**
   - `c677317` feat(05): add resilient Screen Wake Lock hook
2. **Task 2: integración con navegación**
   - `570d6b1` feat(05): connect Wake Lock to navigation lifecycle
3. **Task 3: aviso discreto de UI**
   - `570d6b1` feat(05): connect Wake Lock to navigation lifecycle

Documentación y plan:

- `2a112d9` docs(05): record Wake Lock research
- `fb56539` docs(05): add Wake Lock execution plan

## Deviations from Plan

### Auto-fixed Issues

1. El agente ejecutor delegado no devolvió señal de finalización ni cambios tras sus ventanas de ejecución; se cerró de forma controlada y el plan se completó localmente para no dejar la fase bloqueada. No hubo cambios concurrentes que integrar.
2. ESLint rechazó actualizaciones de estado sincrónicas dentro del efecto. Se ajustó el inicio de la solicitud al microtask siguiente y se derivó el estado expuesto inactivo cuando la demanda es falsa; esto conserva el ciclo y evita renders en cascada.
3. Las pruebas existentes de `useNavegacion` mantenían árboles `renderHook` entre casos; se añadió `cleanup()` para aislar el nuevo registro de demanda Wake Lock y evitar falsos positivos.

Impacto: ninguna desviación cambia el proveedor de mapas, GPS, ruteo, geometría, voz o umbrales de recálculo.

## Verification

- `npx vitest run src/hooks/useWakeLock.test.js src/hooks/useNavegacion.test.js`: 10/10 tests pass.
- `npx vitest run`: 9 archivos, 40 tests pass.
- `npm run lint`: pass.
- `npm run build`: pass; Vite solo conserva el warning preexistente de chunks mayores a 500 kB.
- `git diff --check`: pass.

## Self-Check: PASSED

Los artefactos del plan, los archivos de implementación y las pruebas existen; los commits de implementación y documentación están presentes. `AGENT_INSTRUCTIONS.md` se dejó sin trackear y no se modificó.

## Next Phase Readiness

WAKE-01 queda implementado y listo para que la Fase 7 amplíe las pruebas de ciclo de vida/UAT físico en navegadores reales. No requiere configuración externa ni cambios de backend.
