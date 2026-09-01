# Phase 1: Diagnóstico e instrumentación - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 1-Diagnóstico e instrumentación
**Areas discussed:** Alcance de la auditoría PR#5, Formato de instrumentación

---

## Alcance de la auditoría PR#5 (scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Solo documental (Recomendado) | Leer los 5 commits de PR#5 + CONCERNS.md y mapear cada síntoma a qué commit lo cubre, sin reproducir en vivo | ✓ |
| Documental + reproducción en vivo | Además reproducir manualmente cada síntoma para confirmarlo en la práctica | |

**User's choice:** Solo documental (Recomendado)
**Notes:** Más rápido, apto para una fase de diagnóstico — no requiere correr la app para cada síntoma.

---

## Formato del entregable de la auditoría

| Option | Description | Selected |
|--------|-------------|----------|
| Tabla síntoma→commit→estado (Recomendado) | Tabla dentro del mismo informe de diagnóstico de Fase 1 | ✓ |
| Documento AUDIT.md independiente | Archivo separado solo para la auditoría | |

**User's choice:** Tabla síntoma→commit→estado (Recomendado)

---

## Síntoma no resuelto por PR#5

| Option | Description | Selected |
|--------|-------------|----------|
| Documentarlo para Fase 2+ (Recomendado) | Se registra como hallazgo con causa raíz hipotética; la corrección real queda para la fase correspondiente | ✓ |
| Investigar la causa raíz ahora | Se profundiza de inmediato en Fase 1, aunque cruce el alcance de instrumentación | |

**User's choice:** Documentarlo para Fase 2+ (Recomendado)
**Notes:** Fase 1 es diagnóstico, no arreglo — mantiene el alcance de la fase limpio.

---

## Mecanismo de instrumentación

| Option | Description | Selected |
|--------|-------------|----------|
| performance.mark/measure a consola (Recomendado) | API estándar del navegador, cero UI nueva, solo dev (`import.meta.env.DEV`) | ✓ |
| HUD visual temporal en pantalla | Panel flotante con latencias en vivo, más visible en el celular real pero código nuevo a quitar después | |
| Log estructurado descargable (JSON) | Mediciones acumuladas en memoria, exportables a JSON | |

**User's choice:** performance.mark/measure a consola (Recomendado)

---

## Claude's Discretion

- Puntos exactos de instrumentación (`useGeolocation.js`, `useOrientacion.js`, `useNavegacion.js`, `InteractiveMap.jsx`) para cubrir los 6 tramos de latencia pedidos.
- Mecanismo concreto para coordinar la medición en dispositivo físico (build + instrucciones) — el usuario ejecuta y reporta resultados, pero el "cómo" del build/instrucciones queda a criterio del plan de Fase 1.

## Deferred Ideas

- "Medición en dispositivo físico" (cómo coordinar exactamente la captura en Android/iPhone reales) — no discutida a fondo, se deja como decisión abierta para `gsd-plan-phase 1`.
- "Límite de esta fase" (si se permiten micro-fixes triviales durante el diagnóstico) — no discutida a fondo, se deja como decisión abierta para `gsd-plan-phase 1`.
