---
phase: 3
slug: desv-os-y-rec-lculo-adaptativo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 3 — Validation Strategy

> Contrato de validación por fase para comprobar detección de desvíos y recálculo sin datos personales.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 + Testing Library para frontend |
| **Config file** | `frontend/vitest.config.js` |
| **Quick run command** | `npm run test -- --run frontend/src/hooks/useNavegacion.test.js` (desde `frontend/`) |
| **Full suite command** | `npm run test -- --run` (desde `frontend/`) |
| **Estimated runtime** | ~10 segundos |

---

## Sampling Rate

- **After every task commit:** Ejecutar `npm run test -- --run frontend/src/hooks/useNavegacion.test.js` desde `frontend/`.
- **After every plan wave:** Ejecutar `npm run test -- --run` desde `frontend/`.
- **Before `$gsd-verify-work`:** La suite completa debe estar verde.
- **Max feedback latency:** 30 segundos.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RECALC-01 | T-03-01 / — | Fixtures sin coordenadas personales ni tokens | unit | `npm run test -- --run src/hooks/useNavegacion.test.js` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | RECALC-01 | T-03-01 / — | Un salto aislado no solicita ruta | unit | `npm run test -- --run src/hooks/useNavegacion.test.js` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | RECALC-02 | T-03-02 / — | Respuesta obsoleta no aplica ruta ni estado | integration | `npm run test -- --run src/hooks/useNavegacion.test.js` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | RECALC-01, RECALC-02 | T-03-01 / — | Rate limit/guardas de bucle y estados diferenciados permanecen comprobables | integration | `npm run test -- --run src/hooks/useNavegacion.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the phase requirements; `frontend/src/hooks/useNavegacion.test.js` ya existe y será ampliado con fixtures sintéticos.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirmar que la decisión de umbrales representa el ruido real del dispositivo sin registrar coordenadas | RECALC-01 | La calibración del sensor/plataforma no puede demostrarse completamente en jsdom | Ejecutar una sesión controlada en el entorno autorizado, registrar solo conteos/tiempos y revisar que no se exporten coordenadas, recorridos o tokens. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
