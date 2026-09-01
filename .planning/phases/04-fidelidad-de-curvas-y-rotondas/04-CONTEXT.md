# Phase 4: Fidelidad de curvas y rotondas - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Antes de tocar el renderizado, capturar una ruta problemática real (rotonda/curva de Itagüí) y comparar las 5 etapas del pipeline geométrico — respuesta cruda de ArcGIS, respuesta cruda de OSRM si intervino, puntos normalizados por el backend, GeoJSON entregado a MapLibre, resultado visual — manteniendo la geometría cruda de ArcGIS como fuente de verdad para map matching, progreso y detección de desvíos. Esta fase es de captura y diagnóstico geométrico: produce evidencia documentada y, si la evidencia lo justifica, cambios de representación visual únicamente (casing, ancho de línea, opacidad, transiciones por zoom, densificación puramente visual). Nunca altera el trazado lógico que usa `geoRuta.js` para map matching/progreso/desvío — esa geometría cruda sigue intacta.

</domain>

<decisions>
## Implementation Decisions

[Modo `--auto`: para cada pregunta se seleccionó la opción recomendada sin interacción. Se registra el razonamiento igual que en una discusión interactiva.]

### Captura de la ruta real
- **D-01:** La captura de las 5 etapas requiere golpear el servicio real de ArcGIS (y potencialmente OSRM como respaldo) para una rotonda/curva real de Itagüí — no es automatizable en este entorno de planificación. El plan de Fase 4 debe incluir un paso de ejecución humana marcado `autonomous: false`, con el mismo patrón que usó la Fase 1 para la medición en dispositivo físico (build/instrucciones + checkpoint humano). — **Reversibility:** reversible — es solo una captura de datos para un informe, no toca código de producción ni credenciales.
- **D-02:** El mecanismo de captura es un script o instrumentación temporal dev-only que registra a archivo (no a producción) las 5 salidas: (1) respuesta cruda de ArcGIS `/solve` (antes de `normalizar()` en `backend/src/utils/arcgisRouting.js`), (2) respuesta cruda de OSRM si intervino como respaldo (`backend/src/utils/osrmRouting.js`), (3) el objeto normalizado que devuelven `normalizar()`/`resolverRutaOsrm()` (`puntos` que llegan al frontend), (4) el GeoJSON que arma `lineaGeoJSON()` en `InteractiveMap.jsx` antes de entregarlo a MapLibre, (5) una captura de pantalla del resultado visual renderizado. Se guarda dentro del propio directorio de la fase (p. ej. `.planning/phases/04-fidelidad-de-curvas-y-rotondas/captura/`), nunca mezclado con código de producción.
- **D-03:** El origen y destino de la ruta de prueba deben ser coordenadas de sitios turísticos ya públicos en la base de datos (no la ubicación GPS real de una persona) — cumple la constraint de privacidad del milestone (no registrar coordenadas personales ni recorridos completos).

### Formato de comparación de las 5 etapas
- **D-04:** La comparación se documenta como una tabla (etapa → nº de vértices → fuente/proveedor → observaciones) más un overlay visual (capturas de pantalla comparadas lado a lado o superpuestas) dentro de un informe dedicado (p. ej. `04-COMPARACION-GEOMETRIA.md`) — no un HUD nuevo ni logging estructurado permanente en producción.

### Selección de la rotonda/curva de prueba
- **D-05:** Qué rotonda/curva específica de Itagüí usar queda a discreción del dueño del milestone al ejecutar la captura — Claude no puede verificar en campo cuál rotonda es representativa del síntoma reportado. El plan debe sugerir 1-2 candidatas conocidas (glorieta principal u otra curva pronunciada) como punto de partida, pero el paso de ejecución humana confirma cuál se usó.

### Alcance de la mejora de representación (condicional)
- **D-06:** Si la comparación documentada muestra que la geometría cruda de ArcGIS es genuinamente escasa en la rotonda capturada (pocos vértices para el radio de curvatura real), la densificación visual queda anotada como trabajo candidato para una fase/plan de implementación posterior — fuera del alcance de este cliente de planificación (Fase 4 solo produce artefactos de planificación, no ejecuta cambios de renderizado). El plan debe dejar explícito que cualquier suavizado usaría un método puramente visual (spline tipo Catmull-Rom, offset de línea, etc.) aplicado solo en la capa de render de MapLibre (`InteractiveMap.jsx`), nunca sobre `ruta.puntos` consumidos por `geoRuta.js` (map matching/progreso/desvío). — **Reversibility:** one-way si se implementara sin esta separación — mezclar geometría visual con la lógica de map matching sería costoso de deshacer (habría que auditar cada consumidor de `ruta.puntos` para diferenciar "visual" de "lógico").

### Claude's Discretion
- Formato exacto del archivo JSON de captura, nombres de archivo y estructura del directorio `captura/` quedan a criterio de implementación del plan, siempre que separen claramente las 5 etapas y no incluyan coordenadas de recorridos personales — solo las de la ruta de prueba explícitamente elegida (sitios turísticos públicos).
- Cómo instrumentar temporalmente `arcgisRouting.js`/`osrmRouting.js`/`InteractiveMap.jsx` para exponer cada etapa sin alterar su comportamiento en producción es una decisión de implementación del plan, no de esta discusión.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto del milestone
- `.planning/PROJECT.md` — contexto completo, constraints (proveedor ArcGIS, geometría fuente de verdad, privacidad), decisiones clave
- `.planning/REQUIREMENTS.md` — GEOM-01, GEOM-02 (requirements de esta fase)
- `.planning/ROADMAP.md` §Phase 4 — goal y success criteria de esta fase

### Mapa de código
- `.planning/codebase/ARCHITECTURE.md` §Anti-Patterns "Duplicate Route Projection Logic" — lógica de proyección geométrica duplicada entre `InteractiveMap.jsx` y `geoRuta.js`, relevante para no confundir "fuente de verdad" con "código de render" al comparar etapas
- `.planning/codebase/CONCERNS.md` §Known Bugs "GPS Route Progress Jumping (Recently Fixed)" — fix `677a933` sobre rutas que pasan cerca de sí mismas, relevante como precedente de bug geométrico ya resuelto
- `.planning/codebase/CONCERNS.md` §Fragile Areas "Route Deviation and Recalculation Logic" y §Performance Bottlenecks "Synchronous GPS Route Projection on Each Update" — contexto de por qué la geometría cruda no debe alterarse a la ligera
- `.planning/codebase/INTEGRATIONS.md` — detalle de los proveedores ArcGIS World Route (principal) y OSRM (respaldo, servidor demo público)

### Historial relevante
- `.planning/phases/01-diagn-stico-e-instrumentaci-n/01-CONTEXT.md` — precedente directo de un paso de captura en dispositivo físico con checkpoint humano (`autonomous: false`), mismo patrón que necesita esta fase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/utils/arcgisRouting.js` `normalizar()` (línea ~179) y `solve()` (línea ~248) — punto de anclaje para capturar las etapas "ArcGIS crudo" y "normalizado backend"; `outputLines: 'esriNAOutputLineTrueShape'` ya está activo (línea ~263)
- `backend/src/utils/osrmRouting.js` `resolverRutaOsrm()` (línea ~67) — misma etapa para el respaldo OSRM; ya devuelve el mismo formato (`{ fuente: 'osrm', puntos, pasos, ... }`) que ArcGIS
- `frontend/src/componentes/detalle/InteractiveMap.jsx` `lineaGeoJSON()` (línea ~58) — punto de anclaje para capturar el GeoJSON entregado a MapLibre; las capas `ruta-recorrida-linea`/`ruta-restante-linea` (líneas ~435-454) son el punto de anclaje del resultado visual
- `frontend/src/utilidades/geoRuta.js` `prepararRuta()`/`localizarEnRuta()` — confirma que `ruta.puntos` (geometría cruda) es la fuente de verdad real que usa el map matching, sin alteración

### Established Patterns
- El objeto normalizado ya incluye `fuente: 'arcgis'|'osrm'` — permite confirmar qué proveedor resolvió la ruta capturada sin instrumentación nueva
- Las capas de línea de ruta en `InteractiveMap.jsx` usan `line-width`/`line-opacity` fijos (5/6 px, colores `rutaHecha`/`rutaActiva`) sin expresión por zoom — candidato directo si el success criteria de representación visual requiere ajustes

### Integration Points
- Pipeline real de las 5 etapas pedidas por GEOM-01: ArcGIS/OSRM (backend, `arcgisRouting.js`/`osrmRouting.js`) → `normalizar()`/`resolverRutaOsrm()` (puntos normalizados) → `prepararRuta()` (frontend, `geoRuta.js`) → `lineaGeoJSON()` (`InteractiveMap.jsx`) → capas MapLibre (resultado visual)

</code_context>

<specifics>
## Specific Ideas

No hay referencias específicas más allá del alcance de la fase — abierto al enfoque estándar de captura + comparación documental descrito en las decisiones.

</specifics>

<deferred>
## Deferred Ideas

- Implementación real de densificación visual o ajustes de casing/ancho/opacidad/zoom (D-06) — condicionada a evidencia de la propia captura de esta fase; se ejecuta en una fase/plan de implementación posterior, no en este cliente de planificación.

### Reviewed Todos (not folded)
None — no había todos pendientes que hicieran match con esta fase (`todo.match-phase 4` devolvió 0 resultados).

</deferred>

---

*Phase: 4-Fidelidad de curvas y rotondas*
*Context gathered: 2026-09-01*
