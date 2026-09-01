---
phase: 01-diagn-stico-e-instrumentaci-n
plan: 03
subsystem: infra
tags: [performance-api, vitest, react-hooks, geolocation, orientation, diagnostico]

# Dependency graph
requires:
  - phase: 01-diagn-stico-e-instrumentaci-n (Plan 01-01)
    provides: "frontend/src/utilidades/diagnosticoLatencias.js: marcar()/medir()/resumen() dev-only latency instrumentation via performance.mark/measure"
provides:
  - "useGeolocation.js handleSuccess() marks MARCAS.GPS_ACEPTADO once per accepted fix -- shared start mark for tramos 1 (GPS->marcador) and 3 (GPS->camara)"
  - "useOrientacion.js manejar() marks MARCAS.ORIENTACION_CAMBIO once per accepted (post-throttle, post-validation) compass reading -- start mark for tramo 2 (orientacion->flecha)"
  - "useOrientacion.test.js: first-ever test coverage for useOrientacion.js"
affects: [01-04, 01-05]

# Actuals (#2632)
actuals:
  tokens: 1847
  tasks: 2
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reused Plan 01-01's diagnosticoLatencias.js marcar()/MARCAS pattern unchanged -- no new instrumentation mechanism introduced"
    - "Test isolation via markSpy.mockClear() immediately after mount (before triggering the event under test), since this test file does not unmount renderHook trees between tests"

key-files:
  created:
    - frontend/src/hooks/useOrientacion.test.js
    - frontend/src/utilidades/diagnosticoLatencias.js
    - frontend/src/utilidades/diagnosticoLatencias.test.js
  modified:
    - frontend/src/hooks/useGeolocation.js
    - frontend/src/hooks/useGeolocation.test.js
    - frontend/src/hooks/useOrientacion.js

key-decisions:
  - "diagnosticoLatencias.js and its test file were restored verbatim from Plan 01-01's commit on PR3S1G4zZ/chore-multiagent-dev-station (read-only reference, no merge) because this worktree branched from main before Plan 01-01 landed there -- see Deviations"
  - "marcar(MARCAS.GPS_ACEPTADO) placed immediately before setPosition() in handleSuccess, after the esConfiable early-return guard, so it fires exactly once per accepted fix and never for discarded fixes (low accuracy / stale timestamp)"
  - "marcar(MARCAS.ORIENTACION_CAMBIO) placed immediately after the ~100ms throttle guard and before setHeading() in manejar(), so it fires once per accepted compass reading and never inside the throttle window or for an event with no valid heading"

requirements-completed: [DIAG-01]

coverage:
  - id: D1
    description: "useGeolocation.js marks gps:aceptado exactly once per accepted GPS fix, never for fixes discarded by low accuracy or stale timestamp"
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useGeolocation.test.js#marks gps:aceptado exactly once when a fix is accepted"
        status: pass
      - kind: unit
        ref: "frontend/src/hooks/useGeolocation.test.js#does not mark gps:aceptado when a fix is rejected for low accuracy"
        status: pass
    human_judgment: false
  - id: D2
    description: "useOrientacion.js marks orientacion:cambio once per accepted (post-throttle, post-validation) compass reading, and useOrientacion.test.js exists as first-ever coverage for the hook"
    requirement: DIAG-01
    verification:
      - kind: unit
        ref: "frontend/src/hooks/useOrientacion.test.js#marks orientacion:cambio exactly once for a heading change that passes the throttle"
        status: pass
      - kind: unit
        ref: "frontend/src/hooks/useOrientacion.test.js#does not mark a second time for an event inside the ~100ms throttle window"
        status: pass
      - kind: unit
        ref: "frontend/src/hooks/useOrientacion.test.js#does not mark when the event has no valid heading"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-01
status: complete
---

# Phase 1 Plan 3: GPS and orientation latency instrumentation Summary

**`useGeolocation.js` and `useOrientacion.js` now emit start marks (`gps:aceptado`, `orientacion:cambio`) for tramos 1/3 (GPS→marcador/cámara) and 2 (orientación→flecha) of the Fase 1 latency diagnostic, with `useOrientacion.test.js` created from scratch as the hook's first test coverage.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-01T09:52:00Z (approx.)
- **Completed:** 2026-09-01T10:01:00Z (approx.)
- **Tasks:** 2/2
- **Files modified:** 6 (4 created, 2 modified; 2 of the created files are a restored Plan 01-01 dependency, not new plan scope)

## Accomplishments
- `useGeolocation.js` `handleSuccess()` marks `MARCAS.GPS_ACEPTADO` exactly once for every accepted GPS fix (the shared start mark for tramos 1 GPS→marcador and 3 GPS→cámara), and never for fixes discarded by low accuracy or a stale/non-newer timestamp
- `useOrientacion.js` `manejar()` marks `MARCAS.ORIENTACION_CAMBIO` exactly once per accepted compass reading (post-~100ms-throttle, post-`leerRumbo` validation) — the start mark for tramo 2 orientación→flecha
- `useOrientacion.test.js` created from scratch (did not exist before this plan): covers the accepted-reading mark, the throttle-window non-duplication, and the no-valid-heading non-mark cases
- Neither hook's acceptance thresholds, throttle timing, or heading-smoothing behavior were changed — instrumentation only observes already-accepted state transitions

## Task Commits

Each task followed RED → GREEN (tdd="true"):

0. **Prerequisite: restore diagnosticoLatencias.js dependency** (Rule 3 - blocking, missing referenced file; see Deviations)
   - `c7e55d5` chore(01-03): restore diagnosticoLatencias.js dependency from Plan 01-01
1. **Task 1: marca de arranque compartida GPS_ACEPTADO en useGeolocation.js (tramos 1 y 3)**
   - `2749578` test(01-03): add failing test for gps:aceptado mark in useGeolocation
   - `73acc2e` feat(01-03): mark gps:aceptado on accepted GPS fixes in useGeolocation
2. **Task 2: marca ORIENTACION_CAMBIO en useOrientacion.js + test nuevo (tramo 2)**
   - `8035d81` test(01-03): add failing test suite for orientacion:cambio mark in useOrientacion
   - `e29d00c` feat(01-03): mark orientacion:cambio on accepted compass readings in useOrientacion

_Both tasks are tdd="true"; RED was verified as a true failure (the mark assertion failing with zero recorded calls, not just a mismatched value) before implementing GREEN. Task 1's RED also surfaced a real test-isolation bug in the new tests themselves (see Deviations), fixed before commit._

## Files Created/Modified
- `frontend/src/hooks/useGeolocation.js` - imports `marcar`/`MARCAS`; marks `gps:aceptado` right before `setPosition()` in the accepted-fix branch of `handleSuccess`
- `frontend/src/hooks/useGeolocation.test.js` - 2 new tests: exactly-one mark on acceptance, zero marks on low-accuracy rejection
- `frontend/src/hooks/useOrientacion.js` - imports `marcar`/`MARCAS`; marks `orientacion:cambio` right after the throttle guard, before `setHeading()` in `manejar()`
- `frontend/src/hooks/useOrientacion.test.js` - new file, first-ever coverage for the hook: 3 tests covering accepted-change marking, throttle-window suppression, and invalid-event suppression
- `frontend/src/utilidades/diagnosticoLatencias.js` - restored verbatim from Plan 01-01 (dependency, not new work in this plan's scope)
- `frontend/src/utilidades/diagnosticoLatencias.test.js` - restored verbatim from Plan 01-01 (dependency, not new work in this plan's scope)

## Decisions Made
- Placed both marks immediately adjacent to the state-committing call (`setPosition`/`setHeading`) so they observe exactly the "accepted" branch of each hook, matching the plan's `<behavior>` spec precisely
- Kept both marks unconditional inside their accepted branch (no extra guard) since `marcar()` itself already re-checks `import.meta.env.DEV` per call, per Plan 01-01's established pattern (T-01-02 mitigation reused, not reimplemented)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] Restored missing `diagnosticoLatencias.js` dependency from Plan 01-01**
- **Found during:** Pre-task setup, before Task 1
- **Issue:** This worktree's branch (`worktree-agent-a7911dab433f76411`) diverged from `main` before Plan 01-01's commits (which created `frontend/src/utilidades/diagnosticoLatencias.js`) existed on `PR3S1G4zZ/chore-multiagent-dev-station`. This plan's tasks both import from that module, so it was a hard blocker, not a style choice.
- **Fix:** Read the file verbatim via `git show "PR3S1G4zZ/chore-multiagent-dev-station:frontend/src/utilidades/diagnosticoLatencias.js"` (read-only reference, no branch merge/checkout) and wrote it into this worktree unchanged, along with its companion test file, per the same pattern the Plan 01-01 executor used for `.planning/` files in this same known-environment-issue scenario.
- **Files modified:** `frontend/src/utilidades/diagnosticoLatencias.js`, `frontend/src/utilidades/diagnosticoLatencias.test.js`
- **Verification:** `npx vitest run src/utilidades/diagnosticoLatencias.test.js` — 5/5 pass
- **Committed in:** `c7e55d5`

**2. [Rule 1 - test bug] Fixed test-isolation leak in the two new `useGeolocation.test.js` assertions**
- **Found during:** Task 1 GREEN verification
- **Issue:** `useGeolocation.test.js` does not unmount `renderHook` trees between tests (no `afterEach(cleanup)`). Running the two new mark-count assertions back-to-back with the rest of the suite caused a stray `performance.mark('gps:aceptado')` call from an earlier still-mounted hook instance to be recorded by a later test's fresh `vi.spyOn` (spies chain onto whatever `performance.mark` currently is, and calls flow through the chain). This produced an intermittent extra count unrelated to the fix under test in that specific assertion.
- **Fix:** Added `markSpy.mockClear()` immediately after mount confirmation (`await waitFor(() => expect(success).toBeTypeOf('function'))`) and before triggering the fix under test, in both new tests, so only marks produced by the action under test are counted. Scoped to the two new tests only — no change to the six pre-existing tests' behavior.
- **Files modified:** `frontend/src/hooks/useGeolocation.test.js`
- **Verification:** Ran the full file 3x consecutively (including isolated `-t` filtered runs) — stable 8/8 pass each time
- **Committed in:** `73acc2e` (part of Task 1's feat commit, alongside the implementation)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 - blocking dependency restore, 1 Rule 1 - test bug fix)
**Impact on plan:** Both were necessary to make the plan's own tasks executable and correctly verifiable in this isolated worktree. No scope creep — no production behavior beyond the two specified marks was touched.

## Issues Encountered
- Plan's Task 1 acceptance criteria mention "los 5 tests preexistentes" in `useGeolocation.test.js`; the file actually had 6 pre-existing tests at the time this plan ran (a minor documentation-vs-reality drift, not a blocker). All 6 pass unchanged, plus the 2 new tests, for 8/8 total.
- `frontend/node_modules` was absent in this fresh worktree; ran `npm install` before any test could execute (same environment-setup step the Plan 01-01 executor also needed, standard dependency install already declared in `package.json`, no new packages added).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `MARCAS.GPS_ACEPTADO` and `MARCAS.ORIENTACION_CAMBIO` are now live start marks, ready for Plan 01-04 to pair with their end marks (`marcador:render-inicio`/`camara:actualizada` and `flecha:render` respectively) in `InteractiveMap.jsx`
- No blockers. This plan is diagnosis-only per Fase 1 scope: `PRECISION_MAXIMA_M`, `EDAD_MAXIMA_EN_VIVO_MS`, `VELOCIDAD_MIN_MS`, `DESPLAZAMIENTO_MIN_M` (useGeolocation.js) and the ~100ms throttle (useOrientacion.js) were left unchanged, verified by the full existing test suites passing unmodified alongside the new assertions
- Full frontend test suite (`npx vitest run`, all 8 files) passes: 32/32, no regressions introduced by this plan's changes

## Self-Check: PASSED

All created/modified files found on disk: `frontend/src/hooks/useGeolocation.js`, `frontend/src/hooks/useGeolocation.test.js`, `frontend/src/hooks/useOrientacion.js`, `frontend/src/hooks/useOrientacion.test.js`, `frontend/src/utilidades/diagnosticoLatencias.js`, `frontend/src/utilidades/diagnosticoLatencias.test.js`. All 5 task/prerequisite commits (`c7e55d5`, `2749578`, `73acc2e`, `8035d81`, `e29d00c`) present in `git log`.
