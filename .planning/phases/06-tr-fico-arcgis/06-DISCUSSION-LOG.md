# Phase 6: Tráfico ArcGIS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 6-Tráfico ArcGIS
**Areas discussed (modo --auto, sin AskUserQuestion):** Contrato de respuesta normalizada, Degradación sin cobertura, Alcance de la Parte B, Umbral de evidencia para Parte A

---

## Contrato de respuesta normalizada (Parte A)

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Agregar campos `traficoSolicitado`/`traficoAplicado` aditivos | Extiende el contrato existente sin romper consumidores actuales | ✓ |
| Reemplazar `fuente` por un objeto más rico | Rompería `frontend/src/utilidades/api.js` y `RouteModal.jsx` sin necesidad | |
| No exponer nada, solo loguear en backend | No cumple el success criteria del ROADMAP ("la respuesta normalizada indica si se solicitó/estuvo disponible tráfico") | |

**Selección automática:** Campos aditivos `traficoSolicitado`/`traficoAplicado` (nombres sugeridos, no finales) — opción recomendada por preservar compatibilidad.
**Notas:** Solo aplica a modo `car`; modo `walk` nunca reporta tráfico solicitado, conforme al requisito explícito del ROADMAP.

---

## Degradación sin cobertura (Parte A)

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Degradación explícita (`traficoAplicado: false`) | Sin fallos silenciosos, visible en la respuesta | ✓ |
| Fallar la ruta completa si no hay tráfico | Rompería la navegación por una mejora opcional — inaceptable |  |
| Simular una mejora aunque no se aplicó tráfico real | Engañoso, contradice el requisito de "degradación clara" | |

**Selección automática:** Degradación explícita, incluyendo el caso de caída a OSRM (`fuente: 'osrm'`, `traficoAplicado: false`).
**Notas:** Reutiliza el flujo de fallback ya existente en `resolverRutaArcgis()`, no crea un camino paralelo.

---

## Alcance de la Parte B en esta fase

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Investigación documentada primero, implementación condicionada a evidencia | Coincide con `Research: yes` del ROADMAP y con la regla dura de no asumir migración de SDK | ✓ |
| Implementar directamente un prototipo de capa visual sin investigar cobertura/costo primero | Contradice el mandato explícito de investigación previa | |
| Descartar la Parte B completamente sin investigar | Ignoraría TRAFFIC-02 como requisito activo | |

**Selección automática:** Investigación primero; prototipo de UI solo si la evidencia lo soporta, siempre detrás de feature flag apagado por defecto.
**Notas:** La migración al ArcGIS Maps SDK, si resultara necesaria, se documenta como hallazgo para ADR futuro — nunca como tarea del plan de esta fase.

---

## Umbral de evidencia para Parte A

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Confirmar parámetros reales contra documentación oficial de ArcGIS antes de implementar | Evita inventar nombres de parámetros (`travelMode.impedanceAttributeName`, `startTime`, etc.), como exige `AGENT_INSTRUCTIONS.md` | ✓ |
| Implementar `startTime=now` a ciegas asumiendo que el modo "Driving Time" ya soporta tráfico | Riesgo de romper el ruteo o de una mejora inexistente sin evidencia | |
| No investigar y dejar el requisito TRAFFIC-01 sin abordar | Incumple el requisito activo | |

**Selección automática:** Investigación documental contra fuentes oficiales antes de comprometer implementación; si la evidencia es negativa/inconclusa, el plan implementa solo la infraestructura de reporte de tráfico (D-01 a D-04) sin asumir mejora real.
**Notas:** `elegirModo()`/`obtenerModos()` en `arcgisRouting.js` ya traen el JSON completo de cada `travelMode` — la investigación debe inspeccionarlo, no solo el nombre.

---

## Claude's Discretion

- Nombres finales de los campos nuevos de tráfico en la respuesta normalizada.
- Mecanismo concreto de feature flag para la Parte B (env var backend vs. config vs. flag de frontend).

## Deferred Ideas

- TRAFFIC-03 (tráfico peatonal) y TRAFFIC-04 (restricciones por vehículo) — v2 Requirements, no tocados en esta fase.
- Migración al ArcGIS Maps SDK for JavaScript — fuera de alcance de esta fase y de esta sesión delegada; requiere ADR + aprobación humana separados.
