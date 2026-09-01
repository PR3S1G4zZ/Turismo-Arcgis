---
phase: 01-diagn-stico-e-instrumentaci-n
plan: 01
subsystem: infra
tags: [performance-api, vitest, react-hooks, navegacion, diagnostico]

# Dependency graph
requires: []
provides:
  - "frontend/src/utilidades/diagnosticoLatencias.js: marcar()/medir()/resumen() dev-only latency instrumentation via performance.mark/measure, DEV-gated per call, MARCAS/TRAMOS name registries"
  - "useNavegacion.js wired for tramo 5 (solicitud->respuesta ArcGIS) and tramo 4 (desvio->solicitud), plus a reusable start mark for tramo 6"
affects: [01-02, 01-03, 01-04, 01-05]

# Actuals (#2632)
actuals:
  tokens: 3573
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-only instrumentation via browser Performance API (performance.mark/measure), guarded by import.meta.env.DEV re-checked on every call (never cached at module load) so Vite dead-code-eliminates the guarded branches from production"
    - "Frozen name registries (MARCAS for point-in-time marks, TRAMOS for diag:-prefixed measures) exported from a single utility module to avoid typo drift between start/end mark names"

key-files:
  created:
    - frontend/src/utilidades/diagnosticoLatencias.js
    - frontend/src/utilidades/diagnosticoLatencias.test.js
  modified:
    - frontend/src/hooks/useNavegacion.js
    - frontend/src/hooks/useNavegacion.test.js

key-decisions:
  - "diagnosticoLatencias.js implemented as a standalone utility (not a hook) so it can be imported from useNavegacion.js, useGeolocation.js, useOrientacion.js, and InteractiveMap.jsx alike in later plans (01-03/01-04) without React lifecycle coupling"
  - "resumen() clears performance marks/measures after aggregating (T-01-03 mitigation) to bound Performance timeline growth during a long physical-device capture session (Plan 01-05)"
  - "Task 1 (tracer) proven end-to-end before Task 2 (tramo 4) was started, per the plan's tracer-first structure -- tracer feedback gate re-ran the tracer's own verify command and passed before expanding"

requirements-completed: [DIAG-01]

coverage:
  - id: D1
    description: "diagnosticoLatencias.js exports marcar/medir/resumen/MARCAS/TRAMOS; DEV=false is a verified no-op (zero performance.mark/measure calls)"
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/utilidades/diagnosticoLatencias.test.js#no llama a performance.mark ni performance.measure cuando DEV es false"
        status: pass
      - kind: unit
        ref: "frontend/src/utilidades/diagnosticoLatencias.test.js#llama a performance.mark y performance.measure con los nombres exactos cuando DEV es true"
        status: pass
    human_judgment: false
  - id: D2
    description: "resumen() aggregates diag:* measures into {count, avgMs, minMs, maxMs} only (no coordinate/position keys) and clears the timeline after reading"
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/utilidades/diagnosticoLatencias.test.js#resumen() agrupa measures diag:* en {count, avgMs, minMs, maxMs} y limpia el timeline"
        status: pass
      - kind: unit
        ref: "frontend/src/utilidades/diagnosticoLatencias.test.js#resumen() ignora measures que no empiezan con diag:"
        status: pass
    human_judgment: false
  - id: D3
    description: "useNavegacion.calcular() emits the tramo 5 (solicitud->respuesta ArcGIS) mark/measure end-to-end when a route resolves"
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useNavegacion.test.js#mide el tramo solicitud->respuesta ArcGIS al resolver la ruta"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tramo 4 (desvio->solicitud) marks exactly once per deviation cycle and measures the interval up to the real recalculation call, without altering UMBRAL_DESVIO_M/LECTURAS_PARA_RECALCULAR/ESPERA_ENTRE_RECALCULOS_MS"
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useNavegacion.test.js#marca desvio:detectado una sola vez por ciclo y mide diag:desvio-solicitud al recalcular"
        status: pass
    human_judgment: false
  - id: D5
    description: "Physical-device latency capture and Phase 1 diagnostic report (reading window.__diagnosticoLatencias.resumen() on real hardware) -- out of this plan's scope, consumed by Plan 01-05"
    verification: []
    human_judgment: true
    rationale: "Requires a human running the app on physical Android/iPhone hardware over HTTPS and reading DevTools output -- cannot be automated from this worktree"

duration: ~15min
completed: 2026-09-01
status: complete
---

# Phase 1 Plan 1: Diagnostic latency instrumentation Summary

**Dev-only `performance.mark`/`performance.measure` utility (`diagnosticoLatencias.js`) wired end-to-end into `useNavegacion.js` for tramo 5 (solicitud→respuesta ArcGIS, tracer) and tramo 4 (desvío→solicitud), with tramo 6's start mark already reusable.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-01T09:36:00-05:00 (approx.)
- **Completed:** 2026-09-01T09:46:41-05:00
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Built `frontend/src/utilidades/diagnosticoLatencias.js`: `marcar()`, `medir()`, `resumen()`, and frozen `MARCAS`/`TRAMOS` name registries, all dev-only via a per-call `import.meta.env.DEV` guard (never cached at module load)
- Proved the mechanism end-to-end (tracer) by wiring tramo 5 (solicitud→respuesta ArcGIS) into `useNavegacion.calcular()` before expanding
- Instrumented tramo 4 (desvío→solicitud) inside the existing GPS tracking loop: marks the deviation cycle's first out-of-route reading once, measures up to the real recalculation call
- Left `MARCAS.RESPUESTA_RECIBIDA` (from Task 1) as the ready-to-use start mark for tramo 6, to be paired in `InteractiveMap.jsx` by Plan 01-04
- `resumen()` aggregates `diag:*` measures into `{count, avgMs, minMs, maxMs}` only and clears the Performance timeline after reading (STRIDE T-01-03 mitigation)

## Task Commits

Each task followed RED → GREEN (tdd="true"):

1. **Task 1: diagnosticoLatencias utility + tracer wiring (tramo 5)**
   - `ce0c3cd` test(01-01): add failing tests for diagnosticoLatencias utility and tracer wiring
   - `e78432c` feat(01-01): implement diagnosticoLatencias utility, wire tracer tramo 5
2. **Task 2: instrument tramo 4 (desvío→solicitud) + confirm tramo 6 start mark**
   - `1d041fd` test(01-01): add failing test for tramo 4 (desvio->solicitud) instrumentation
   - `a7d84d2` feat(01-01): instrument tramo 4 (desvio->solicitud), clean unused lint directive

_Both tasks are tdd="true"; RED was verified as a true failure (module/mark absent, not just an assertion mismatch) by temporarily removing the implementation file and re-running the suite before restoring it._

## Files Created/Modified
- `frontend/src/utilidades/diagnosticoLatencias.js` - marcar/medir/resumen + MARCAS/TRAMOS registries; DEV-gated, no coordinates ever recorded
- `frontend/src/utilidades/diagnosticoLatencias.test.js` - DEV-gating, exact mark/measure names, resumen() shape/cleanup, non-`diag:` filtering
- `frontend/src/hooks/useNavegacion.js` - `calcular()` wired for tramo 5; GPS tracking loop wired for tramo 4
- `frontend/src/hooks/useNavegacion.test.js` - e2e tracer test (tramo 5) + 3-reading deviation cycle test (tramo 4)

## Decisions Made
- Utility built standalone (not a hook) for reuse across `useGeolocation.js`/`useOrientacion.js`/`InteractiveMap.jsx` in Plans 01-03/01-04 without React lifecycle coupling
- `window.__diagnosticoLatencias` exposure is a one-time module-load-time check (not per-call), since it's a global registration rather than a measurement — consistent with the plan's D-04 "no HUD, read via DevTools" decision
- Test suite mocks `Date.now()` forward 20s past `ultimoCalculoRef` to exercise the tramo-4 recalculation path without waiting out the real 15s `ESPERA_ENTRE_RECALCULOS_MS` gate

## Deviations from Plan

None - plan executed exactly as written. One environment-setup step not explicitly in the plan: `npm install` was run in `frontend/` because this worktree had no `node_modules` (Rule 3 - blocking, standard dependency install already declared in `package.json`, no new packages added).

## Issues Encountered
- **`.planning/` absent from this worktree's branch.** This worktree's branch (`worktree-agent-a5027282ffefe0ca6`) diverged from `main` before the orchestrator's `.planning/` setup commits existed on `PR3S1G4zZ/chore-multiagent-dev-station`. Read PLAN.md/PROJECT.md/STATE.md/config.json/01-CONTEXT.md via `git show 8f7a7af:.planning/...` (read-only, no merge) to avoid pulling unrelated commits into this branch's history. `.planning/phases/01-diagn-stico-e-instrumentaci-n/` was created fresh in this worktree solely to hold this plan's `01-01-SUMMARY.md`, per the required `<output>` path.
- **Initial deviation-distance test position undershot the 45m threshold's timing gate**, not the distance itself: the 3-reading deviation test initially failed because `ESPERA_ENTRE_RECALCULOS_MS` (15s) hadn't elapsed in real test time. Fixed by mocking `Date.now()` forward 20s for that test only (Rule 1 - test bug, not a production code issue).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `diagnosticoLatencias.js` is ready to be imported by Plan 01-03 (tramos GPS→marcador, orientación→flecha, GPS→cámara) and Plan 01-04 (tramo 6 end mark in `InteractiveMap.jsx`) without further scaffolding
- Physical-device capture (Plan 01-05) can call `window.__diagnosticoLatencias.resumen()` from DevTools once all 6 tramos are wired
- No blockers. This plan is diagnosis-only per Fase 1 scope; no navigation behavior or recalculation thresholds were changed (verified: `UMBRAL_DESVIO_M`/`LECTURAS_PARA_RECALCULAR`/`ESPERA_ENTRE_RECALCULOS_MS` unchanged at 45/3/15000)

---
*Phase: 01-diagn-stico-e-instrumentaci-n*
*Completed: 2026-09-01*

## Self-Check: PASSED

All created/modified files found on disk; all 4 task commits (`ce0c3cd`, `e78432c`, `1d041fd`, `a7d84d2`) present in `git log`.
