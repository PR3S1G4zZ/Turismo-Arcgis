# Phase 6: Tráfico ArcGIS - Research

**Researched:** 2026-09-01
**Domain:** ArcGIS Location Platform — ruteo sensible al tráfico (World Route `/solve`) y capa visual de tráfico (Traffic Map Service)
**Confidence:** MEDIUM — parámetros oficiales confirmados con alta confianza (Parte A); cobertura Colombia confirmada; costo específico de la capa visual y su compatibilidad práctica con MapLibre GL quedan con confianza media/baja y requieren verificación adicional en implementación (ver `<open_questions>`)

> **Nota de procedencia:** esta investigación la ejecutó el propio agente orquestador de esta sesión (no un subagente `gsd-phase-researcher`) usando WebSearch/WebFetch directos contra documentación oficial de Esri, por instrucción explícita del orquestador padre de no delegar más trabajo a subagentes en esta sesión. El método (fuentes oficiales, verbatim donde fue posible) sigue el mismo estándar que exigiría el agente investigador.

<user_constraints>
## User Constraints (from CONTEXT.md)

**CRITICAL:** Estas decisiones son de `06-CONTEXT.md` (sesión `--auto`, sin interacción humana) y son NO NEGOCIABLES para el plan.

### Locked Decisions
- **D-01/D-02:** La respuesta normalizada de `/api/rutas/resolver` agrega campos aditivos de tráfico (sugeridos: `traficoSolicitado`, `traficoAplicado`), sin romper el contrato existente; `traficoSolicitado` solo puede ser `true` en modo `car` con ArcGIS como proveedor activo — el modo peatonal nunca reporta tráfico.
- **D-03/D-04:** Degradación explícita y visible cuando no hay tráfico disponible o cuando se cae a OSRM (`traficoAplicado: false` en ambos casos) — nunca fallo silencioso ni simulación de una mejora inexistente.
- **D-05/D-06:** La Parte B (capa visual) es investigación documentada primero; solo se implementa código de UI si esta investigación aporta evidencia concreta de viabilidad sin migrar de SDK. Cualquier prototipo va detrás de un feature flag apagado por defecto.
- **D-07:** No se implementa `startTime=now`/impedancia de tráfico a ciegas — debe confirmarse contra documentación oficial de ArcGIS el parámetro real, si el travel mode "Driving Time" ya lo soporta, y si tiene costo/cuota diferenciado. Si la evidencia es negativa/inconclusa, el plan implementa solo la infraestructura de reporte sin asumir mejora real.

### Claude's Discretion
- Nombres finales de los campos nuevos de tráfico en la respuesta normalizada.
- Mecanismo concreto de feature flag para la Parte B.

### Deferred Ideas (OUT OF SCOPE)
- TRAFFIC-03 (tráfico peatonal) y TRAFFIC-04 (restricciones por vehículo) — v2 Requirements, no investigados aquí.
- Migración al ArcGIS Maps SDK for JavaScript — **REGLA DURA**: fuera de alcance de esta fase bajo cualquier circunstancia; si la Parte B la exige, se documenta como hallazgo para un ADR futuro separado, nunca como tarea de este plan.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ruteo sensible al tráfico (Parte A: `startTime`, impedancia) | API/Backend (`backend/src/utils/arcgisRouting.js`) | — | El backend es el único cliente autorizado de ArcGIS (credencial nunca llega al navegador); el parámetro de tráfico se agrega en `solve()` y se refleja en `normalizar()` |
| Reporte de estado de tráfico en la respuesta | API/Backend → Browser/Client | — | El backend calcula/decide `traficoSolicitado`/`traficoAplicado`; el frontend (`RouteModal.jsx`) solo consume y muestra ese estado, no decide |
| Capa visual de tráfico (Parte B, si se implementa) | Browser/Client (MapLibre GL) | API/Backend (si requiere proxy de token, igual que el basemap) | El patrón ya establecido (`backend/src/routes/mapa.js` → `/api/mapa/token`) es el análogo directo: el backend broker-ea el token, el frontend consume la capa en MapLibre |

</architectural_responsibility_map>

<research_summary>
## Summary

**Parte A (ruteo con tráfico) es viable sin ambigüedad de parámetros.** La documentación oficial de ArcGIS REST API confirma dos parámetros concretos y ya usables en el `/solve` actual: `impedanceAttributeName=TravelTime` (usa datos de tráfico históricos y en vivo) y `startTime` (Unix epoch en ms, o el string literal `"now"` para tráfico en vivo). Crucialmente, **el travel mode "Driving Time"** — que es exactamente el modo que `elegirModo()` en `arcgisRouting.js` ya selecciona por preferencia de nombre para `modo === 'car'` — **usa `TravelTime` como su `impedanceAttributeName` por defecto** en la configuración estándar de Esri. Esto significa que, en el caso común, el ruteo en auto de este proyecto ya está a un solo parámetro (`startTime=now`) de ser sensible al tráfico, sin necesidad de cambiar de travel mode. La cautela necesaria: `travelMode` es un objeto completo que **sobreescribe** cualquier `impedanceAttributeName` de nivel superior — si el objeto JSON real que devuelve `obtenerModos()` para esta organización tiene un `impedanceAttributeName` distinto de `TravelTime` (los admins de organización pueden personalizarlo), el tráfico simplemente no se aplicará aunque se envíe `startTime`. Por eso el plan debe **inspeccionar en runtime** el JSON del modo elegido, no asumir el nombre.

**La cobertura de tráfico en Colombia está confirmada oficialmente en un nivel favorable.** La tabla oficial de cobertura de red de Esri (`developers.arcgis.com/rest/routing/network-coverage/`) lista a Colombia con `Speed Data Source: Predictive Traffic` y `Traffic Incidents: Yes` — el nivel más alto de datos de tráfico que documenta Esri (histórico + en vivo + predictivo), no solo histórico. Esto es evidencia positiva concreta para decidir implementar Parte A, aunque el nivel de precisión real dato-a-dato en calles específicas de Itagüí (vs. vías principales de Medellín) no está garantizado por esta tabla — es cobertura a nivel país/región, no una garantía calle-por-calle.

**No hay evidencia de un costo adicional distinto para el tráfico en el ruteo.** La documentación de precios de ArcGIS Location Platform (`location.arcgis.com/pricing/`) no menciona ningún cargo diferenciado por usar `startTime`/tráfico — la facturación de rutas se determina por el número de rutas devueltas vía `solve`, sin distinción de si llevan tráfico o no. Esto es evidencia por ausencia (no se encontró una tarifa separada), no una confirmación explícita de "sin costo adicional" — se documenta como hallazgo de confianza media.

**Parte B (capa visual) es técnicamente identificable pero con viabilidad incierta fuera del SDK de Esri.** El servicio existe con un endpoint REST público y documentado: `https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer` — es un **Map Service dinámico** (no un servicio de teselas cacheadas) con capas de velocidad/incidentes/cierres por región, actualizado cada 5 minutos. La documentación oficial de Esri describe su consumo explícitamente vía "ArcGIS Maps SDK for JavaScript" y los SDK nativos — **no** documenta un patrón soportado de consumo directo en MapLibre GL u otra librería de código abierto. Es contenido de Living Atlas suscrito por la organización: no consume créditos de ArcGIS Online, pero sí requiere un login/token de organización autenticado (mismo patrón ya usado en este proyecto para el basemap vía `/api/mapa/token`). Técnicamente, un Map Service dinámico *puede* consumirse como fuente `raster` en MapLibre GL construyendo peticiones `export` por viewport (patrón usado por librerías como Esri-Leaflet para MapServers dinámicos) — pero esto es un patrón no documentado oficialmente para MapLibre, implica una petición de imagen nueva en cada pan/zoom (sin aprovechamiento de caché de teselas), y tiene implicancias reales de red/batería en móvil que el ROADMAP pide evaluar explícitamente. Esto es el hallazgo central de Parte B: **es posible sin migrar de SDK, pero no es el camino soportado ni gratis en complejidad de implementación/rendimiento** — muy distinto de "trivial".

**Primary recommendation:** Implementar Parte A como cambio de bajo riesgo (agregar `startTime=now` condicionado a `modo === 'car'` y a que el `travelMode` elegido tenga `impedanceAttributeName === 'TravelTime'`, verificado en runtime desde `obtenerModos()`) más los campos de reporte de estado (D-01 a D-04). Para Parte B, el plan de esta fase debe limitarse a documentar el hallazgo de viabilidad (raster dinámico vía `export`, con las implicancias de rendimiento/batería) y NO comprometerse a construir la capa visual en este ciclo salvo que el usuario del milestone decida asumir ese costo de implementación no trivial — en cuyo caso debe ir estrictamente detrás de un feature flag apagado por defecto, replicando el patrón de proxy de token ya usado para el basemap.

</research_summary>

<protocol_parameters>
## Parámetros confirmados del servicio ArcGIS World Route `/solve` (Parte A)

Fuente primaria: `developers.arcgis.com/rest/routing/route-service-direct/` y `developers.arcgis.com/rest/services-reference/enterprise/route-sync-services.htm` (Esri Developer, oficial).

| Parámetro | Valor/tipo | Efecto | Nota crítica |
|---|---|---|---|
| `impedanceAttributeName` | `"TravelTime"` | Activa el uso de datos de tráfico históricos y en vivo como costo de la ruta | Ya es el valor por defecto del travel mode estándar **"Driving Time"** de Esri — coincide con el modo que ya selecciona `elegirModo()` para `modo === 'car'` |
| `startTime` | Unix epoch en milisegundos, o el string `"now"` | Determina si se usa velocidad estática/histórica (parámetro omitido), tráfico en vivo (`"now"`), o tráfico histórico para una fecha/hora específica | Sin `startTime`, aunque `impedanceAttributeName=TravelTime`, se usan velocidades estáticas — **el parámetro de tráfico real que falta agregar es `startTime`, no el impedance attribute** (que muy probablemente ya está puesto por el travel mode) |
| `startTimeIsUTC` | boolean, default `false` | Si `false`, `startTime` se interpreta en la zona horaria del primer stop de cada ruta | Con `startTime="now"` es indiferente; solo importa si se pasa una fecha/hora explícita futura |
| `accumulateAttributeNames` | lista opcional (ej. `Miles`) | Permite calcular métricas adicionales (distancia) sin cambiar el impedance principal | No es necesario para el objetivo de esta fase — el proyecto ya reporta `distanciaM`/`duracionMin` desde el `summary` de `directions` |
| `travelMode` (objeto JSON completo) | objeto con `impedanceAttributeName`, `restrictionAttributeNames`, `useHierarchy`, `outputGeometryPrecision` | **Sobreescribe** cualquier `impedanceAttributeName` top-level si se envía | **Riesgo directo para este proyecto:** `arcgisRouting.js` YA envía `params.travelMode = JSON.stringify(travelMode)` (línea ~266) cuando `elegirModo()` encuentra un modo. Si ese modo trae un `impedanceAttributeName` distinto de `TravelTime` (personalización de la organización), agregar `startTime` no tendrá ningún efecto de tráfico real aunque no falle |

**Implicación de diseño directa para el plan:** el plan NO debe asumir ciegamente que el modo "Driving Time" de esta organización específica tiene `impedanceAttributeName: "TravelTime"` — debe verificarlo en runtime inspeccionando el objeto JSON completo que ya devuelve `obtenerModos()` (cacheado 6h), y solo reportar `traficoAplicado: true` cuando: (a) `modo === 'car'`, (b) el proveedor activo es ArcGIS, (c) el `travelMode` elegido tiene `impedanceAttributeName === 'TravelTime'` (o equivalente que use tráfico), y (d) `startTime` se envió sin error de ArcGIS. Si el modo real no trae ese impedance, el plan debe documentar la limitación y reportar `traficoAplicado: false` de forma honesta en vez de fingir un mejor servicio.

</protocol_parameters>

<coverage_and_cost>
## Cobertura en Colombia (Parte A)

Fuente primaria: `developers.arcgis.com/rest/routing/network-coverage/` (tabla oficial de cobertura de red de Esri, verificada verbatim).

> **Fila oficial:** `Colombia | Predictive Traffic | Yes | Yes | SouthAmerica`
> (columnas: País | Fuente de datos de velocidad | Incidentes de tráfico | Atributos de logística | Región)

`Predictive Traffic` es la categoría más alta de las que documenta Esri para esta tabla (por encima de solo histórico o sin tráfico) — implica datos históricos, en vivo, y predictivos disponibles para Colombia a nivel país. Incidentes de tráfico también están disponibles (`Yes`). **Esto es evidencia oficial suficiente para justificar intentar Parte A** — no elimina la posibilidad de que la densidad de sensores/proveedores sea menor en vías secundarias de Itagüí que en las principales de Medellín, algo que la tabla país-nivel no puede confirmar ni descartar; el UAT físico (Fase 7 del milestone) es el mecanismo correcto para validar la calidad real percibida en las rutas del portal.

## Costo/cuota de tráfico en ruteo (Parte A)

Fuente: `location.arcgis.com/pricing/` (página oficial de precios de ArcGIS Location Platform) + `developers.arcgis.com` (documentación de servicios de ruteo).

- La página de precios **no menciona** tráfico, `startTime`, ni una tarifa separada para ruteo con tráfico en ningún lugar de la sección de ruteo.
- La facturación documentada para el servicio de ruteo se basa en **el número de rutas devueltas** por `solve`/`submitJob` — sin distinción de si la ruta llevó `startTime`/tráfico.
- Confianza: **MEDIA** — es evidencia por ausencia (no se encontró un cargo separado en fuentes públicas), no una declaración explícita de Esri de "el tráfico no tiene costo adicional". Se recomienda que el plan trate esto como "sin evidencia de costo adicional, mismo conteo de rutas del plan gratuito de 20.000/mes" y no como una garantía contractual.

## Capa visual — Traffic Map Service (Parte B)

Fuente primaria: `developers.arcgis.com/rest/routing/traffic-service/` (documentación oficial del servicio).

| Aspecto | Hallazgo | Confianza |
|---|---|---|
| Endpoint | `https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer` — Map Service **dinámico** (no teselas cacheadas), con capas regionales (Norteamérica, Sudamérica, Europa, etc.) para velocidades, incidentes (3 niveles de detalle) y cierres (3 niveles) | ALTA — endpoint y estructura confirmados en docs oficiales |
| Actualización | Cada 5 minutos; datos predictivos hasta 1 hora hacia adelante | ALTA |
| Autenticación | Requiere token de organización autenticado (mismo patrón que el basemap ya proxied vía `backend/src/routes/mapa.js`) | MEDIA — inferido del patrón general de contenido premium/Living Atlas de Esri, no una cita textual específica de este servicio |
| Costo | Contenido "subscriber" de Living Atlas — no consume créditos de ArcGIS Online según fuentes secundarias, pero **no se encontró una confirmación oficial primaria específica para este servicio** | BAJA-MEDIA — requiere confirmación directa (soporte Esri o prueba real con la cuenta de la organización) antes de comprometer una decisión de costo en el plan |
| Compatibilidad con MapLibre GL | Documentación oficial solo describe consumo vía "ArcGIS Maps SDK for JavaScript" y SDKs nativos. Un Map Service dinámico **puede técnicamente** añadirse a MapLibre como fuente `raster` construyendo URLs de `export` por tile/viewport (patrón usado por Esri-Leaflet para MapServers dinámicos con Leaflet, que a su vez puede apoyarse en MapLibre GL internamente para vector tiles) — pero esto es un patrón DIY, no documentado ni soportado oficialmente para consumo fuera del ecosistema Esri | MEDIA — la posibilidad técnica está razonablemente fundamentada, pero no hay un ejemplo oficial de "Traffic Map Service + MapLibre GL puro" |
| Impacto en red/batería | Al ser un servicio dinámico (no teselas cacheadas), cada pan/zoom implica una nueva petición de imagen `export`, sin el aprovechamiento de caché de un servicio de teselas — impacto de red/batería mayor que el basemap vectorial ya usado, especialmente relevante en el contexto de navegación GPS activa donde la cámara se mueve constantemente | ALTA (razonamiento directo desde la naturaleza confirmada del servicio, no una cita) |
| Atribución | Esri exige mostrar "Powered by Esri" en cualquier app que use tecnología/contenido de ArcGIS, más atribución de los proveedores de datos subyacentes (ej. TomTom aparece mencionado como proveedor de feeds de tráfico en documentación de ArcGIS Pro) | MEDIA-ALTA — el requisito general de atribución de Esri está bien documentado; el proveedor exacto de datos para Colombia específicamente no se confirmó |

**Conclusión de viabilidad para Parte B:** No hay evidencia de que mostrar la capa visual *requiera* migrar al ArcGIS Maps SDK — existe un camino técnico (raster dinámico vía `export`) que respeta la restricción dura del milestone. Pero ese camino: (a) no está oficialmente documentado/soportado para MapLibre, (b) tiene peor rendimiento que un servicio de teselas cacheado, (c) tiene costo/cuota sin confirmar oficialmente, y (d) su compatibilidad "razonable" con MapLibre (pedida como criterio de éxito en el ROADMAP) es dudosa en la práctica dado el patrón de petición por viewport. El plan de esta fase debe documentar esto como el hallazgo principal de Parte B y dejar la decisión de construir o no un prototipo (detrás de feature flag) a criterio explícito registrado en el plan, no implementarlo por defecto.

</coverage_and_cost>

<common_pitfalls>
## Riesgos y trampas para el plan

### Riesgo 1: Asumir que "Driving Time" ya tiene impedancia de tráfico sin verificar
**Qué puede salir mal:** El plan agrega `startTime=now` asumiendo que el modo activo ya usa `TravelTime`, pero la organización personalizó el travel mode con otro impedance — el tráfico nunca se aplica y el campo `traficoAplicado` reporta `true` de forma incorrecta (falso positivo, viola D-03).
**Cómo evitarlo:** Inspeccionar el objeto `travelMode` completo (no solo el nombre) devuelto por `obtenerModos()`/`elegirModo()` en cada resolución, y condicionar `traficoAplicado` a que `impedanceAttributeName` sea realmente `TravelTime` (o el valor que confirme tráfico).
**Señal de alerta:** `traficoAplicado: true` en la respuesta pero tiempos de ruta idénticos a los de antes de este cambio en pruebas repetidas a distintas horas del día.

### Riesgo 2: Enviar `travelMode` y `impedanceAttributeName` de nivel superior a la vez, esperando que el segundo gane
**Qué puede salir mal:** `travelMode` sobreescribe el `impedanceAttributeName` top-level — si el plan intenta forzar tráfico agregando `impedanceAttributeName=TravelTime` como parámetro suelto sin tocar el objeto `travelMode`, no tendrá efecto.
**Cómo evitarlo:** Si se necesita forzar el impedance, debe modificarse dentro del objeto `travelMode` antes de serializarlo, no como parámetro hermano.
**Señal de alerta:** El parámetro se envía (visible en logs/petición) pero el comportamiento de la ruta no cambia con distintos `startTime`.

### Riesgo 3: Sobre-comprometer la Parte B como "fácil" por tener un endpoint REST identificado
**Qué puede salir mal:** Ver que existe `traffic.arcgis.com/.../MapServer` puede llevar a subestimar el esfuerzo — es un Map Service dinámico sin patrón MapLibre oficial, con implicancias de rendimiento reales, no un simple `raster` source con URL fija de teselas.
**Cómo evitarlo:** El plan debe tratar la implementación de Parte B (si se decide hacer) como un spike/prototipo explícito detrás de feature flag, no como una tarea de "agregar una capa más" de complejidad equivalente al basemap.
**Señal de alerta:** Un task de plan que estima la Parte B con el mismo esfuerzo que agregar un layer GeoJSON estático.

</common_pitfalls>

<open_questions>
## Open Questions

1. **¿El travel mode "Driving Time" de ESTA organización específica (la que usa el proyecto) tiene realmente `impedanceAttributeName: "TravelTime"`?**
   - Qué sabemos: Es el valor por defecto estándar de Esri para ese nombre de travel mode.
   - Qué no está claro: Si el administrador de la organización lo personalizó al crear las credenciales del proyecto.
   - Recomendación: El plan debe incluir un paso de verificación en runtime (loggear/inspeccionar el JSON completo del modo elegido) antes de confiar en el campo `traficoAplicado`. Puede hacerse en desarrollo con una llamada de prueba a `GetTravelModes`/`NAServer` y revisando el campo manualmente.

2. **¿Cuál es el costo/cuota EXACTO y confirmado oficialmente del Traffic Map Service para consumo en producción (créditos por request, tier de licencia, límite de requests)?**
   - Qué sabemos: Es contenido de tipo "subscriber"/Living Atlas; fuentes secundarias sugieren que no consume créditos pero sí requiere login de organización.
   - Qué no está claro: No hay una cita oficial primaria específica de Esri confirmando el modelo de costo exacto para este servicio en particular (a diferencia del ruteo, cuya facturación por ruta sí está documentada).
   - Recomendación: Antes de comprometer cualquier implementación de Parte B, confirmar directamente con la cuenta/soporte de ArcGIS de la organización, o hacer una prueba controlada de bajo volumen y monitorear el consumo de créditos real.

3. **¿Qué tan bien funciona en la práctica un raster dinámico vía `export` de MapServer sobre MapLibre GL, en términos de latencia/UX durante navegación activa (cámara moviéndose constantemente)?**
   - Qué sabemos: Es técnicamente posible construir una fuente raster con peticiones `export` por viewport; no es el patrón de teselas cacheadas que Esri documenta oficialmente para consumo con SDKs de terceros.
   - Qué no está claro: El comportamiento real de latencia/parpadeo en un mapa que se mueve constantemente (navegación GPS), a diferencia de un mapa estático de exploración.
   - Recomendación: Si el usuario del milestone decide seguir adelante con un prototipo de Parte B, tratarlo como un spike aislado y medido antes de comprometerlo como funcionalidad estable, y evaluar si limitarlo al modo de previsualización (mapa estático) en vez de a la navegación activa.

4. **¿Cuál es el proveedor exacto de datos de tráfico/atribución requerida para Colombia específicamente?**
   - Qué sabemos: TomTom aparece mencionado como proveedor de feeds de tráfico en documentación general de Esri; el requisito general de "Powered by Esri" + atribución de fuente de datos aplica siempre.
   - Qué no está claro: El proveedor específico para la región de Sudamérica/Colombia.
   - Recomendación: Si se implementa Parte B, verificar el texto de atribución exacto que devuelve el propio servicio (los Map Services de Esri suelen incluir `copyrightText` en su respuesta de metadatos `?f=json`) y usarlo literalmente, en vez de asumir un proveedor.

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- https://developers.arcgis.com/rest/routing/route-service-direct/ — parámetros `impedanceAttributeName`, `accumulateAttributeNames`, `startTime`, `startTimeIsUTC`, `travelMode` del endpoint `/solve`
- https://developers.arcgis.com/rest/routing/network-coverage/ — tabla oficial de cobertura de red por país (fila de Colombia citada verbatim)
- https://developers.arcgis.com/rest/routing/traffic-service/ — documentación oficial del Traffic Map Service (endpoint, capas, actualización cada 5 min, consumo vía SDKs de Esri)
- https://location.arcgis.com/pricing/ — página oficial de precios de ArcGIS Location Platform (ausencia de cargo diferenciado por tráfico)

### Secondary (MEDIUM confidence)
- WebSearch de resultados oficiales de Esri Developer sobre "Driving Time" travel mode y su `impedanceAttributeName` por defecto (`TravelTime`) — no se pudo abrir la página fuente completa de `retrieve-travel-modes`/`gettravelmodes-tool` para cita verbatim, pero el hallazgo es consistente entre múltiples resultados de búsqueda sobre documentación oficial
- Esri Community / documentación general sobre consumo de vector tile services de Esri en Leaflet/MapLibre (esri-leaflet-vector) — confirma que Esri publica contenido en Web Mercator consumible por MapLibre GL en general, pero no específicamente el Traffic Map Service (que es un Map Service dinámico, no un vector tile service)
- Búsqueda sobre créditos de ArcGIS Online y contenido "Living Atlas subscriber" (traffic service, live feeds) no consumiendo créditos — de una fuente curada de terceros ("Awesome ArcGIS"), no de la documentación oficial de precios directamente

### Tertiary (LOW confidence - needs validation)
- Privilegio/licencia exacta requerida para el Traffic Map Service específicamente (distinta del privilegio general `premium:user:networkanalysis` ya usado para ruteo) — no confirmado con una fuente primaria específica del servicio de tráfico
- Proveedor de datos de tráfico exacto para Colombia (TomTom u otro) — mencionado en contexto general de Esri, no confirmado para esta región específica

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: ArcGIS REST API — Network Analysis (`/solve`) y Traffic Map Service
- Ecosystem: ArcGIS Location Platform pricing/credits, cobertura de red por país, Living Atlas
- Patterns: Consumo de contenido Esri (raster/vector) desde MapLibre GL fuera del SDK de JavaScript de Esri
- Pitfalls: Sobreescritura de `impedanceAttributeName` por `travelMode`; sobre-simplificación de la Parte B

**Confidence breakdown:**
- Parámetros del `/solve` para tráfico (Parte A): ALTA — citas directas de documentación oficial
- Cobertura Colombia: ALTA — fila oficial citada verbatim
- Costo del ruteo con tráfico: MEDIA — evidencia por ausencia, no confirmación explícita
- Traffic Map Service (endpoint, estructura, actualización): ALTA
- Costo/privilegio del Traffic Map Service: BAJA-MEDIA — requiere confirmación directa antes de comprometer implementación
- Compatibilidad práctica con MapLibre GL: MEDIA — posible en teoría, sin patrón oficial ni validación de rendimiento real

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (30 días — es documentación de servicio estable de Esri, pero precios/privilegios pueden cambiar sin aviso amplio)

</metadata>

---

*Phase: 06-Tráfico ArcGIS*
*Research completed: 2026-09-01*
*Ready for planning: yes — con las verificaciones de runtime y confirmaciones pendientes explícitamente marcadas en `<open_questions>` trasladadas al plan como pasos de verificación, no como bloqueos*
