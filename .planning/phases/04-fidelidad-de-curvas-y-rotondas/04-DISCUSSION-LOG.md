# Phase 4: Fidelidad de curvas y rotondas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves las alternativas consideradas.

**Date:** 2026-09-01
**Phase:** 4-Fidelidad de curvas y rotondas
**Areas discussed:** Captura de la ruta real, Formato de comparación de las 5 etapas, Selección de la rotonda/curva de prueba, Alcance de la mejora de representación (condicional)

**Modo:** `--auto` — sin interacción con el usuario; para cada pregunta se seleccionó la opción recomendada (marcada ✓) y se registró el razonamiento.

---

## Captura de la ruta real

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Captura manual por el dueño del milestone (script/instrumentación dev-only + checkpoint humano, mismo patrón de Fase 1) | Requiere golpear ArcGIS/OSRM real para una rotonda real; no automatizable desde este entorno | ✓ |
| Simular la respuesta de ArcGIS con datos sintéticos | No cumple GEOM-01 ("ruta problemática real"); no habría evidencia real de fidelidad geométrica | |

**Selección:** Captura manual, paso `autonomous: false` en el plan.
**Notas:** El origen/destino deben ser coordenadas de sitios turísticos ya públicos en la BD, nunca la ubicación GPS real de una persona (constraint de privacidad del milestone).

---

## Formato de comparación de las 5 etapas

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Tabla (etapa → vértices → fuente → observaciones) + overlay visual, en informe dedicado | Documental, sin tocar producción, reutilizable como evidencia auditable | ✓ |
| HUD visual nuevo en la app para comparar etapas en vivo | Añade código de producción nueva no pedida por el success criteria; fuera del alcance de una fase de solo-diagnóstico | |

**Selección:** Tabla + overlay visual en `04-COMPARACION-GEOMETRIA.md`.
**Notas:** Mismo criterio que Fase 1 usó `performance.mark()` dev-only en vez de un HUD nuevo.

---

## Selección de la rotonda/curva de prueba

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| El plan sugiere 1-2 candidatas; el dueño del milestone confirma cuál usar al ejecutar | Claude no puede verificar en campo qué rotonda es representativa del síntoma reportado | ✓ |
| Claude elige una rotonda específica de antemano sin validación humana | Riesgo de elegir una ubicación no representativa o inexistente | |

**Selección:** Sugerencia + confirmación humana en el paso de ejecución.

---

## Alcance de la mejora de representación (condicional)

| Opción | Descripción | Seleccionada |
|--------|-------------|--------------|
| Solo documentar la decisión de diseño (densificación puramente visual, nunca sobre `ruta.puntos`); implementación queda para fase/plan posterior | Fase 4 es de planificación/diagnóstico, no ejecuta cambios de renderizado en este cliente | ✓ |
| Implementar la densificación visual ya en esta fase si se detecta escasez | Excede el alcance estricto de este cliente delegado (solo discuss+plan, sin ejecución) | |

**Selección:** Documentar la decisión de diseño; no implementar.
**Notas:** Reversibility one-way si se mezclara geometría visual con la lógica de map matching — debe quedar en una capa de render separada.

---

## Claude's Discretion

- Formato exacto del archivo JSON de captura, nombres de archivo y estructura del directorio `captura/`.
- Cómo instrumentar temporalmente `arcgisRouting.js`/`osrmRouting.js`/`InteractiveMap.jsx` para exponer cada etapa sin alterar su comportamiento en producción.

## Deferred Ideas

- Implementación real de densificación visual o ajustes de casing/ancho/opacidad/zoom — condicionada a evidencia de esta misma captura; se ejecuta en una fase/plan de implementación posterior.
