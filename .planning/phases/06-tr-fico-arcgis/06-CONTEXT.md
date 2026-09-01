# Phase 6: Tráfico ArcGIS - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Parte A (ruteo sensible al tráfico): solo para modo automóvil, verificar el uso de `TravelTime` y evaluar `startTime=now` donde haya disponibilidad real de tráfico en vivo, manteniendo el modo peatonal sin tráfico. Parte B (capa visual): investigar el ArcGIS Traffic Map Service (velocidades, congestión, incidentes, cierres) detrás de un feature flag. Esta fase requiere investigación previa obligatoria (`Research: yes` en ROADMAP.md) porque hay incertidumbre real sobre cobertura, costo y viabilidad del tráfico ArcGIS en Itagüí/Colombia antes de comprometer implementación. Si mostrar la capa visual exige migrar al ArcGIS Maps SDK, esa migración queda explícitamente fuera de alcance — a lo sumo se documenta como hallazgo para un ADR + aprobación humana separados, nunca como tarea del plan.

</domain>

<decisions>
## Implementation Decisions

Esta sesión corrió en modo `--auto` (sin interacción del usuario) como cliente escritor delegado con alcance estricto fijado por `AGENT_INSTRUCTIONS.md` del worktree. Las decisiones siguientes son las opciones recomendadas seleccionadas automáticamente; quedan documentadas para que el investigador y el planner las apliquen sin volver a preguntar.

### Contrato de respuesta normalizada (Parte A)
- **D-01:** La respuesta normalizada de `/api/rutas/resolver` agrega campos explícitos sobre tráfico — algo equivalente a `traficoSolicitado` (bool: se pidió tráfico para esta ruta) y `traficoAplicado` (bool: ArcGIS efectivamente lo usó) — sin romper el contrato existente (`fuente`, `puntos`, `pasos`, `distanciaM`, `duracionMin` se mantienen). — **Reversibility:** costly — el contrato de `/api/rutas/resolver` ya lo consume `frontend/src/utilidades/api.js` y `RouteModal.jsx`; cambiar los nombres de campo después de implementados exige tocar ambos lados y cualquier caché del cliente.
- **D-02:** `traficoSolicitado` solo puede ser `true` cuando `modo === 'car'` y el proveedor activo es ArcGIS; en modo `walk` siempre es `false`/ausente, preservando el requisito explícito de que el modo peatonal permanece sin tráfico.

### Degradación sin cobertura (Parte A)
- **D-03:** Si ArcGIS no soporta o no aplica tráfico para la ruta solicitada (sin cobertura, sin permiso, o el `travelMode` de auto no tiene impedancia de tráfico configurada), la respuesta debe indicarlo explícitamente (`traficoAplicado: false`) en vez de fallar silenciosamente o simular una mejora inexistente.
- **D-04:** Si ArcGIS falla y el sistema cae a OSRM en modo auto, la respuesta reporta `fuente: 'osrm'` y `traficoAplicado: false` (OSRM no tiene tráfico) — la degradación existente proveedor-a-proveedor no cambia, solo se le suma la señal de tráfico.

### Alcance de la Parte B en esta fase
- **D-05:** La Parte B (capa visual de tráfico) es investigación documentada primero — el plan de esta fase NO debe asumir que se implementa código de capa visual salvo que RESEARCH.md aporte evidencia concreta de viabilidad sin migrar de SDK (compatibilidad razonable del Traffic Map Service con MapLibre GL, costo/cuota aceptable, cobertura real en Itagüí). Si la investigación no confirma viabilidad, el plan documenta el hallazgo y dimensiona un feature flag deshabilitado por defecto (o directamente no implementa nada de UI), pero nunca ejecuta la migración de SDK.
- **D-06:** Cualquier prototipo de capa visual que sí se implemente en esta fase debe vivir detrás de un feature flag apagado por defecto (variable de entorno o config, siguiendo el patrón ya usado en el proyecto para toggles de backend/frontend), de forma que no afecte a los usuarios del portal sin activación explícita.

### Umbral de evidencia para Parte A
- **D-07:** No se implementa `startTime=now`/impedancia de tráfico a ciegas — primero la investigación debe confirmar contra documentación oficial de ArcGIS Location Platform: (a) qué parámetro real activa tráfico en vivo (`travelMode.impedanceAttributeName` con `TrafficTime`/`TravelTime`, `startTime`, u otro nombre exacto — no inventar), (b) si el modo "Driving Time" que ya se consulta vía `elegirModo()` en `arcgisRouting.js` lo soporta out-of-the-box o requiere un travelMode distinto, y (c) si tiene costo/cuota diferenciado de las 20.000 rutas gratis/mes. Si la evidencia es positiva, el plan implementa el parámetro condicionado a modo auto; si es negativa o inconclusa, el plan implementa solo la infraestructura de reporte (D-01 a D-04) sin asumir mejora real de tráfico, documentando la limitación.

### Claude's Discretion
- El nombre exacto de los campos nuevos en la respuesta normalizada (`traficoSolicitado`/`traficoAplicado` son sugerencias, no nombres finales) queda a criterio del plan, siempre que preserve la semántica de D-01/D-02 y el estilo camelCase en español del resto del contrato.
- El mecanismo concreto de feature flag para la Parte B (env var backend, config JSON, flag en frontend) queda a criterio del plan — debe seguir un patrón ya usado en el proyecto si existe uno equivalente, o el más simple consistente con el resto del stack si no.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto del milestone
- `.planning/PROJECT.md` — constraints (proveedor ArcGIS principal, no migrar SDK sin ADR, costos, privacidad), contexto y decisiones clave del milestone
- `.planning/REQUIREMENTS.md` §Tráfico ArcGIS (TRAFFIC) — TRAFFIC-01, TRAFFIC-02, y TRAFFIC-03/04 en v2 Requirements (diferidos, fuera de alcance de esta fase)
- `.planning/ROADMAP.md` §Phase 6 — goal, success criteria y nota `Research: yes` de esta fase
- `AGENT_INSTRUCTIONS.md` (raíz del worktree) — brief de delegación con la regla dura de no-migración de SDK, alcance estricto de la sesión (solo discuss+plan+research, sin execute-phase) y los parámetros de ArcGIS a verificar

### Código de ruteo actual
- `backend/src/utils/arcgisRouting.js` — cliente ArcGIS World Route; `elegirModo()` (líneas 156-171) y `solve()` (líneas 248-270) son el punto de anclaje para agregar `startTime`/impedancia de tráfico; `normalizar()` (líneas 179-206) es donde se agregarían los campos nuevos de la respuesta
- `frontend/DOCUMENTACION_RUTAS.md` §"Parámetros del servicio de ArcGIS" y §"Costos" — tabla de parámetros ya en uso, contrato actual de `/api/rutas/resolver`, y cifras de costo conocidas (20.000 rutas gratis/mes, USD 0,50/1.000 adicionales)
- `.planning/codebase/INTEGRATIONS.md` §"Routing & Navigation" — confirma que no hay tráfico ni capa visual implementados hoy (trabajo nuevo, no bug)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `obtenerModos()` y `elegirModo()` en `arcgisRouting.js` — ya consultan y cachean 6h los `travelMode` reales de la organización desde `NAServer`/`GetTravelModes`; la investigación debe inspeccionar el JSON completo de cada modo (no solo el nombre) para ver si trae `impedanceAttributeName` u otro campo relacionado con tráfico
- `hayArcgis()` — ya expone si hay credenciales ArcGIS configuradas; útil para decidir si tiene sentido intentar tráfico o degradar directo
- `resolverRutaArcgis()` — ya maneja el patrón de reintento/fallback a OSRM; el reporte de degradación de tráfico debe integrarse en este flujo existente, no crear uno paralelo

### Established Patterns
- Comentarios explican el "por qué" de cada parámetro no obvio (ver bloque de comentarios sobre `travelMode` líneas 82-85 y `cabeceras()` líneas 90-94) — cualquier parámetro nuevo de tráfico debe documentarse igual
- La respuesta normalizada usa spread/objeto plano en español (`fuente`, `puntos`, `pasos`, `distanciaM`, `duracionMin`) — los campos nuevos deben seguir la misma convención de nombres

### Integration Points
- `backend/src/routes/routing.js` (no leído en detalle esta sesión, pero es el router que expone `POST /api/rutas/resolver` y `GET /api/rutas/estado`) — punto donde la respuesta normalizada llega al frontend
- `frontend/src/utilidades/api.js` y `frontend/src/componentes/detalle/RouteModal.jsx` — consumidores actuales del contrato de `/api/rutas/resolver`; cualquier campo nuevo debe ser aditivo para no romperlos hasta que se actualicen explícitamente

</code_context>

<specifics>
## Specific Ideas

No specific requirements — sesión en modo `--auto` sin interacción del usuario. El worktree padre (coordinador del milestone) es quien decide cuándo autorizar la ejecución real de esta fase; esta sesión produce solo artefactos de planificación (incluyendo RESEARCH.md).

</specifics>

<deferred>
## Deferred Ideas

- TRAFFIC-03 (tráfico en vivo para modo peatonal) y TRAFFIC-04 (restricciones por vehículo vía `travelMode`) están explícitamente en v2 Requirements — no se discuten ni se planifican en esta fase.
- La migración al ArcGIS Maps SDK for JavaScript, si la investigación de la Parte B concluye que es necesaria para mostrar la capa visual, se documenta como hallazgo pero NO se agenda como tarea — requiere ADR + comparación técnica + aprobación humana separados, fuera del alcance de este plan y de esta sesión delegada.

### Reviewed Todos (not folded)
None — `todo.match-phase 6` no encontró coincidencias (`todo_count: 0`).

</deferred>

---

*Phase: 6-Tráfico ArcGIS*
*Context gathered: 2026-09-01*
