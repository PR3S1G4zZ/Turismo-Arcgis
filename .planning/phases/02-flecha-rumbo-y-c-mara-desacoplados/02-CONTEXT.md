# Phase 2: Flecha, rumbo y cámara desacoplados - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Desacoplar el modelo de navegación en tiempo real para que posición GPS,
rumbo de movimiento, rumbo de brújula, rotación de flecha, bearing del mapa y
seguimiento de cámara sean señales explícitas e independientes. Un gesto del
usuario debe pausar únicamente el recentrado/rotación de la cámara; el GPS, el
progreso sobre la ruta, el recálculo y la orientación de la flecha deben seguir
actualizándose. La fase cubre NAV-01, NAV-02, NAV-03 y NAV-04, sin cambiar el
proveedor ArcGIS, MapLibre ni la geometría cruda de la ruta.

</domain>

<decisions>
## Implementation Decisions

### Propiedad de los estados
- **D-01:** Representar las seis señales por separado, sin usar un mismo booleano para significar confianza GPS y seguimiento de cámara. `useGeolocation` conserva la posición aceptada y el rumbo de movimiento (GPS o deducido); `useOrientacion` conserva el rumbo de brújula y el permiso; `useNavegacion` conserva estado de ruta, progreso y recálculo; el mapa deriva/gestiona rotación de flecha, bearing del mapa y seguimiento. El gesto solo puede cambiar el seguimiento de cámara. La solución debe conservar nombres explícitos en el contrato interno o derivado aunque se reorganice la implementación local. — **Reversibility:** costly — el contrato conecta hooks, contexto y `InteractiveMap`, por lo que deshacerlo después de que las pruebas y la Fase 1 se apoyen en él tocaría varios consumidores.
- **D-02:** GPS, progreso y recálculo no deben depender de `siguiendo`, `enSeguimiento` ni de la disponibilidad de la cámara. La entrada/salida de una sesión de navegación puede restaurar el seguimiento por defecto, pero una pausa manual no puede reiniciar ni detener listeners o el bucle GPS.

### Precedencia de fuentes de rumbo
- **D-03:** En movimiento, la fuente prioritaria es el rumbo GPS válido o el rumbo deducido entre fijaciones GPS aceptadas. Detenido o a baja velocidad, la fuente preferida es una lectura de brújula fresca y autorizada. Si no existe una fuente válida para la condición actual, usar la tangente local de la ruta como respaldo visual mediante la geometría compartida; no inventar coordenadas ni alterar la geometría de verdad.
- **D-04:** La selección de fuente de rumbo es independiente del seguimiento de cámara. Una flecha debe seguir teniendo rumbo válido aunque el usuario no haya pulsado "Centrar en mí"; la falta de GPS, la falta de permiso de brújula y la ruta sin tangente válida se representan como ausencia de rumbo, no como un cambio de estado de navegación.

### Flecha relativa al viewport y gesto de cámara
- **D-05:** La rotación visual de la flecha se calcula respecto al bearing actual del viewport y se normaliza circularmente: rumbo de la fuente menos bearing del mapa. En course-up, el bearing acompaña al rumbo y la flecha queda apuntando hacia arriba; cuando el usuario pausa la cámara, el mapa deja de recentrarse/rotar y la flecha continúa actualizándose contra el bearing que quedó visible.
- **D-06:** Corregir el acoplamiento concreto en `InteractiveMap.jsx` alrededor de las líneas 354-360: la pausa de cámara no puede suprimir el cálculo de rotación de la flecha. `Centrar en mí` solo vuelve a activar la cámara y consume el último estado GPS/orientación; no es un requisito previo para que la flecha se oriente correctamente.

### Suavizado, listeners y rendimiento
- **D-07:** Reutilizar el suavizado circular seno/coseno de `geoRuta.js` para que 359°→0° siga el arco corto y no oscile. Mantener los valores de sensor en refs cuando no sea necesario renderizar, y no introducir un debounce que agregue retraso perceptible. Las actualizaciones deben poder cumplir rumbo válido→flecha p95 <250 ms y posición aceptada→cámara p95 <500 ms.
- **D-08:** La suscripción de orientación debe ser idempotente y tener cleanup simétrico al desmontar. Se pueden conservar `deviceorientationabsolute` y `deviceorientation` como compatibilidad/fallback, pero una lectura equivalente no debe procesarse dos veces ni crear listeners adicionales por render, permiso o cambio de estado. El GPS debe conservar un único `watchPosition` activo por ciclo de vida.
- **D-09:** La validación de latencias usará la instrumentación `performance.mark()`/`performance.measure()` dev-only definida en la Fase 1, sin HUD nuevo, coordenadas, recorridos ni tokens en logs o artefactos. La planificación debe contemplar pruebas de wrap circular, precedencia de fuentes, flecha con cámara pausada, recentrado y montaje/desmontaje de listeners.

### Secuenciación y límites heredados
- **D-10:** La Fase 2 depende de la Fase 1. El plan debe aplicarse sobre las versiones de `InteractiveMap.jsx` y `useNavegacion.js` después de que la instrumentación de Fase 1 esté mergeada; las líneas actuales son puntos de orientación, no anclas rígidas.
- **D-11:** Mantener ArcGIS World Route como proveedor principal, OSRM como respaldo, MapLibre GL como renderer y la geometría cruda de ArcGIS como fuente de verdad para map matching/progreso. La lógica de proyección debe converger en `geoRuta.js`; no duplicarla en el componente del mapa.

### the agent's Discretion
- La forma concreta de exponer el modelo derivado (campos adicionales del contexto, hook auxiliar o funciones puras) queda a criterio del planificador, siempre que respete las responsabilidades y dependencias anteriores.
- El umbral exacto de baja velocidad, la ventana de frescura de brújula y el factor/ritmo de actualización pueden ajustarse con evidencia del código y de las métricas de Fase 1; no deben romper la precedencia acordada ni las metas p95.
- El mecanismo de deduplicación entre eventos de orientación puede elegir la combinación compatible más pequeña que funcione en Android Chrome e iPhone Safari, con pruebas de listeners y cleanup.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto del milestone y requisitos
- `.planning/PROJECT.md` — alcance, restricciones de ArcGIS/MapLibre, privacidad, dependencia de Fase 1 y hallazgo de `InteractiveMap.jsx`.
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02, NAV-03 y NAV-04; trazabilidad y límites fuera de alcance.
- `.planning/ROADMAP.md §Phase 2` — goal, dependencia, criterios de éxito y número de requisitos de esta fase.
- `.planning/phases/01-diagn-stico-e-instrumentaci-n/01-CONTEXT.md` — decisiones de diagnóstico, instrumentación dev-only y puntos de anclaje de la fase previa.

### Arquitectura y convenciones
- `.planning/codebase/ARCHITECTURE.md §Anti-Patterns — Duplicate Route Projection Logic` — `InteractiveMap.jsx` y `geoRuta.js` no deben mantener proyecciones divergentes.
- `.planning/codebase/CONVENTIONS.md` — nombres, hooks, refs, comentarios y pruebas en JavaScript/JSX en español.
- `.planning/codebase/STRUCTURE.md` — ubicación de componentes, hooks, utilidades y pruebas frontend.
- `.planning/codebase/STACK.md` — React/Vite, MapLibre/react-map-gl, Vitest/jsdom y APIs de navegador disponibles.

### Implementación actual y contratos de prueba
- `frontend/src/componentes/detalle/InteractiveMap.jsx` — cámara, gesto, `rotationAlignment="viewport"`, marcador y hallazgo de rotación alrededor de ~354-360.
- `frontend/src/componentes/detalle/InteractiveMap.test.jsx` — mocks de MapLibre y pruebas de cámara, pausa por gesto, recentrado y lifecycle.
- `frontend/src/hooks/useNavegacion.js` — estado de navegación, consumo de GPS, progreso, recálculo y contrato expuesto al contexto.
- `frontend/src/hooks/useNavegacion.test.js` — pruebas del hook y del origen/estado de preview.
- `frontend/src/hooks/useGeolocation.js` — watch GPS, aceptación de fijaciones, rumbo deducido, smoothing y permiso.
- `frontend/src/hooks/useGeolocation.test.js` — política de watch, fijaciones obsoletas y confianza GPS.
- `frontend/src/hooks/useOrientacion.js` — permiso iOS, listeners de orientación y smoothing de brújula.
- `frontend/src/utilidades/geoRuta.js` — rumbo, `suavizarRumbo`, proyección y geometría compartida de ruta.
- `frontend/src/utilidades/geoRuta.test.js` — contratos existentes de rumbo y proyección.

No hay una especificación externa: los requisitos del milestone y las referencias anteriores son la fuente canónica.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/hooks/useGeolocation.js`: ya acepta fijaciones confiables, deduce rumbo cuando el GPS no entrega `coords.heading`, suaviza con `suavizarRumbo` y expone `gpsConfiable`/`ultimaActualizacion`.
- `frontend/src/hooks/useOrientacion.js`: ya encapsula permiso de DeviceOrientation, conversión iOS/Android y cleanup; requiere hacer explícito el fallback/deduplicación.
- `frontend/src/utilidades/geoRuta.js`: contiene `rumbo`, `suavizarRumbo`, proyección de posición y datos acumulados para obtener una tangente sin duplicar geometría.
- `frontend/src/componentes/detalle/InteractiveMap.test.jsx`: mock de mapa con `easeTo`, `getBearing`, eventos de gesto y botón de recentrado reutilizable para NAV-02/NAV-03.

### Established Patterns
- React Context + hooks: `useNavegacion` es el motor de GPS/progreso y `InteractiveMap` es la capa MapLibre/cámara.
- Refs y callbacks estables se usan para evitar re-suscripciones; los efectos tienen cleanup explícito.
- El mapa usa `rotationAlignment="viewport"`; la posición animada es solo visual y no debe retrasar el progreso ni la cámara.
- Vitest + Testing Library/jsdom son el patrón de pruebas frontend; comentarios y strings nuevos deben estar en español.

### Integration Points
- `useGeolocation` → `useNavegacion` → `NavegacionContext` → `InteractiveMap` es la cadena de datos de posición, progreso y orientación.
- `InteractiveMap` integra los gestos MapLibre, el bearing actual, `easeTo` course-up y el botón `Centrar en mí`.
- Fase 1 instrumentará puntos en `useGeolocation.js`, `useOrientacion.js`, `useNavegacion.js` e `InteractiveMap.jsx`; Fase 2 debe conservar esos puntos o moverlos sin perder las seis mediciones.

</code_context>

<specifics>
## Specific Ideas

- El hallazgo concreto a corregir es que `InteractiveMap.jsx` condiciona la rotación de la flecha a `!enSeguimiento` en lugar de separar el estado de cámara `!siguiendo`; al pausar con un gesto la flecha queda fija aunque el mapa ya no rote.
- La métrica de éxito debe observar el rumbo y la cámara como salidas independientes, incluida la transición circular 359°→0° y el caso en que el usuario no pulsa "Centrar en mí".

</specifics>

<deferred>
## Deferred Ideas

None — la discusión se mantuvo dentro de NAV-01 a NAV-04. La lógica adaptativa de desvíos/recálculo, fidelidad geométrica, Wake Lock, tráfico, endurecimiento general y UAT físico pertenecen a fases posteriores.

</deferred>

---

*Phase: 2-Flecha, rumbo y cámara desacoplados*
*Context gathered: 2026-09-01*
