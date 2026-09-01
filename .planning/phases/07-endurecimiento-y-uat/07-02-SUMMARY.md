---
phase: 07-endurecimiento-y-uat
plan: 02
subsystem: testing
tags: [vitest, geoRuta, useNavegacion, InteractiveMap, wake-lock]

requires: []
provides:
  - "Unit tests for rumbo, circular smoothing, synthetic geometry"
  - "Deviation persistence tests against current 3-reading threshold"
  - "Camera recenter tests; documented current arrow/enSeguimiento coupling"
  - "Wake Lock it.todo file without fake hook"
affects: [07-03]

actuals:
  tokens: 3500
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "it.todo labeled Pendiente de Fase N (07-CONTEXT D-01)"
    - "Map mock renders children so the user arrow is observable"

key-files:
  created:
    - frontend/src/hooks/useWakeLock.test.js
  modified:
    - frontend/src/utilidades/geoRuta.test.js
    - frontend/src/hooks/useNavegacion.test.js
    - frontend/src/componentes/detalle/InteractiveMap.test.jsx

key-decisions:
  - "Did not implement Wake Lock or RECALC hysteresis"
  - "Did not fix NAV-02; test records rotate(0deg) while follow is paused"

requirements-completed: []

coverage:
  - id: D1
    description: "Rumbo, suavizado circular 359→0, geometría sintética (rotonda, paralela, vértices)"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: frontend/src/utilidades/geoRuta.test.js
        status: pass
    human_judgment: false
  - id: D2
    description: "Two off-route fixes do not recalc; returning to polyline resets the counter"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: frontend/src/hooks/useNavegacion.test.js
        status: pass
    human_judgment: false
  - id: D3
    description: "Centrar en mí resumes course-up after drag"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: frontend/src/componentes/detalle/InteractiveMap.test.jsx
        status: pass
    human_judgment: false
  - id: D4
    description: "Wake Lock lifecycle placeholders only"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: frontend/src/hooks/useWakeLock.test.js
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-01
status: complete
---

# Phase 7 Plan 02 Summary

**Suite frontend ampliada contra código existente; placeholders para WAKE/NAV/RECALC/GEOM ausentes.**

## Accomplishments

- `suavizarRumbo` cruza el norte; polilínea conserva vértices; rotonda y calle paralela sintéticas.
- Persistencia de desvío del hook actual (no histéresis multi-señal).
- Recentrado de cámara; flecha a 0deg con seguimiento pausado (bug NAV-02 documentado, no parcheado).
- `useWakeLock.test.js` solo `it.todo`.

## Verification

`npm test` en `frontend/`: 44 passed | 11 todo.

## Deviations

Mock de Map en tests ahora renderiza `children` (solo test). Cero cambios de producción.
