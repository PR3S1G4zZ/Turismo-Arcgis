# Fase 1: Diagnóstico e instrumentación — Informe

**Fecha:** 2026-09-01
**Alcance:** Este documento es puramente diagnóstico (D-01/D-02/D-03 de `01-CONTEXT.md`). No corrige comportamiento de navegación en producción — la corrección real de cada hallazgo pendiente vive en la fase que se indica en su fila.

---

## Auditoria PR #5

Auditoría documental (sin reproducción en vivo, decisión D-01) de los 6 commits ya mergeados a `main` que tocan navegación: los 5 de `codex/map-navigation-reliability` (PR #5) más el fix posterior `677a933`. Cada fila se derivó de leer el diff real (`git show <hash>`) del commit, cruzado contra `.planning/codebase/CONCERNS.md` ("Known Bugs") y las metas de Fase 2/3/4 de `.planning/ROADMAP.md`.

| Síntoma | Commit(s) | Estado | Nota |
|---|---|---|---|
| La navegación confiaba en lecturas GPS imprecisas o viejas (posición simulada o caída de más de 5 s tratada igual que una fijación en vivo) | `8f15dd1` | resuelto | Introduce `gpsConfiable` en `useGeolocation.js`: una lectura solo se acepta si `accuracy <= 50 m`, el timestamp es más nuevo que el anterior y su antigüedad es `<= 5000 ms` (`PRECISION_MAXIMA_M`, `EDAD_MAXIMA_EN_VIVO_MS`). El bucle de seguimiento de `useNavegacion.js` y el `enSeguimiento` de `InteractiveMap.jsx` ahora exigen `gpsConfiable && !isSimulated`. Introduce también el estado `previsualizando` para trazar una ruta sin GPS confiable (origen manual/simulado) sin fingir seguimiento en vivo. |
| Progreso de ruta y ETA parecían "atrasados" respecto a la posición real del usuario (~3 s de retraso percibido, síntoma raíz del milestone) | `4cdc635` | resuelto | Elimina `suavizarPosicion()` en `useGeolocation.js`, que aplicaba un promedio ponderado exponencial a la posición cruda antes de exponerla — ese filtro alimentaba tanto la navegación/progreso como la cámara, y era la fuente directa del retraso percibido. Ahora `useNavegacion.js` y la cámara consumen la fijación aceptada sin interpolación; la interpolación visual queda aislada en `usePosicionAnimada` (marcador del mapa, `InteractiveMap.jsx`, `duracionMs = 600`), que ya no afecta progreso ni ETA. También reduce `precisionAlta` a solo `calculando`/`navegando` (antes cualquier estado no-inactivo) y ajusta el watch de `timeout: 10000, maximumAge: 0` a `timeout: 5000, maximumAge: 1000` (fijaciones más frecuentes, sin exigir cero caché). |
| Cámara con race conditions: mapa se inclinaba mal, el bearing se congelaba, o dos animaciones (`easeTo` de navegación y `easeTo`/`fitBounds` de vista informativa) competían al transicionar preview → live → preview | `6673f72` | resuelto | Añade `map.stop()` antes de cada `easeTo`/`fitBounds` nuevo para cancelar animación en curso; separa el efecto de "vista informativa" con `vistaInformativaAplicadaRef` para que se aplique una sola vez y no compita con el seguimiento en vivo; agrega guardas `onRotateStart`/`onPitchStart` (antes solo `onDragStart`) para pausar cámara ante cualquier gesto, no solo arrastre; reduce duraciones de animación de 600/400 ms a 250 ms. Corresponde a "Map Camera Lifecycle Race Conditions" en `CONCERNS.md` (Known Bugs), ahí marcado como ya arreglado. |
| Con el rumbo GPS temporalmente no disponible (`heading` NaN), la cámara dejaba de seguir al usuario por completo en vez de solo no rotar | `bc7b8ad` | resuelto | El efecto de cámara de navegación ya no exige `Number.isFinite(userPosition.heading)` para ejecutarse; si el heading no es finito, conserva el bearing actual (`map.getBearing()`) en vez de abortar todo el `easeTo` (centrado, zoom, pitch seguían sin aplicarse antes de este fix). |
| Estado GPS "obsoleto" no se distinguía visualmente de "en vivo" — el usuario no sabía que el seguimiento se había detenido tras perder señal | `9bb67ef` | resuelto | Extrae `mensajeEstadoGps()` a `frontend/src/componentes/detalle/estadoGps.js`: cuando `!gpsConfiable` o no hay `ultimaActualizacion`, muestra explícitamente "GPS no disponible o fix desactualizado..." en vez de reutilizar el mensaje de "en vivo" con un contador congelado. Corresponde a "GPS Position Staleness Not Clearly Surfaced" en `CONCERNS.md` (Known Bugs), ahí marcado como ya arreglado. Nota residual ya documentada en `CONCERNS.md`: el timeout de 5 s (`EDAD_MAXIMA_EN_VIVO_MS`) es fijo, no configurable — podría leerse como obsoleto en zonas de GPS lento; no es un síntoma reportado nuevo, se deja como está. |
| El progreso de ruta se adelantaba (pintaba como "ya recorrido") cuando la ruta pasa cerca de sí misma más adelante (vuelta a la manzana, calles paralelas) | `677a933` | resuelto | `localizarEnRuta()` en `geoRuta.js` caía a una búsqueda sin ventana (`buscar(0, puntos.length - 1)`) cuando la lectura GPS quedaba a más de 30 m del segmento esperado; eso podía enganchar un índice muy adelantado si la ruta volvía a pasar cerca. La búsqueda de respaldo ahora se limita al mismo `fin` que la ventana normal (`buscar(0, fin)`): sigue recuperando a quien retrocedió mucho, pero un salto hacia adelante más allá de la ventana ahora se trata como desvío real (dispara recálculo) en vez de avance instantáneo. Corresponde a "GPS Route Progress Jumping" en `CONCERNS.md` (Known Bugs), ahí marcado como ya arreglado, con cobertura de test en `geoRuta.test.js` líneas 25-42. |
| Al pausar la cámara con un gesto del usuario durante navegación en vivo, la flecha de dirección queda congelada en vez de seguir rotando relativa al viewport | Ninguno de los 6 auditados | **pendiente** | `InteractiveMap.jsx` línea ~356 condiciona el cálculo de `rotacionFlecha` a `if (!enSeguimiento)` en vez de `if (!enSeguimiento \|\| !siguiendo)`. `enSeguimiento` (línea 256) es `true` mientras se navega con GPS confiable, independientemente de si la cámara está pausada (`siguiendo`, controlado por gestos vía `dejarDeSeguir()`); por diseño, mientras `enSeguimiento` es `true` el mapa rota vía `bearing = heading` (course-up) y la flecha se mantiene en 0° relativo al viewport — eso es correcto solo si la cámara sigue rotando con el usuario. Cuando el usuario pausa la cámara con un gesto (`siguiendo = false`) pero la navegación sigue en vivo (`enSeguimiento` no cambia, sigue `true`), el mapa deja de re-orientarse pero la flecha permanece forzada a 0° en vez de retomar el cálculo relativo al viewport (rumbo GPS/brújula/tangente de ruta). **Causa raíz hipotética:** el guard de la línea 356 nunca se actualizó para distinguir "navegando con cámara activa" de "navegando con cámara pausada por gesto" — ambos casos colapsan a la misma rama porque solo miran `enSeguimiento`. **Fase que corrige:** Fase 2 (NAV-02), ya explícitamente listada en `ROADMAP.md` Success Criteria #2 de esa fase con la misma cita de líneas. |
| Recálculo de ruta usa umbrales fijos (3 lecturas / 15 s) sin histéresis multi-señal; posible sensibilidad a saltos GPS aislados | Ninguno de los 6 auditados | **pendiente** | `useNavegacion.js` mantiene `UMBRAL_DESVIO_M = 45`, `LECTURAS_PARA_RECALCULAR = 3`, `ESPERA_ENTRE_RECALCULOS_MS = 15000` sin cambios en ninguno de los 6 commits auditados; el gate de recálculo sigue siendo solo distancia + conteo de lecturas + tiempo transcurrido, sin considerar precisión GPS, velocidad ni dirección de desplazamiento como señales adicionales. **Causa raíz hipotética:** los umbrales fueron fijados empíricamente sin mecanismo de histéresis que evite oscilar entre "desviado"/"en ruta"; PR #5 se enfocó en confiabilidad de estado GPS y cámara, no en la lógica de desvío en sí. **Fase que corrige:** Fase 3 (RECALC-01, RECALC-02), ya reconocida como pendiente en `CONCERNS.md` ("Fragile Areas" → "Route Deviation and Recalculation Logic") y en `ROADMAP.md` Fase 3 Success Criteria #1 (exige analizar por qué existen los umbrales actuales antes de tocarlos). |
| Fidelidad geométrica de curvas/rotondas (posible corte de esquinas, pérdida de puntos en la normalización) no verificada contra el pipeline real de ArcGIS | Ninguno de los 6 auditados | **pendiente** | Ninguno de los 6 commits toca `geoRuta.js` fuera del fix puntual de `677a933` (búsqueda de progreso), ni el backend de normalización de rutas. **Causa raíz hipotética:** no hay evidencia de un bug concreto todavía — es un riesgo no verificado, no un síntoma confirmado; requiere capturar una ruta real con rotonda/curva de Itagüí y comparar las 5 etapas del pipeline (respuesta cruda ArcGIS → OSRM si intervino → normalización backend → GeoJSON → render MapLibre) antes de tocar renderizado. **Fase que corrige:** Fase 4 (GEOM-01, GEOM-02), ya definida en `ROADMAP.md` con ese alcance exacto.
| Riesgo de condición de carrera en refresco de token ArcGIS bajo carga concurrente (no reportado como síntoma de usuario, hallazgo de código) | Ninguno de los 6 auditados | pendiente (fuera de alcance de navegación) | Ya documentado independientemente en `CONCERNS.md` ("Known Bugs" → "ArcGIS Token Refresh Timing" y "Fragile Areas" → "ArcGIS Token Cache Renewal"). No es un síntoma de navegación reportado por el usuario y no está en el alcance de ninguna fase de este milestone (Fases 1-7 cubren GPS/flecha/cámara/desvíos/geometría/wake lock/tráfico) — se deja anotado aquí solo por completitud de la auditoría, sin asignarle fase de corrección dentro de este milestone. |

**Cierre de la auditoría:** Fase 1 diagnostica; no corrige. Los 6 síntomas marcados "resuelto" ya están mergeados en `main` y no deben redescubrirse ni reimplementarse en fases posteriores. Los 3 síntomas marcados "pendiente" (flecha congelada al pausar cámara, umbrales de recálculo sin histéresis, fidelidad geométrica no verificada) tienen causa raíz hipotética documentada arriba y su corrección real vive en Fase 2, Fase 3 y Fase 4 respectivamente, tal como las definió `ROADMAP.md` antes de este plan. Ningún síntoma quedó en estado "parcial" — cada uno auditado cayó limpiamente en resuelto o pendiente.

---

## Tabla de latencias

Instrumentación pendiente de ejecutar en dispositivo físico (Plan 01-05). Las columnas numéricas se completan ahí; esta tabla es el esqueleto con los 6 tramos exactos exigidos por `ROADMAP.md` Fase 1 Success Criteria #1.

| Tramo | Dispositivo | Mediciones (n) | Promedio (ms) | Mínimo (ms) | Máximo (ms) |
|---|---|---|---|---|---|
| GPS aceptado → marcador actualizado | Android real (pendiente) | pendiente (Plan 01-05) | pendiente | pendiente | pendiente |
| Orientación (brújula/GPS) → rotación de flecha | Android real (pendiente) | pendiente (Plan 01-05) | pendiente | pendiente | pendiente |
| GPS aceptado → actualización de cámara | Android real (pendiente) | pendiente (Plan 01-05) | pendiente | pendiente | pendiente |
| Desvío detectado → solicitud de recálculo | Android real (pendiente) | pendiente (Plan 01-05) | pendiente | pendiente | pendiente |
| Solicitud → respuesta ArcGIS | Android real (pendiente) | pendiente (Plan 01-05) | pendiente | pendiente | pendiente |
| Respuesta → ruta renderizada | Android real (pendiente) | pendiente (Plan 01-05) | pendiente | pendiente | pendiente |

Nota: si hay iPhone disponible (confirmado por el usuario en `01-CONTEXT.md`), Plan 01-05 debe repetir la captura y añadir filas equivalentes por dispositivo. Ninguna medición registra coordenadas (D-04, `01-CONTEXT.md`).

---

## Causa raiz por retraso

Candidatos hipotéticos por tramo, a confirmar o descartar en Plan 01-05 Task 3 una vez existan mediciones reales de dispositivo físico. Cada tramo separa candidatos internos al código (constante o función real del codebase) de candidatos dependientes del sensor/plataforma.

### GPS aceptado → marcador actualizado
- **Interno al código:** `usePosicionAnimada(objetivo, duracionMs = 600)` en `InteractiveMap.jsx` interpola la posición visual del marcador durante 600 ms tras cada fijación aceptada — es la interpolación deliberadamente aislada del progreso/ETA por el fix `4cdc635`, pero sigue siendo una fuente de retraso *visual* del marcador en sí.
- **Sensor/plataforma:** frecuencia real de `watchPosition` (configurado `timeout: 5000, maximumAge: 1000` en `useGeolocation.js`, pero el navegador/SO decide la cadencia real de fijaciones GPS, típicamente 1/s en Android).

### Orientación (brújula/GPS) → rotación de flecha
- **Interno al código:** `suavizarRumbo()` en `useGeolocation.js` (función de suavizado de rumbo, no removida por PR #5) introduce un retraso deliberado para evitar saltos bruscos del rumbo crudo.
- **Sensor/plataforma:** disponibilidad real de `coords.heading` (solo confiable con movimiento, según el comentario en `useGeolocation.js` línea 10) y frecuencia del evento de orientación del dispositivo (`deviceorientation`/brújula) que alimenta `useOrientacion.js` cuando el usuario está detenido.

### GPS aceptado → actualización de cámara
- **Interno al código:** `duration: 250` del `map.easeTo()` de navegación en `InteractiveMap.jsx` (reducido de 600 ms a 250 ms por el fix `6673f72`) es una animación deliberada, no instantánea.
- **Sensor/plataforma:** igual que el primer tramo, la cadencia real de `watchPosition` en el dispositivo físico determina cada cuánto hay una nueva fijación que dispare el `easeTo`.

### Desvío detectado → solicitud de recálculo
- **Interno al código:** `LECTURAS_PARA_RECALCULAR = 3` y `ESPERA_ENTRE_RECALCULOS_MS = 15000` en `useNavegacion.js` son umbrales deliberados que retrasan la solicitud de recálculo hasta confirmar el desvío (evitar falsos positivos por un salto GPS aislado); `UMBRAL_DESVIO_M = 45` determina cuándo empieza a contar el desvío.
- **Sensor/plataforma:** la cadencia de `watchPosition` determina cuánto tarda en acumularse `LECTURAS_PARA_RECALCULAR = 3` lecturas fuera de ruta — con GPS lento, esto solo, sin cambiar el umbral, ya alarga el tramo.

### Solicitud → respuesta ArcGIS
- **Interno al código:** `backend/src/utils/arcgisRouting.js` `solve()` (mencionado en `01-CONTEXT.md` como punto de anclaje) — el tiempo de red/procesamiento del backend antes de llamar a ArcGIS, más el cache/refresh de token (`cacheToken`, `cacheTokenExpira`, líneas 24-63) que puede añadir una llamada OAuth extra si el token expiró.
- **Sensor/plataforma:** latencia de red del dispositivo hacia el backend y del backend hacia el servicio de ArcGIS (fuera del control del código de este repo).

### Respuesta → ruta renderizada
- **Interno al código:** normalización de la geometría cruda de ArcGIS en el backend antes de exponerla como GeoJSON al frontend, más el trabajo de MapLibre GL para pintar la nueva capa de ruta (posible relación con "Duplicate Route Projection Logic" en `ARCHITECTURE.md` §Anti-Patterns, lógica de proyección duplicada entre `InteractiveMap.jsx` y `geoRuta.js`).
- **Sensor/plataforma:** capacidad de renderizado GPU/CPU del dispositivo físico (Android real puede ser sustancialmente más lento que desktop para pintar geometría compleja en MapLibre GL).

**Nota:** la clasificación final (cuál candidato realmente explica el retraso, y en qué proporción) se completa en Plan 01-05 Task 3 una vez existan mediciones reales de dispositivo físico. Ningún valor numérico de latencia real aparece en este documento todavía.

---

*Fase: 1-Diagnóstico e instrumentación*
*Plan: 01-02*
