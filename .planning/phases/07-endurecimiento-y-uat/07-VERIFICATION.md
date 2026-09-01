# Verificación local — Fase 7

**Fecha:** 2026-09-01  
**Worktree:** `phase-7-hardening` (rama `PR3S1G4zZ/phase-7-hardening`)  
**Producción:** no se cambió lógica de navegación. Excepción: ninguna.

## Comandos

| Área | Comando | Resultado |
|------|---------|-----------|
| Backend tests | `npm test` en `backend/` | **7 passed, 4 todo** |
| Frontend tests | `npm test` en `frontend/` | **44 passed, 11 todo**, 1 skipped file |
| Frontend lint | `npm run lint` en `frontend/` | **verde** |
| Frontend build | `npm run build` en `frontend/` | **verde** (warning de tamaño de chunk MapLibre, preexistente) |
| Backend lint | no hay script `lint` | N/A |

## Privacidad

Grep de artefactos de esta fase: sin tokens reales, sin recorridos de dispositivo. Coordenadas en tests = sintéticas (`6.171/-75.611` redondeadas o ecuador `0,0`). API key de test: `test-key`.

## Pendientes estructurales

- Fases 1–6 siguen incompletas en ROADMAP/STATE del milestone; Wake Lock y `startTime=now` no existen en código. Cubiertos con `it.todo`.
- HARDEN-02 UAT físico: checklist creado, filas en PENDIENTE.
- NAV-02 (flecha vs `enSeguimiento`) documentado por test de comportamiento actual + `it.todo`; **no se corrigió** (pertenece a Fase 2).

## CI

No se agregó GitHub Actions (D-05 / 07-CONTEXT.md).
