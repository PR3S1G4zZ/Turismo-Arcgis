# Phase 7: Endurecimiento y UAT - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Cerrar el milestone con una suite de pruebas automatizadas en verde (rumbo, suavizado circular, histéresis de desvío, geometría, ciclo de vida de Wake Lock, contrato backend `startTime=now`) y UAT físico registrado en dispositivos reales (Android Chrome, iPhone Safari si hay dispositivo), sin guardar coordenadas de las pruebas en ningún artefacto. Esta fase no corrige comportamiento de navegación — solo endurece con pruebas y valida en dispositivos lo que las Fases 1-6 ya implementaron.

**Bloqueo estructural conocido:** Al momento de esta discusión, las Fases 1-6 figuran como "Not started" en ROADMAP.md/STATE.md (`current_phase: 1`, `completed_phases: 0`). El código de Wake Lock (WAKE-01) y de tráfico ArcGIS con `startTime=now` (TRAFFIC-01) no existe todavía en el repo (verificado por grep: sin resultados de `wakeLock`/`WakeLock`/`TravelTime` fuera de código no relacionado). El plan de esta fase será necesariamente estructural/genérico y requerirá replan cuando las Fases 1-6 tengan hallazgos e implementación concretos — esto se documenta explícitamente para que el usuario y el planner lo tengan en cuenta.

</domain>

<decisions>
## Implementation Decisions

### Cobertura de pruebas ante fases aún no implementadas
- **D-01:** El plan debe escribir tests reales contra lo que ya existe hoy en el código (`geoRuta.js`, partes de `useNavegacion.js`, `useGeolocation.js`, `estadoGps.js`) y dejar como pendiente explícito (`it.todo(...)` o sección "Pendiente de Fase N") lo que depende de código que aún no existe (Wake Lock, contrato `startTime=now`, flecha/cámara desacoplada de Fase 2, histéresis de Fase 3, geometría de Fase 4) — nunca simular una implementación falsa solo para tener un test en verde. — **Reversibility:** reversible — los placeholders se reemplazan por tests reales cuando el código exista, sin migración.
- **D-02:** Antes de ejecutar `/gsd-execute-phase 7`, el ejecutor (en la sesión futura que sí tenga permiso de tocar código) debe verificar el estado real de Fases 1-6 en STATE.md/ROADMAP.md y replanificar (`/gsd-plan-phase 7` de nuevo) si hay hallazgos concretos que cambien el diseño de las pruebas — el plan actual es la mejor aproximación posible sin esos hallazgos.

### Framework de testing backend (HARDEN-01 exige contract tests de `startTime=now`)
- **D-03:** Usar Vitest en el backend (mismo runner que frontend, ya en el stack, sin dependencia nueva de Jest) — agregar `backend/vitest.config.js` y script `test` en `backend/package.json`. — **Reversibility:** costly si luego se decide migrar a Jest (reescritura de mocks), pero de bajo riesgo dado que Vitest es API-compatible con Jest.

### Registro de UAT físico sin coordenadas
- **D-04:** El UAT se registra como checklist estructurado en Markdown (tabla: escenario × dispositivo × resultado × notas), con escenarios fijos = rotonda, calles paralelas, ruta que se cruza a sí misma, pérdida de GPS, regreso desde segundo plano — a pie y en auto. Sin campos de coordenadas, sin capturas de pantalla con overlays de mapa que revelen ubicación real si no es necesario. — **Reversibility:** reversible.

### Alcance de "build+lint+tests en verde"
- **D-05:** Esta fase verifica build+lint+tests en verde localmente (comandos documentados `npm run build`, `npm run lint`, `npm run test` en frontend, equivalentes en backend) — no se agrega CI (GitHub Actions) nuevo, porque no está en ROADMAP.md ni en Success Criteria de esta fase y sería scope creep de infraestructura. Se anota como idea diferida.

### Claude's Discretion
- Estructura exacta de los archivos de test nuevos (nombres, agrupación en `describe`) y de la carpeta de checklist UAT (p.ej. `.planning/phases/07-.../UAT-CHECKLIST.md` o `docs/uat/`) queda a criterio del planner/executor, siguiendo las convenciones ya usadas (`*.test.js` co-ubicado, ver TESTING.md).
- Cómo estructurar exactamente los placeholders "pendiente de Fase N" (comentario, `it.skip`, `it.todo`, sección separada en el informe) queda a criterio del planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto del milestone
- `.planning/PROJECT.md` — contexto completo, constraints (privacidad, multi-agente, costos), decisiones clave
- `.planning/REQUIREMENTS.md` — HARDEN-01, HARDEN-02 (requirements de esta fase)
- `.planning/ROADMAP.md` §Phase 7 — goal y success criteria de esta fase; también leer §Phase 1-6 completas para entender qué debería existir cuando esta fase se ejecute
- `.planning/STATE.md` — estado real de avance del milestone (Fases 1-6 "Not started" al momento de esta discusión)

### Mapa de código
- `.planning/codebase/TESTING.md` — framework de test frontend (Vitest/jsdom), convenciones de mocking, fixtures, gaps de cobertura conocidos
- `.planning/codebase/CONCERNS.md` §"Backend Lacks Automated Tests" y §"Test Coverage Gaps" — confirma que backend no tiene test runner configurado
- `.planning/phases/01-diagn-stico-e-instrumentaci-n/01-CONTEXT.md` — decisión previa de instrumentación dev-only sin coordenadas (`performance.mark`), patrón de privacidad a replicar en los tests/UAT de esta fase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/utilidades/geoRuta.js` + `geoRuta.test.js` — ya tiene tests de rumbo/distancia; base para expandir suavizado circular e histéresis cuando exista
- `frontend/src/hooks/useNavegacion.js` + `useNavegacion.test.js` — ya cubre parcialmente ciclo de navegación; punto de anclaje para tests de recálculo/desvío
- `frontend/src/componentes/detalle/estadoGps.js` + `estadoGps.test.js` — patrón de test ya establecido para lógica de estado GPS, reutilizable como plantilla para Wake Lock cuando exista
- `frontend/src/componentes/detalle/InteractiveMap.test.jsx` — patrón de mock de `react-map-gl`/`maplibre-gl`, reutilizable para tests de seguimiento/recentrado de cámara

### Established Patterns
- Fixtures por función factory (`fix({...})`, `navigation({...})`) definidas a nivel de módulo en el archivo de test — seguir el mismo patrón para nuevos tests
- Mocks de `navigator.geolocation`, `fetch`, `react-map-gl` vía `vi.mock`/`vi.stubGlobal` — mismo patrón esperado para mockear `navigator.wakeLock` cuando exista

### Integration Points
- `backend/src/utils/arcgisRouting.js` `solve()` — punto de anclaje futuro para contract tests de `startTime=now` y de respuestas ArcGIS fallidas/lentas/obsoletas (mockear fetch a ArcGIS)
- `backend/package.json` — no tiene script `test` todavía; debe agregarse junto con la config de Vitest

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. El usuario confirmó tener dispositivos Android/iPhone físicos y entorno HTTPS de staging listos para el UAT físico cuando llegue el momento (no es un bloqueante teórico, es una tarea real pendiente de cronograma).

</specifics>

<deferred>
## Deferred Ideas

- Agregar CI (GitHub Actions) que corra build+lint+test automáticamente en cada push — no está en el roadmap de este milestone; podría proponerse como fase/milestone futuro de DevOps.
- Cobertura de tests para AdminDashboard, PQRS, y otras áreas fuera de navegación (ya notado en CONCERNS.md como gap general) — fuera del alcance de HARDEN-01/HARDEN-02, que se limitan a navegación/geometría/Wake Lock/tráfico.

### Reviewed Todos (not folded)
None — `todo.match-phase 7` devolvió 0 resultados.

</deferred>

---

*Phase: 7-Endurecimiento y UAT*
*Context gathered: 2026-09-01*
