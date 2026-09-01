# Phase 7: Endurecimiento y UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 7-Endurecimiento y UAT
**Areas discussed:** Cobertura ante fases no implementadas, Framework de testing backend, Registro de UAT físico, Alcance de build+lint+tests en verde
**Mode:** `--auto` (sin interacción; Claude seleccionó la opción recomendada en cada pregunta)

---

## Cobertura de pruebas ante fases no implementadas (WAKE-01, TRAFFIC-01, NAV/RECALC/GEOM)

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Tests reales contra código existente + placeholders explícitos para lo que falta | Prioriza lo que ya existe (`geoRuta.js`, `useNavegacion.js`), marca con `it.todo`/sección "Pendiente de Fase N" lo que depende de código no implementado | ✓ |
| (b) Esqueleto/checklist sin tests concretos | Evita tests contra código inexistente pero entrega menos valor incremental | |

**Selección:** (a) — recomendado por dar valor real hoy sin fingir cobertura falsa.
**Notas:** [auto] Cobertura de pruebas — Q: "¿Escribir tests reales + placeholders o solo checklist?" → Selected: "Tests reales + placeholders explícitos" (recomendado). Se documenta explícitamente en CONTEXT.md que el plan requerirá replan cuando Fases 1-6 tengan implementación concreta (Fases 1-6 = "Not started" en STATE.md/ROADMAP.md al momento de esta discusión).

---

## Framework de testing backend (HARDEN-01 exige contract tests de `startTime=now`)

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest | Mismo runner que frontend, API-compatible con Jest, sin dependencia nueva | ✓ |
| Jest | Estándar de facto en Node, pero introduce un segundo runner en el repo | |

**Selección:** Vitest.
**Notas:** [auto] Framework backend — Q: "¿Vitest o Jest para contract tests de backend?" → Selected: "Vitest" (recomendado, consistencia con frontend).

---

## Registro de UAT físico sin coordenadas

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist estructurado en Markdown (tabla escenario × dispositivo × resultado × notas) | Auditable, ligado directamente a Success Criteria de HARDEN-02, sin campos libres que puedan filtrar coordenadas | ✓ |
| Bitácora de formato libre | Más flexible pero mayor riesgo de que alguien pegue coordenadas u otro dato sensible sin querer | |

**Selección:** Checklist estructurado.
**Notas:** [auto] Registro UAT — Q: "¿Checklist estructurado o bitácora libre?" → Selected: "Checklist estructurado" (recomendado por privacidad y auditabilidad).

---

## Alcance de "build+lint+tests en verde"

| Option | Description | Selected |
|--------|-------------|----------|
| Verificación manual local (comandos documentados) | Ya cubre el Success Criteria de la fase; no agrega infraestructura nueva | ✓ |
| Agregar CI (GitHub Actions) en esta fase | Automatiza el chequeo pero no está pedido por el roadmap — scope creep de infraestructura | |

**Selección:** Verificación manual local.
**Notas:** [auto] Alcance CI — Q: "¿Agregar CI ahora o solo verificar localmente?" → Selected: "Verificación manual local" (recomendado; CI se anota como idea diferida).

---

## Claude's Discretion

- Estructura exacta de archivos de test nuevos y ubicación del checklist UAT.
- Mecanismo exacto de placeholders "pendiente de Fase N" (`it.todo`, `it.skip`, sección separada).

## Deferred Ideas

- Agregar CI (GitHub Actions) para build+lint+test automático — futura fase/milestone de DevOps.
- Cobertura de tests para AdminDashboard/PQRS y otras áreas fuera de navegación — fuera de alcance de HARDEN-01/HARDEN-02.
