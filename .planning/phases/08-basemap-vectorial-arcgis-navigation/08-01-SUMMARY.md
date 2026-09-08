---
phase: 08-basemap-vectorial-arcgis-navigation
plan: 01
subsystem: basemap-security-testing
tags: [arcgis, maplibre, navigation, csp, fallback, uat]

requires:
  - phase: 08-basemap-vectorial-arcgis-navigation
    provides: diagnosis, research, and implementation plan
provides:
  - official ArcGIS Navigation basemap integration with Spanish preferences
  - separated public basemap and private routing credentials
  - explicit basemap fallback diagnostics and CSP coverage
  - regression tests and local verification evidence
affects: []

actuals:
  tasks: 1
  commits: 1

key-files:
  created:
    - .planning/phases/08-basemap-vectorial-arcgis-navigation/08-DIAGNOSIS.md
    - .planning/phases/08-basemap-vectorial-arcgis-navigation/08-01-SUMMARY.md
    - backend/src/routes/mapa.test.js
    - backend/src/index.test.js
  modified:
    - backend/src/config.js
    - backend/src/routes/mapa.js
    - backend/src/index.js
    - frontend/src/componentes/detalle/InteractiveMap.jsx
    - frontend/src/utilidades/api.js
    - frontend/package.json

key-decisions:
  - "ArcGIS Navigation is nominal when a Basemaps-only key exists; OSM is an explicit diagnostic fallback."
  - "Routing API keys and OAuth client secrets stay backend-only; the browser receives only the public basemap key."
  - "GPS, arrow, camera, progress, recalculation, voice, and route geometry remain outside the change boundary."
  - "Physical production validation remains HUMAN_NEEDED; no successful result is inferred from a 401 without a key."

requirements-completed: [BASEMAP-01, BASEMAP-02, BASEMAP-03, BASEMAP-04]

coverage:
  - id: LOCAL-01
    description: "Official light/dark Spanish basemap, explicit OSM fallback, attribution, and error categories"
    verification:
      - kind: test
        ref: "frontend Vitest: 10 files, 120 tests"
        status: pass
    human_judgment: false
  - id: LOCAL-02
    description: "Credential separation, CSP, routing-provider diagnostics, and no routing secret in browser response"
    verification:
      - kind: test
        ref: "backend Vitest: 3 files, 13 tests; backend node:test: 5 tests"
        status: pass
    human_judgment: false
  - id: HUMAN-01
    description: "Valid ArcGIS key/referrers, Railway deployment, and phone HTTPS UAT"
    verification: []
    human_judgment: true
    rationale: "Requires the user's ArcGIS Online/Railway credentials and a physical HTTPS device."

status: awaiting-human
completed: 2026-09-08
---

# Phase 8 Plan 01 Summary

Implementación, revisión independiente y verificación local completadas. La
configuración real de ArcGIS Online/Railway y el UAT físico quedan pendientes
como checkpoint humano; ver `08-VERIFICATION.md` y `08-DIAGNOSIS.md`.
