# Phase 2: Flecha, rumbo y cámara desacoplados - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 2-Flecha, rumbo y cámara desacoplados
**Areas discussed:** Propiedad de los estados, Precedencia de fuentes de rumbo, Flecha relativa al viewport y gesto de cámara, Suavizado/listeners/latencia

---

## Propiedad de los estados

| Option | Description | Selected |
|--------|-------------|----------|
| Separar señales crudas y derivadas por responsabilidad | GPS conserva posición/rumbo de movimiento; orientación conserva brújula/permiso; navegación conserva ruta/progreso; mapa conserva cámara y flecha. | ✓ |
| Unificar todos los valores en un único estado | Un contrato central único mezcla señales de sensores, ruta y cámara. | |
| Dejar la separación implícita | Mantenerla distribuida en los booleanos y campos actuales sin explicitar el modelo. | |

**User's choice:** `[auto]` Separar señales crudas y derivadas por responsabilidad (recommended default).
**Notes:** `siguiendo` solo representa seguimiento de cámara; no debe detener GPS, progreso, recálculo ni orientación.

## Precedencia de fuentes de rumbo

| Option | Description | Selected |
|--------|-------------|----------|
| Movimiento GPS/deducido, detenido brújula autorizada, luego tangente de ruta | Prioriza movimiento real; usa brújula fresca a baja velocidad; degrada a geometría local compartida. | ✓ |
| Brújula siempre que exista | Usa orientación física incluso mientras el usuario se desplaza. | |
| Usar siempre GPS y conservar la última lectura | No cambia a brújula al detenerse y puede retener un rumbo obsoleto. | |

**User's choice:** `[auto]` Movimiento GPS/deducido, detenido brújula autorizada, luego tangente de ruta (recommended default).
**Notes:** La orientación permanece independiente de la cámara y de la acción "Centrar en mí".

## Flecha relativa al viewport y gesto de cámara

| Option | Description | Selected |
|--------|-------------|----------|
| Flecha relativa al bearing del viewport y seguimiento exclusivamente para la cámara | Calcula rumbo menos bearing del mapa; al pausar, el mapa se queda visible pero la flecha sigue viva. | ✓ |
| Congelar la flecha mientras la cámara está pausada | Vincula la salida de orientación al estado de seguimiento. | |
| Usar siempre el rumbo absoluto | Ignora la rotación actual del viewport y puede desalinear la flecha visual. | |

**User's choice:** `[auto]` Flecha relativa al bearing del viewport y seguimiento exclusivamente para la cámara (recommended default).
**Notes:** Corrige el hallazgo de `InteractiveMap.jsx` ~354-360 y deja que recentrar reactive solo la cámara.

## Suavizado, listeners y latencia

| Option | Description | Selected |
|--------|-------------|----------|
| Suavizado circular existente, listeners estables/limpios y actualizaciones acotadas sin retraso artificial | Reutiliza seno/coseno para 359°→0°, evita duplicados y usa métricas dev-only de Fase 1. | ✓ |
| Promedio lineal y suscripción nueva en cada render | Puede oscilar en el cruce norte y acumular listeners. | |
| Debounce agresivo | Reduce renders a costa de superar las metas de latencia. | |

**User's choice:** `[auto]` Suavizado circular existente, listeners estables/limpios y actualizaciones acotadas sin retraso artificial (recommended default).
**Notes:** Se mantiene la compatibilidad de eventos de orientación solo si no se procesan duplicados; cleanup simétrico al desmontar.

## the agent's Discretion

- Forma concreta del view model derivado y ubicación exacta de helpers/hook auxiliar.
- Umbral de baja velocidad, frescura de brújula y ritmo de actualización, sujetos a evidencia de Fase 1 y a p95.
- Mecanismo mínimo de deduplicación compatible con Android Chrome e iPhone Safari.

## Deferred Ideas

None. Desvíos/recálculo, geometría, Wake Lock, tráfico, endurecimiento general y UAT físico quedan en sus fases del roadmap.

