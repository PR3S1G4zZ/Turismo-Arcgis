# Turismo Itagüí — Navegación Móvil ArcGIS

## What This Is

Portal turístico del Municipio de Itagüí (Antioquia, Colombia): catálogo de sitios, calendario de eventos, PQRS ciudadano y panel de administración, construido en React 19 + Vite (frontend) y Node/Express + MySQL (backend). Su función central para el visitante es la **navegación en tiempo real por calles reales** hasta cada sitio turístico, estilo Waze/Google Maps: GPS en vivo, indicaciones giro a giro con voz en español, cámara course-up y recálculo automático por desvío, apoyada en el servicio ArcGIS World Route (con respaldo OSRM).

## Core Value

Que la navegación en tiempo real sea confiable y responsiva: la flecha, la cámara y el progreso deben reflejar la posición y el rumbo reales del visitante sin retraso perceptible ni orientaciones incorrectas — manteniendo la geometría de ArcGIS como fuente de verdad para el trazado, el progreso y la detección de desvíos.

## Business Context

- **Customer**: Alcaldía de Itagüí — portal público municipal, sin monetización directa
- **Success metric**: navegación sin retraso perceptible en cambios de dirección/desvío, sin regresiones en GPS/progreso/llegada/voz/vista previa/recálculo/respaldo OSRM, validada en Android Chrome y iPhone Safari físicos por HTTPS

## Requirements

### Validated

<!-- Inferido del código existente (ARCHITECTURE.md, STACK.md) — capacidades ya funcionando. -->

- ✓ Navegación GPS en tiempo real con proyección punto-segmento sobre la ruta (`geoRuta.js`) — existente
- ✓ Ruteo real por calles vía ArcGIS World Route (`esriNAOutputLineTrueShape`), con respaldo automático a OSRM — existente
- ✓ Indicaciones giro a giro en español con síntesis de voz — existente
- ✓ Recálculo automático por desvío (umbral 45 m, 3 lecturas, espera 15 s) — existente
- ✓ Cámara course-up con pausa por gesto del usuario y control de recentrado (`enSeguimiento` / `siguiendo` ya separados) — existente
- ✓ Credencial de ArcGIS nunca expuesta al frontend (proxy exclusivo por backend) — existente
- ✓ Ciclo previo de fixes de fiabilidad de navegación ya mergeado a `main` (rama `codex/map-navigation-reliability`, PR #5): latencia GPS, ciclo de vida de cámara, bearing sin heading GPS, estado GPS obsoleto — existente, alcance exacto por auditar en Fase 0

### Active

- [ ] **DIAG-01**: Medir por separado, solo en desarrollo y sin coordenadas, las 6 latencias internas listadas (GPS→marcador, orientación→flecha, GPS→cámara, desvío→solicitud, solicitud→respuesta ArcGIS, respuesta→ruta renderizada), en al menos un Android real
- [ ] **DIAG-02**: Auditar qué de los síntomas reportados ya quedó resuelto por el ciclo previo (`codex/map-navigation-reliability`, ya mergeado) antes de instrumentar o re-diagnosticar desde cero
- [ ] **NAV-01**: Modelo explícito con estados independientes — posición GPS, rumbo de movimiento, rumbo de brújula, rotación de la flecha, bearing del mapa, seguimiento de cámara activo/pausado
- [ ] **NAV-02**: La flecha se orienta correctamente aunque la cámara esté pausada por un gesto del usuario o no se haya pulsado "Centrar en mí" (corrige el hallazgo concreto en `InteractiveMap.jsx:354-360`, donde la rotación usa `!enSeguimiento` en vez de `!siguiendo`)
- [ ] **NAV-03**: Salto circular 359°→0° sin oscilaciones visibles al cruzar norte; sin listeners duplicados ni fugas al montar/desmontar
- [ ] **NAV-04**: Latencia interna rumbo válido→flecha p95 < 250 ms; posición aceptada→cámara p95 < 500 ms
- [ ] **RECALC-01**: Detección de desvío basada en distancia a la ruta, precisión GPS, velocidad, persistencia temporal, dirección de desplazamiento e histéresis — sin reducir a ciegas las 3 lecturas / 15 s existentes sin analizar antes por qué existen
- [ ] **RECALC-02**: Un salto GPS aislado no dispara recálculo; un desvío confirmado no espera un retardo artificial adicional; se cancelan/ignoran respuestas de recálculo obsoletas
- [ ] **GEOM-01**: Captura de una ruta problemática real (rotonda/curva de Itagüí) y comparación de las 5 etapas (ArcGIS crudo, OSRM crudo si intervino, normalizado backend, GeoJSON a MapLibre, resultado visual) antes de tocar el renderizado
- [ ] **GEOM-02**: Las rotondas/curvas conservan la geometría real — sin cortar esquinas, separadores, edificios ni abandonar la calzada; el map matching sigue usando la geometría original
- [ ] **WAKE-01**: Screen Wake Lock durante navegación activa — adquisición, liberación al llegar/cancelar/error/desmontar, reintento al volver de segundo plano, degradación segura sin soporte
- [ ] **TRAFFIC-01**: Investigar y, si es viable con evidencia, incorporar tráfico ArcGIS (`TravelTime`, `startTime=now`) solo para rutas en automóvil, con degradación clara sin cobertura/permiso
- [ ] **TRAFFIC-02**: Investigar la capa visual de tráfico de ArcGIS (Traffic Map Service) detrás de feature flag; si exige migrar al ArcGIS Maps SDK, requiere ADR + aprobación humana antes de implementar
- [ ] **HARDEN-01**: Suite de pruebas (rumbo, suavizado circular, histéresis, geometría, Wake Lock, contrato backend `startTime=now`) + build/lint/tests en verde
- [ ] **HARDEN-02**: UAT físico registrado en Android Chrome e iPhone Safari (a pie y en auto: rotonda, calles paralelas, ruta que se cruza, pérdida de GPS, regreso desde segundo plano), sin guardar coordenadas

### Out of Scope

- Migración completa al ArcGIS Maps SDK for JavaScript — requiere ADR, comparación técnica y aprobación humana explícita; no se asume como parte de este milestone
- Reemplazo de MapLibre GL — descartado salvo decisión arquitectónica separada y aprobada
- Reducir los umbrales de recálculo (3 lecturas / 15 s) sin análisis previo de por qué existen — el plan exige medir antes de tocar
- Suavizado de geometría que corte esquinas, separadores, edificios o rotondas — la geometría cruda de ArcGIS sigue siendo la fuente de verdad
- Registrar coordenadas personales, recorridos completos o tokens en cualquier artefacto (código, docs, instrumentación, tests)

## Context

- Brownfield con historial reciente relevante: la rama `codex/map-navigation-reliability` (PR #5, ya mergeada a `main`) atacó síntomas muy similares a los de este milestone (latencia GPS, ciclo de vida de cámara, bearing sin heading, estado GPS obsoleto) mediante commits `fix: make GPS navigation state trustworthy`, `fix: remove GPS navigation lag`, `fix: stabilize map camera lifecycle`, `fix: preserve bearing without GPS heading`, `fix: clarify stale GPS route status`, más un fix adicional ya en `main` (`677a933`) sobre `localizarEnRuta`. Fase 0 debe partir de esa auditoría, no de cero.
- Anti-patrón detectado en el mapeo de arquitectura (`ARCHITECTURE.md`): lógica de proyección geométrica duplicada entre `InteractiveMap.jsx` (constantes/funciones locales de radio terrestre y punto-destino) y `geoRuta.js` (fuente de verdad) — relevante para las fases de flecha/rumbo (NAV) y fidelidad de curvas (GEOM).
- Hallazgo concreto ya localizado: `InteractiveMap.jsx:354-360` calcula la rotación de la flecha condicionada a `!enSeguimiento` en vez de `!siguiendo`, por lo que al pausar la cámara con un gesto la flecha queda fija asumiendo que el mapa sigue rotando — candidato fuerte a causa raíz de NAV-02.
- Sin Wake Lock implementado (grep sin resultados en `frontend/src`) y sin tráfico ArcGIS (`startTime`/`TravelTime`) implementado en el backend — ambos son trabajo nuevo, no bugs a corregir.
- `outputLines=esriNAOutputLineTrueShape` ya está activo en `backend/src/utils/arcgisRouting.js` — la geometría cruda solicitada a ArcGIS ya es TrueShape; el síntoma de fidelidad de curvas, si es real, puede ser de renderizado o de uso del respaldo OSRM, no necesariamente de geometría perdida.
- Worktree huérfano en `C:/Proyectos/Turismo-Arcgis/.worktrees/map-navigation-reliability` (misma rama ya mergeada) — se deja intacto por decisión explícita del usuario.
- Orquestación multiagente: este worktree (`leatherback`, rama `PR3S1G4zZ/chore-multiagent-dev-station`) es el coordinador/padre. Herramientas disponibles confirmadas en esta máquina: `codex`, `opencode`, `cursor-agent`, `cursor`. La cuenta "Claude Team" es el binario `claude` de PATH (terminal plano, cuenta distinta de la gestionada por Orca); Codex ya está activo en Orca (`orca account list`).

## Constraints

- **Proveedor de rutas**: ArcGIS World Route sigue como proveedor principal; OSRM solo como respaldo — no reemplazar
- **Mapa**: MapLibre GL vía `react-map-gl` se mantiene; no migrar al ArcGIS Maps SDK for JavaScript sin ADR + comparación técnica + aprobación humana explícita
- **Geometría**: la geometría cruda de ArcGIS sigue siendo la fuente de verdad para map matching, progreso y detección de desvíos — ninguna suavización visual puede alterarla
- **Privacidad**: no registrar coordenadas personales, recorridos completos ni tokens en ningún artefacto generado (código, docs, instrumentación, tests, UAT)
- **Multi-agente**: un único cliente escritor por fase; dos clientes no modifican los mismos archivos simultáneamente; revisores de solo lectura no tocan código de producción
- **Despliegue**: HTTPS obligatorio para `watchPosition` (o `localhost`); UAT final en dispositivos físicos Android Chrome y, si disponible, iPhone Safari
- **Costos**: cada recálculo de ruta es una petición facturable a ArcGIS (20.000 rutas gratis/mes) — cualquier cambio a los umbrales de recálculo debe justificar el impacto en volumen de peticiones

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `.planning/` vive en este worktree (`leatherback`), no en el checkout principal | El usuario pidió explícitamente que este worktree sea el "padre" de la orquestación multiagente; `gsd-tools` centraliza por defecto en el checkout principal salvo que `.planning/` ya exista en el worktree invocador | ✓ Good |
| Fase 0 audita primero el trabajo ya mergeado de `codex/map-navigation-reliability` | Evitar redescubrir o reimplementar fixes que ya resolvieron parte de los síntomas reportados | — Pending |
| Worktree huérfano `.worktrees/map-navigation-reliability` se deja intacto | Decisión explícita del usuario; rama ya mergeada pero sin confirmación de limpieza | ✓ Good |
| Delegación real a Codex/OpenCode/Cursor vía `orca worktree create --agent <id> --parent-worktree active` desde este worktree | El usuario confirmó que este worktree actúa como padre y que los hijos deben ejecutar cada herramienta real, no solo recibir un brief manual | — Pending |
| UAT físico se ejecuta según cronograma (dispositivos disponibles) | El usuario confirmó tener Android/iPhone físicos y entorno HTTPS de staging listos | — Pending |

## Evolution

Este documento evoluciona en transiciones de fase y límites de milestone.

**Después de cada transición de fase** (vía `/gsd-transition`):
1. ¿Requisitos invalidados? → Mover a Out of Scope con motivo
2. ¿Requisitos validados? → Mover a Validated con referencia de fase
3. ¿Nuevos requisitos emergieron? → Agregar a Active
4. ¿Decisiones que registrar? → Agregar a Key Decisions
5. ¿"What This Is" sigue siendo preciso? → Actualizar si hay desvío

**Después de cada milestone** (vía `/gsd-complete-milestone`):
1. Revisión completa de todas las secciones
2. Chequeo de Core Value — ¿sigue siendo la prioridad correcta?
3. Chequeo de Business Context — ¿cliente, métrica de éxito siguen vigentes?
4. Auditar Out of Scope — ¿los motivos siguen siendo válidos?
5. Actualizar Context con el estado actual

---
*Last updated: 2026-09-01 after initialization*
