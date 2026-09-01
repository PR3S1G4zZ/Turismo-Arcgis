---
phase: 07-endurecimiento-y-uat
plan: 01
subsystem: testing
tags: [vitest, express, supertest, arcgis, osrm, contract-tests]

requires: []
provides:
  - "backend Vitest runner (vitest.config.js + npm test)"
  - "POST /api/rutas/resolver contract tests with mocked fetch"
affects: [07-03]

actuals:
  tokens: 2500
  tasks: 1
  commits: 1

tech-stack:
  added: [vitest, supertest]
  patterns:
    - "vi.stubGlobal('fetch') routed by domain; never hits ArcGIS/OSRM"
    - "it.todo for TRAFFIC-01 startTime=now; real assertion that current body omits startTime"

key-files:
  created:
    - backend/vitest.config.js
    - backend/src/routes/routing.test.js
  modified:
    - backend/package.json

key-decisions:
  - "Vitest in backend to match frontend (07-CONTEXT D-03)"
  - "No fake startTime implementation; document current absence with a passing assertion plus todos"

requirements-completed: []

coverage:
  - id: D1
    description: "ArcGIS success, network/HTTP/body errors fall back to OSRM, dual failure 502, invalid coords 400"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: backend/src/routes/routing.test.js
        status: pass
    human_judgment: false
  - id: D2
    description: "Current solve body does not include startTime/TravelTime"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: "backend/src/routes/routing.test.js#hoy no envía startTime ni TravelTime"
        status: pass
    human_judgment: false
  - id: D3
    description: "Placeholders TRAFFIC-01 and ArcGIS timeout"
    requirement: HARDEN-01
    verification:
      - kind: unit
        ref: backend/src/routes/routing.test.js
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-01
status: complete
---

# Phase 7 Plan 01 Summary

**Vitest en backend y contrato real del proxy de rutas, con placeholders de tráfico.**

## Accomplishments

- Script `test` y `vitest.config.js` (environment node).
- 7 tests verdes + 4 todo. Fetch siempre mockeado; key `test-key`.
- Conservada la suite parcial previa; se añadió aserción de ausencia de `startTime`.

## Verification

`npm test` en `backend/`: 7 passed | 4 todo.

## Deviations

Ningún cambio de lógica de producción.
