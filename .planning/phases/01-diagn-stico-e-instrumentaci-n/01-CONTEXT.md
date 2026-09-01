# Phase 1: Diagnóstico e instrumentación - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Ubicar exactamente dónde se origina el retraso percibido de navegación (~3 s) y auditar qué de los síntomas reportados ya quedó resuelto por el ciclo previo mergeado (`codex/map-navigation-reliability`, PR #5) antes de instrumentar o re-diagnosticar desde cero. Esta fase es puramente diagnóstica: produce un informe (tabla de latencias + causa raíz + auditoría de PR #5) e instrumentación dev-only. No corrige el comportamiento de navegación en producción — esa corrección vive en las fases NAV/RECALC/GEOM (2, 3, 4).

</domain>

<decisions>
## Implementation Decisions

### Auditoría de PR #5
- **D-01:** La auditoría es solo documental — leer los 5 commits de `codex/map-navigation-reliability` (`fix: make GPS navigation state trustworthy`, `fix: remove GPS navigation lag`, `fix: stabilize map camera lifecycle`, `fix: preserve bearing without GPS heading`, `fix: clarify stale GPS route status`) más `.planning/codebase/CONCERNS.md` (que ya documenta 3 de estos fixes bajo "Known Bugs — Recently Fixed") y mapear cada síntoma del brief original a qué commit lo cubre, sin reproducir los síntomas en vivo en esta fase.
- **D-02:** El entregable de la auditoría es una tabla síntoma→commit→estado (resuelto/parcial/pendiente), incluida dentro del mismo informe de diagnóstico de Fase 1 — no un archivo `AUDIT.md` separado.
- **D-03:** Si la auditoría encuentra un síntoma que PR #5 NO resolvió, se documenta como hallazgo con causa raíz hipotética en el informe de Fase 1, pero la corrección real se deja para la fase correspondiente (NAV/RECALC/GEOM según el síntoma) — Fase 1 diagnostica, no corrige.

### Instrumentación
- **D-04:** El mecanismo de medición de las 6 latencias internas es `performance.mark()`/`performance.measure()` (API estándar del navegador), activado solo en desarrollo (`import.meta.env.DEV`), leído vía DevTools o el panel de Performance — sin HUD visual nuevo ni logging estructurado a JSON. — **Reversibility:** reversible — es instrumentación dev-only, se puede quitar o cambiar de mecanismo sin afectar producción ni otros artefactos.

### Claude's Discretion
- Cómo exactamente insertar los `performance.mark()` en `useGeolocation.js`, `useOrientacion.js`, `useNavegacion.js` e `InteractiveMap.jsx` para cubrir los 6 tramos pedidos (GPS→marcador, orientación→flecha, GPS→cámara, desvío→solicitud, solicitud→respuesta ArcGIS, respuesta→ruta renderizada) queda a criterio de implementación, siempre que no registre coordenadas.
- Cómo coordinar la medición en dispositivo físico (Android/iPhone reales, ya disponibles según el usuario) no se discutió a fondo en esta sesión — el plan de Fase 1 debe proponer un mecanismo concreto (build + instrucciones de captura) y el usuario ejecuta la medición y reporta resultados.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto del milestone
- `.planning/PROJECT.md` — contexto completo, constraints, decisiones clave
- `.planning/REQUIREMENTS.md` — DIAG-01, DIAG-02 (requirements de esta fase)
- `.planning/ROADMAP.md` §Phase 1 — goal y success criteria de esta fase

### Mapa de código
- `.planning/codebase/CONCERNS.md` — sección "Known Bugs" documenta 3 fixes de PR#5 ya identificados independientemente; sección "Fragile Areas" (Route Deviation and Recalculation Logic) y "Performance Bottlenecks" (Synchronous GPS Route Projection, sin debounce ni Web Worker) son candidatos directos a causa raíz del retraso percibido
- `.planning/codebase/ARCHITECTURE.md` §Anti-Patterns "Duplicate Route Projection Logic" — lógica de proyección geométrica duplicada entre `InteractiveMap.jsx` y `geoRuta.js`, relevante al medir dónde se calcula cada latencia

### Historial relevante (PR #5, ya mergeado a main)
- Commits: `8f15dd1` (fix: make GPS navigation state trustworthy), `4cdc635` (fix: remove GPS navigation lag), `6673f72` (fix: stabilize map camera lifecycle), `bc7b8ad` (fix: preserve bearing without GPS heading), `9bb67ef` (fix: clarify stale GPS route status)
- `677a933` (fix: no adelantar el progreso de ruta cuando esta pasa cerca de si misma) — fix adicional ya en `main`, posterior a PR#5

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/hooks/useGeolocation.js` — ya expone `ultimaActualizacion` (timestamp de la última lectura aceptada) y `gpsConfiable`; buen punto de anclaje para el mark "GPS aceptado"
- `frontend/src/hooks/useNavegacion.js` — el bucle de seguimiento (líneas ~197-257) ya tiene los puntos de entrada exactos para instrumentar desvío→recálculo y solicitud→respuesta (dentro de `calcular()`)
- `frontend/src/componentes/detalle/InteractiveMap.jsx` — el efecto de cámara (líneas ~286-298) y `usePosicionAnimada` (líneas ~73-113) son los puntos de anclaje para GPS→cámara y la interpolación visual del marcador

### Established Patterns
- El proyecto ya sigue una convención de comentarios explicando el "por qué" de cada umbral (ver `useNavegacion.js` líneas 23-32) — la instrumentación nueva debería mantener ese estilo, no solo código sin explicar
- Los hooks existentes usan refs (`useRef`) para valores que no deben re-suscribir efectos — la instrumentación debe seguir el mismo patrón para no introducir re-renders nuevos

### Integration Points
- `useGeolocation` → `useNavegacion` → `InteractiveMap`: la cadena real de datos que hay que instrumentar en los 6 tramos pedidos
- `backend/src/utils/arcgisRouting.js` `solve()` — punto de anclaje para medir "solicitud→respuesta ArcGIS" del lado del backend

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. El usuario confirmó tener dispositivos físicos (Android y, si aplica, iPhone) y entorno HTTPS de staging listos para la medición real cuando el plan de Fase 1 lo requiera.

</specifics>

<deferred>
## Deferred Ideas

- "Medición en dispositivo físico" y "Límite de esta fase" (micro-fixes triviales durante diagnóstico) no se discutieron a fondo — el usuario los dejó para que el plan de Fase 1 proponga un enfoque concreto en vez de decidirlos en discusión. `gsd-plan-phase 1` debe tratarlos como decisiones abiertas a resolver en el plan, no como gray areas ya cerradas.

### Reviewed Todos (not folded)
None — no había todos pendientes que hicieran match con esta fase (`todo.match-phase 1` devolvió 0 resultados).

</deferred>

---

*Phase: 1-Diagnóstico e instrumentación*
*Context gathered: 2026-09-01*
