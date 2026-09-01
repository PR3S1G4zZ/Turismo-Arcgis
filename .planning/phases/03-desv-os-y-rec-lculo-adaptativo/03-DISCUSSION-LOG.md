# Phase 3: Desvíos y recálculo adaptativo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 3-Desvíos y recálculo adaptativo
**Areas discussed:** Evidencia GPS multi-señal, Confirmación temporal e histéresis, Estados y concurrencia del recálculo, Coste, límites y privacidad
**Mode:** `--auto` — opciones recomendadas seleccionadas automáticamente en una sola pasada

---

## Evidencia GPS multi-señal

| Option | Description | Selected |
|--------|-------------|----------|
| Combinar distancia, precisión, velocidad y dirección con degradación segura | Evalúa la geometría original, prioriza la calidad GPS y usa velocidad/dirección cuando están disponibles. | ✓ |
| Usar solo distancia | Repite el criterio actual y no filtra saltos con señales adicionales. | |
| Exigir todas las señales siempre | Rechaza lecturas cuando falta velocidad o rumbo, incluso si el navegador no los entrega. | |

**Auto-choice:** Combinar distancia, precisión, velocidad y dirección con degradación segura (recomendado).
**Notes:** La ausencia de una señal debe ser una condición explícita, no un rechazo o aceptación silenciosa.

---

## Confirmación temporal e histéresis

| Option | Description | Selected |
|--------|-------------|----------|
| Preservar la línea base, añadir histéresis y ajustar solo con evidencia | Documenta primero 45 m, 3 lecturas y 15 s; usa una frontera de salida menor y no añade espera tras confirmar. | ✓ |
| Reducir inmediatamente 3 lecturas/15 s | Cambia valores sensibles al coste sin demostrar qué ruido controlaban. | |
| Conservar exactamente los umbrales sin histéresis | Mantiene el riesgo de entrar/salir por ruido cerca del límite. | |

**Auto-choice:** Preservar la línea base, añadir histéresis y ajustar solo con evidencia (recomendado).
**Notes:** Los valores numéricos nuevos quedan sujetos al análisis y no se inventan durante la discusión.

---

## Estados y concurrencia del recálculo

| Option | Description | Selected |
|--------|-------------|----------|
| Latest-request-wins con cancelación cooperativa y guardas de generación | Identifica solicitudes, cancela cuando se pueda e ignora resultados obsoletos antes de mutar estado. | ✓ |
| Dejar que todas las respuestas apliquen en orden de llegada | Permite que una respuesta vieja reemplace una ruta más nueva. | |
| Bloquear cualquier nueva solicitud hasta completar la anterior | Evita concurrencia, pero puede ignorar un desvío confirmado más reciente. | |

**Auto-choice:** Latest-request-wins con cancelación cooperativa y guardas de generación (recomendado).
**Notes:** La separación observable es `desvío detectado` → `recálculo solicitado` → `ruta aplicada`.

---

## Coste, límites y privacidad

| Option | Description | Selected |
|--------|-------------|----------|
| Conservar límites y guardas de bucle sin retrasar la primera solicitud confirmada | Mantiene rate limiting, deduplicación y supresión de solicitudes en curso, pero no usa 15 s como espera artificial inicial. | ✓ |
| Priorizar respuesta inmediata y quitar todas las guardas | Aumenta el riesgo de bucles y peticiones facturables innecesarias. | |
| Conservar el temporizador de 15 s como requisito de toda solicitud | Mantiene un retardo artificial incompatible con el desvío confirmado responsivo. | |

**Auto-choice:** Conservar límites y guardas de bucle sin retrasar la primera solicitud confirmada (recomendado).
**Notes:** No se registran coordenadas, recorridos, tokens ni payloads reconstruibles; los tests usarán fixtures sintéticos.

---

## the agent's Discretion

- Nombres de helpers/refs, representación interna de estados y propagación de `AbortSignal`, sujetos a `03-CONTEXT.md`.
- Valores numéricos exactos de histéresis y tolerancias, sujetos a evidencia y al análisis del baseline.

## Deferred Ideas

Ninguna.
