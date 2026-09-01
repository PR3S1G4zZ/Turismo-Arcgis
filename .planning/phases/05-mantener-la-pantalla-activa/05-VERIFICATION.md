---
phase: 05-mantener-la-pantalla-activa
status: passed
verified: 2026-09-01T15:40:00Z
verifier: codex-inline
---

# Phase 5 Verification

## Goal

Hook/servicio aislado que usa la Screen Wake Lock API para mantener la pantalla
encendida durante la navegación activa, con liberación correcta, reintento tras
volver de segundo plano y degradación segura sin soporte del navegador.

## Requirement Traceability

| Requirement | Result | Evidence |
|---|---|---|
| WAKE-01 | PASS | `useNavegacion` derives demand only from `calculando`/`navegando`; `useWakeLock` calls `request('screen')`, releases on deactivation/unmount, recovers on visibility and exposes non-fatal status. |

## Must-Haves

| Must-have | Result | Evidence |
|---|---|---|
| Solicitud solo en navegación real; previews no consumen Wake Lock | PASS | `frontend/src/hooks/useNavegacion.test.js` verifies a real route exposes active demand and the simulated/manual preview keeps every demand false. |
| Release on completion/cancel/error/unmount and late-promise safety | PASS | State demand turns false for existing navigation terminal states; `useWakeLock.test.js` verifies deactivation, unmount and a late resolved sentinel being released without reactivation. |
| Visibility recovery and system release detection without duplicates | PASS | `useWakeLock.test.js` emits sentinel `release`, checks observable `liberado`, ignores hidden visibility and accepts one request after two visible events. |
| Safe degradation | PASS | Unsupported API and rejected `request()` produce non-fatal states with `necesitaAviso`, without exposing technical error text or touching GPS/routing flow. |
| Discreet UI communication | PASS | `RouteModal.jsx` conditionally renders the approved Spanish copy with `route-gps-status--warn`, `RiErrorWarningLine` and `role="status"` only outside preview tracking. |
| No hidden media fallback or unrelated scope changes | PASS | Search/diff review shows no Wake Lock media fallback; `useGeolocation.js` and `useOrientacion.js` have no changes in this phase, and the map/provider/backend are untouched. |

## Automated Verification

- `npx vitest run src/hooks/useWakeLock.test.js src/hooks/useNavegacion.test.js`: PASS, 2 files / 10 tests.
- `npx vitest run`: PASS, 9 files / 40 tests.
- `npm run lint`: PASS.
- `npm run build`: PASS. Vite reports only the existing large-chunk advisory (>500 kB).
- `git diff --check`: PASS.

La comprobación posterior al hardening de `release` repitió la suite específica
(10/10), la suite completa (40/40), lint, build y `git diff --check`; todos
permanecen en PASS.

## Human Verification

None required for the automated phase gate. Physical Android Chrome/iPhone Safari
validation remains part of Phase 7 UAT.

## Verdict

**PASSED — 6/6 must-haves verified and WAKE-01 accounted for.**
