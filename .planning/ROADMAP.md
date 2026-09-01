# Roadmap: Turismo Itagüí — Navegación Móvil ArcGIS

## Overview

Este milestone endurece la navegación en tiempo real ya existente (GPS, flecha, cámara, recálculo, geometría de ruta) sin tocar su arquitectura base: ArcGIS sigue como proveedor principal de rutas, MapLibre GL sigue como librería de mapa, y la geometría cruda de ArcGIS sigue siendo la fuente de verdad. El recorrido empieza midiendo dónde se origina realmente el retraso percibido (~3 s) y auditando qué ya resolvió el ciclo previo mergeado (`codex/map-navigation-reliability`, PR #5) — sin volver a diagnosticar desde cero. A partir de esa evidencia, se desacoplan los estados de flecha/rumbo/cámara, se rediseña la detección de desvíos con histéresis en vez de bajar umbrales a ciegas, se verifica la fidelidad geométrica de curvas y rotondas contra el pipeline real, se añade Wake Lock para mantener la pantalla activa, se investiga tráfico ArcGIS (ruteo y capa visual) detrás de evidencia y feature flag, y cierra con endurecimiento de pruebas y UAT físico en dispositivos reales.

## Phases

**Phase Numbering:**

- Fases enteras (0, 1, 2…): trabajo de milestone planificado, numeradas exactamente como las especificó el responsable del milestone (Phase 1 a Phase 7)
- Fases decimales (2.1, 2.2): inserciones urgentes (marcadas con INSERTED)

- [ ] **Phase 1: Diagnóstico e instrumentación** - Medir dónde se origina el retraso percibido y auditar qué ya resolvió PR #5 antes de re-instrumentar
- [ ] **Phase 2: Flecha, rumbo y cámara desacoplados** - Estados independientes de GPS/rumbo/brújula/flecha/cámara; un gesto pausa solo la cámara
- [ ] **Phase 3: Desvíos y recálculo adaptativo** - Detección de desvío con histéresis multi-señal; sin recortar umbrales sin analizar por qué existen
- [ ] **Phase 4: Fidelidad de curvas y rotondas** - Verificar el pipeline geométrico real antes de tocar el renderizado; geometría cruda como fuente de verdad
- [ ] **Phase 5: Mantener la pantalla activa** - Screen Wake Lock aislado, con reintento tras segundo plano y degradación segura
- [ ] **Phase 6: Tráfico ArcGIS** - Ruteo sensible al tráfico en auto + investigación de capa visual detrás de feature flag (requiere `--research`)
- [ ] **Phase 7: Endurecimiento y UAT** - Suite de pruebas en verde + UAT físico en Android Chrome e iPhone Safari

## Phase Details

### Phase 1: Diagnóstico e instrumentación

**Goal**: Ubicar exactamente dónde se origina el retraso percibido de navegación (~3 s) y auditar qué de los síntomas reportados ya quedó resuelto por el ciclo previo mergeado (`codex/map-navigation-reliability`, PR #5) antes de instrumentar o re-diagnosticar desde cero.
**Depends on**: Nothing (first phase)
**Requirements**: DIAG-01, DIAG-02
**Success Criteria** (what must be TRUE):

  1. Existe una tabla de latencias (instrumentación solo de desarrollo, sin coordenadas registradas) con las 6 mediciones internas por separado: GPS aceptado→marcador, orientación→rotación de flecha, GPS aceptado→actualización de cámara, desvío detectado→solicitud de recálculo, solicitud→respuesta ArcGIS, respuesta→ruta renderizada — medida en al menos un Android real (iPhone si hay dispositivo disponible)
  2. Existe un informe de causa raíz por cada retraso identificado, clasificándolo como interno al código (umbral de 3 lecturas, espera entre recálculos, suavizado de rumbo, interpolación de marcador, duración de `easeTo`) o dependiente del sensor/plataforma (frecuencia real de `watchPosition`, disponibilidad de `coords.heading`, diferencias Android/iOS/desktop)
  3. Existe una auditoría documentada de qué síntomas reportados ya quedaron resueltos por PR #5 antes de escribir código nuevo, evitando redescubrir o reimplementar fixes ya mergeados

**Plans**: 5 plans
Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Utilidad diagnosticoLatencias + tracer del tramo "solicitud→respuesta ArcGIS" + tramo "desvío→solicitud"
- [ ] 01-02-PLAN.md — Auditoría documental PR #5 (tabla síntoma→commit→estado) + esqueleto de 01-DIAGNOSIS.md

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-03-PLAN.md — Marcas de arranque GPS/orientación (useGeolocation.js, useOrientacion.js)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — Extremos finales de latencia en InteractiveMap.jsx (marcador, flecha, cámara, ruta renderizada)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — Build de captura + instrucciones físicas + checkpoint humano + síntesis del informe

### Phase 2: Flecha, rumbo y cámara desacoplados

**Goal**: Modelo explícito con estados independientes — posición GPS, rumbo de movimiento, rumbo de brújula, rotación de la flecha, bearing del mapa, seguimiento de cámara activo/pausado — donde un gesto del usuario pausa únicamente la cámara, nunca el GPS, el progreso, el recálculo ni la orientación de la flecha.
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):

  1. En movimiento la flecha usa el rumbo GPS como fuente prioritaria; detenido o a baja velocidad usa la brújula si está autorizada; si ninguno está disponible, se evalúa la tangente local de la ruta como respaldo visual
  2. Al pausar la cámara con un gesto del usuario, la flecha sigue rotando de forma relativa al viewport en vez de quedar congelada (corrige `InteractiveMap.jsx` ~354-360, que condiciona la rotación a `!enSeguimiento` en vez de `!siguiendo`); "Centrar en mí" reactiva la cámara pero no es requisito para que la flecha se oriente correctamente
  3. El salto circular 359°→0° no produce oscilaciones visibles al cruzar el norte
  4. Latencia interna rumbo válido→renderizado de flecha p95 < 250 ms; posición GPS aceptada→actualización de cámara p95 < 500 ms
  5. No hay listeners duplicados ni fugas de memoria al montar/desmontar el componente de mapa

**Plans**: TBD

### Phase 3: Desvíos y recálculo adaptativo

**Goal**: Detección de desvío basada en distancia a la ruta, precisión GPS, velocidad, persistencia temporal, dirección de desplazamiento e histéresis (para evitar entrar/salir de "desviado" en falso) — sin reducir a ciegas los umbrales existentes (3 lecturas / 15 s) sin analizar antes por qué existen.
**Depends on**: Phase 2
**Requirements**: RECALC-01, RECALC-02
**Success Criteria** (what must be TRUE):

  1. Existe un análisis documentado de por qué existen los umbrales actuales (3 lecturas / 15 s) antes de modificar cualquiera de ellos
  2. Un salto GPS aislado (incoherente con precisión, velocidad o dirección de desplazamiento) no dispara recálculo
  3. Un desvío coherente y de alta precisión, una vez confirmado, inicia la solicitud de recálculo sin esperar un retardo artificial fijo adicional
  4. Las respuestas de recálculo obsoletas se cancelan o ignoran cuando ya existe una solicitud más reciente en curso
  5. Se mantienen los límites de coste (rate limiting) y la protección contra bucles de recálculo; los estados "desvío detectado", "recálculo solicitado" y "ruta aplicada" quedan claramente diferenciados

**Plans**: TBD

### Phase 4: Fidelidad de curvas y rotondas

**Goal**: Antes de tocar el renderizado, capturar una ruta problemática real (rotonda/curva de Itagüí) y comparar las 5 etapas del pipeline geométrico — respuesta cruda de ArcGIS, respuesta cruda de OSRM si intervino, puntos normalizados por el backend, GeoJSON entregado a MapLibre, resultado visual — manteniendo la geometría cruda de ArcGIS como fuente de verdad para map matching, progreso y detección de desvíos.
**Depends on**: Phase 3
**Requirements**: GEOM-01, GEOM-02
**Success Criteria** (what must be TRUE):

  1. Existe una comparación documentada de las 5 etapas del pipeline para al menos una rotonda/curva real de Itagüí, capturada antes de cualquier cambio de renderizado
  2. Se confirma que ArcGIS es el proveedor activo, que `esriNAOutputLineTrueShape` está en uso, y que no se pierden puntos ni se simplifica de forma no intencional durante la normalización del backend
  3. Las rotondas y curvas se muestran visualmente sin cortar esquinas, separadores ni edificios, y sin abandonar la calzada, validado contra al menos una rotonda real de Itagüí
  4. El map matching, el progreso y la detección de desvío siguen usando la geometría original sin alteración — cualquier mejora aplicada (casing, ancho de línea, opacidad, transiciones por zoom, o densificación visual si la geometría cruda resulta genuinamente escasa) es solo de representación, nunca del trazado lógico

**Plans**: TBD

### Phase 5: Mantener la pantalla activa

**Goal**: Hook/servicio aislado que usa la Screen Wake Lock API para mantener la pantalla encendida durante la navegación activa, con liberación correcta, reintento tras volver de segundo plano, y degradación segura sin soporte del navegador.
**Depends on**: Phase 4
**Requirements**: WAKE-01
**Success Criteria** (what must be TRUE):

  1. El bloqueo de pantalla (`navigator.wakeLock.request("screen")`) se solicita al iniciar la navegación activa y se libera al llegar, cancelar, fallar o desmontar la vista de navegación
  2. El bloqueo se vuelve a solicitar automáticamente cuando `document.visibilityState` regresa a `visible` tras un paso por segundo plano, y se detectan liberaciones iniciadas por el sistema
  3. En navegadores sin soporte de Wake Lock API o con el permiso denegado, la navegación sigue funcionando sin errores visibles (degradación segura, sin trucos ocultos de video sin aprobación explícita)
  4. Si no se puede evitar que la pantalla se apague, se informa al usuario de forma discreta

**Plans**: TBD

### Phase 6: Tráfico ArcGIS

**Goal**: Parte A (ruteo sensible al tráfico) — solo para modo automóvil, verificar el uso de `TravelTime` y evaluar `startTime=now` donde haya disponibilidad de tráfico en vivo, manteniendo el modo peatonal sin tráfico. Parte B (capa visual) — investigar el ArcGIS Traffic Map Service (velocidades, congestión, incidentes, cierres) detrás de un feature flag; si mostrar la capa exige migrar al ArcGIS Maps SDK, esa migración queda explícitamente fuera de alcance de esta fase y requiere ADR + comparación técnica + aprobación humana por separado.
**Depends on**: Phase 5
**Requirements**: TRAFFIC-01, TRAFFIC-02
**Success Criteria** (what must be TRUE):

  1. La respuesta normalizada de ruteo indica si se solicitó tráfico, si estuvo disponible, y qué proveedor calculó la ruta — aplicado solo a modo automóvil; el modo peatonal permanece sin tráfico
  2. Cuando no hay cobertura o permiso de tráfico, la degradación es clara y visible en la respuesta, sin fallos silenciosos
  3. Existe una investigación documentada del ArcGIS Traffic Map Service — cobertura real en Itagüí/Colombia, autenticación/privilegios, costo/cuota, atribución, compatibilidad razonable con MapLibre, e impacto en red/batería/legibilidad
  4. Si se implementa la capa visual, queda detrás de un feature flag y no asume ni ejecuta una migración al ArcGIS Maps SDK — esa decisión se deja explícitamente pendiente de un ADR y aprobación humana separados

**Plans**: TBD
**Research**: yes — esta fase requiere investigación previa (`/gsd-plan-phase 6 --research`) por la incertidumbre real sobre cobertura, costo y viabilidad del tráfico ArcGIS antes de comprometer implementación

### Phase 7: Endurecimiento y UAT

**Goal**: Cerrar el milestone con una suite de pruebas automatizadas en verde (rumbo, suavizado circular, histéresis, geometría, ciclo de vida de Wake Lock, contrato backend `startTime=now`) y UAT físico registrado en dispositivos reales, sin guardar coordenadas de las pruebas en ningún artefacto.
**Depends on**: Phase 6
**Requirements**: HARDEN-01, HARDEN-02
**Success Criteria** (what must be TRUE):

  1. Existen pruebas unitarias de rumbo, suavizado circular, histéresis de desvío y geometría; pruebas de componente para seguimiento/recentrado de cámara; pruebas de ciclo de vida de Wake Lock; y pruebas de contrato backend para `startTime=now` y respuestas ArcGIS fallidas/lentas/obsoletas
  2. Build, lint y la suite completa de tests pasan en verde
  3. Existe UAT físico registrado en Android Chrome y, si hay dispositivo disponible, iPhone Safari — a pie y en auto, cubriendo rotonda, calles paralelas, ruta que se cruza a sí misma, pérdida de GPS y regreso desde segundo plano
  4. Ningún artefacto de test, instrumentación o UAT contiene coordenadas personales, recorridos completos ni tokens

**Plans**: TBD

## Progress

**Execution Order:**
Fases ejecutan en orden numérico: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Diagnóstico e instrumentación | 0/TBD | Not started | - |
| 2. Flecha, rumbo y cámara desacoplados | 0/TBD | Not started | - |
| 3. Desvíos y recálculo adaptativo | 0/TBD | Not started | - |
| 4. Fidelidad de curvas y rotondas | 0/TBD | Not started | - |
| 5. Mantener la pantalla activa | 0/TBD | Not started | - |
| 6. Tráfico ArcGIS | 0/TBD | Not started | - |
| 7. Endurecimiento y UAT | 0/TBD | Not started | - |
