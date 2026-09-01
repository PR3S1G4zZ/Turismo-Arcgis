# Phase 3: Desvíos y recálculo adaptativo - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Rediseñar la detección de desvíos y la coordinación del recálculo dentro del motor de navegación existente, combinando distancia a la geometría original, calidad GPS, velocidad, dirección de desplazamiento, persistencia temporal e histéresis. La fase debe impedir recálculos por saltos GPS aislados, iniciar sin espera artificial el recálculo de un desvío confirmado, ignorar respuestas obsoletas y conservar las protecciones de coste y de bucle. No cambia el proveedor de rutas, no migra MapLibre, no altera la geometría de verdad y no modifica `frontend/` ni `backend/` durante esta sesión: aquí solo se fija el contexto para planificar.

</domain>

<decisions>
## Implementation Decisions

### Evidencia GPS multi-señal

- **D-01:** Un desvío real se evalúa contra la geometría original de la ruta y combina distancia con la confiabilidad/precisión de la lectura GPS; velocidad y dirección corroboran la señal cuando están disponibles, y su ausencia debe tener una degradación explícita en vez de rechazar o aceptar silenciosamente. Un salto incoherente con la precisión, el movimiento observado o la dirección no puede bastar para recalcular.
- **D-02:** La geometría consumida por map matching, progreso y detección de desvío sigue siendo la ruta original preparada por `geoRuta.js`; no se crea una geometría suavizada o alternativa para hacer que la detección parezca estable.

### Confirmación temporal e histéresis

- **D-03:** `UMBRAL_DESVIO_M = 45`, `LECTURAS_PARA_RECALCULAR = 3` y `ESPERA_ENTRE_RECALCULOS_MS = 15000` se tratan como línea base intencional. Antes de modificar cualquiera se debe documentar por qué existe, qué ruido o coste controla y qué evidencia justifica el cambio; no se reducen a ciegas.
- **D-04:** La detección debe distinguir entrada y salida del estado de desvío mediante histéresis: la frontera de salida es inferior a la de entrada y se basa en lecturas GPS válidas, evitando entrar/salir repetidamente por ruido. La confirmación debe producirse por persistencia/señales coherentes y, una vez confirmada, no debe añadir una espera fija artificial antes de solicitar la ruta.

### Estados y concurrencia del recálculo

- **D-05:** Se modelan y hacen comprobables por separado los estados/eventos `desvío detectado`, `recálculo solicitado` y `ruta aplicada`; detectar una condición no equivale a haber enviado una petición ni a haber aplicado su respuesta.
- **D-06:** La política de respuestas es latest-request-wins: cada recálculo tiene una generación/identidad monotónica; la petición anterior se cancela cooperativamente cuando sea posible y, como garantía obligatoria, cualquier respuesta obsoleta se ignora antes de cambiar ruta, estado, contadores, voz o UI.

### Coste, límites y privacidad

- **D-07:** Se conserva el rate limit del backend de rutas (60 solicitudes por ventana de 5 minutos), la supresión de solicitudes duplicadas o ya en curso y la protección contra bucles. Estas guardas no pueden convertirse en un retardo artificial para la primera solicitud de un desvío ya confirmado; el papel de los 15 segundos debe quedar justificado explícitamente si se conserva como guardia posterior.
- **D-08:** No se registran coordenadas personales, recorridos completos, tokens ni payloads que permitan reconstruirlos. Las pruebas usarán fixtures sintéticos y la observabilidad, si se necesita, describirá razones/estados sin posiciones.

### the agent's Discretion

- El plan puede escoger los nombres concretos de helpers/refs y la representación interna del estado, siempre que conserve las tres distinciones de D-05 y la política latest-request-wins de D-06.
- El plan debe derivar los valores numéricos de entrada/salida, tolerancias de velocidad/dirección y ventana temporal a partir del análisis del baseline y de las políticas existentes; no quedan fijados por esta discusión si no hay evidencia disponible.
- La cancelación de red puede apoyarse en la capacidad real de `rutasApi.resolver`; si no puede propagarse un `AbortSignal` sin romper contratos, el guard de generación sigue siendo obligatorio y debe probarse.
- La superficie visual exacta queda abierta: no se añade un panel nuevo por defecto, pero los estados deben ser observables en el hook y en pruebas, y cualquier texto existente de recálculo no debe anunciar una ruta que ya fue descartada.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Alcance y requisitos

- `.planning/PROJECT.md` — constraints del milestone, coste ArcGIS, privacidad, proveedor y mapa que no se pueden cambiar.
- `.planning/REQUIREMENTS.md` — requisitos `RECALC-01` y `RECALC-02`, además de sus límites de coste y privacidad.
- `.planning/ROADMAP.md` — Phase 3, dependencias y cinco criterios de éxito.
- `.planning/STATE.md` — estado del milestone, secuencia de fases y dependencia de Fase 2.
- `.planning/phases/01-diagn-stico-e-instrumentaci-n/01-CONTEXT.md` — decisiones previas sobre diagnóstico, instrumentación dev-only y áreas que Fase 1 debe dejar listas.

### Riesgos, arquitectura y convenciones

- `.planning/codebase/CONCERNS.md` §Fragile Areas — interacción frágil entre distancia, lecturas consecutivas, temporizador y refs; huecos de pruebas de recálculo.
- `.planning/codebase/ARCHITECTURE.md` §Data Flow, §Key Abstractions y §Architectural Constraints — cadena GPS → proyección → recálculo, estado de navegación y límite de rate limiting.
- `.planning/codebase/CONVENTIONS.md` — nombres JavaScript/React, refs, comentarios de porqué y convenciones de pruebas.
- `.planning/codebase/TESTING.md` — Vitest, fixtures sintéticos y ubicación/patrones de tests co-localizados.

### Puntos de integración actuales

- `frontend/src/hooks/useNavegacion.js` — constantes actuales, `calcular`, refs del bucle GPS y aplicación de rutas; principal punto de cambio futuro.
- `frontend/src/hooks/useGeolocation.js` — contrato de posición, `accuracy`, `speed`, `heading`, `gpsConfiable` y timestamp que alimentan la detección.
- `frontend/src/utilidades/geoRuta.js` — `prepararRuta`/`localizarEnRuta`, distancia a la ruta y geometría que permanece como fuente de verdad.
- `frontend/src/utilidades/api.js` — contrato de `rutasApi.resolver`, relevante para cancelación cooperativa sin romper llamadas existentes.
- `frontend/src/hooks/useNavegacion.test.js` — cobertura actual del hook y punto de extensión para saltos, persistencia, histéresis y respuestas obsoletas.
- `backend/src/routes/routing.js` — endpoint de recálculo y rate limit de 60 solicitudes/5 minutos que debe permanecer intacto.
- `backend/src/utils/arcgisRouting.js` — frontera del proveedor ArcGIS; no se sustituye ni se expone su credencial.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `localizarEnRuta()` devuelve `desviacionM`, `indice` y progreso sobre la polilínea preparada; permite que la nueva decisión siga anclada a la geometría real.
- `useGeolocation()` ya expone `gpsConfiable`, `position.coords` normalizados y `ultimaActualizacion`; es la entrada natural para calidad, velocidad, rumbo y frescura.
- `rutasApi.resolver()` mantiene el contrato único del frontend con el backend y evita que la lógica de recálculo hable directamente con ArcGIS.
- `useNavegacion.test.js` ya mockea `rutasApi` y `useGeolocation`, por lo que puede añadir escenarios deterministas sin coordenadas reales.

### Established Patterns

- Los valores no reactivos del bucle se guardan en `useRef` para no re-suscribir el efecto GPS; cualquier estado de detección debe respetar esa separación.
- Las utilidades geométricas son funciones puras en `frontend/src/utilidades/`; la detección puede extraer funciones puras solo si no duplica la proyección de `geoRuta.js`.
- El proyecto usa Vitest y fixtures sintéticos co-localizados; no existe suite backend para trasladar la lógica allí.
- Los límites del backend son la última red de seguridad económica; el cliente no debe asumir que un guard de UI reemplaza al rate limiter.

### Integration Points

- El efecto de seguimiento de `useNavegacion` consume cada posición aceptada, actualiza progreso y actualmente incrementa `lecturasFueraRef` antes de llamar a `calcular()`.
- `calcular()` controla la petición, `recalculando`, instalación de `rutaRef` y reset de contadores; deberá separar solicitud de aplicación y proteger la respuesta por generación.
- `detener()` y los cambios de sesión deben invalidar cualquier recálculo pendiente para que una ruta de una navegación anterior no pueda reaparecer.

</code_context>

<specifics>
## Specific Ideas

- La implementación debe empezar con un análisis documentado de 45 m / 3 lecturas / 15 s y de los efectos que esos números controlan.
- Un salto GPS aislado nunca inicia una petición; un desvío coherente y de alta precisión sí debe solicitar inmediatamente después de su confirmación.
- La distinción operativa requerida es: `desvío detectado` → `recálculo solicitado` → `ruta aplicada`, con respuestas viejas canceladas o ignoradas.
- Fase 3 depende de Fase 2; ambas tocan `useNavegacion.js`, por lo que la ejecución real debe esperar al merge de Fase 2.

</specifics>

<deferred>
## Deferred Ideas

Ninguna. La discusión se mantuvo dentro de detección de desvíos, recálculo, coste, concurrencia y privacidad de esta fase.

</deferred>

---

*Phase: 3-Desvíos y recálculo adaptativo*
*Context gathered: 2026-09-01*
