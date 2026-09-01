# Investigación técnica — Fase 2: flecha, rumbo y cámara desacoplados

**Fecha:** 2026-09-01  
**Requisitos:** NAV-01, NAV-02, NAV-03, NAV-04  
**Alcance:** navegación existente con React, MapLibre y ArcGIS/OSRM sin modificar proveedor, geometría de ruta ni los flujos de fases posteriores.

## Conclusión ejecutiva

El flujo actual ya contiene las piezas principales, pero todavía mezcla una condición de cámara con la representación de rumbo. `useGeolocation` acepta la posición y calcula/deduce el rumbo de movimiento; `useNavegacion` usa esa posición para progreso y recálculo; `InteractiveMap` posee `siguiendo`, los gestos y `easeTo`. Sin embargo, la flecha se calcula solamente cuando `!enSeguimiento`, mientras que un gesto deja `enSeguimiento` verdadero y cambia únicamente `siguiendo`. El resultado es que, durante la pausa manual, la cámara deja de rotar y la flecha queda en 0°.

La Fase 2 debe formalizar seis señales independientes y una derivación explícita: posición GPS aceptada, rumbo de movimiento, rumbo de brújula fresco/autorizado, rumbo elegido para la flecha, bearing actual del viewport y seguimiento de cámara. La rotación visible debe ser `normalizar(rumboElegido - bearingViewport)` siempre que haya rumbo, sin depender de si la cámara sigue al usuario.

## Evidencia en el código

### Límites actuales de estado

| Señal/responsabilidad | Ubicación y evidencia | Implicación para el plan |
|---|---|---|
| Posición GPS aceptada y rumbo de marcha | `frontend/src/hooks/useGeolocation.js:112-161` valida precisión, monotonía temporal y edad; prioriza `coords.heading`, deduce con dos fixes y suaviza con `suavizarRumbo`. | Mantener aquí posición y rumbo de movimiento; no derivarlos de la cámara. Exponer metadatos de validez/frescura si el selector los necesita. |
| Un único GPS watch | `useGeolocation.js:104-106` limpia el watch anterior antes de crear otro; `:188-195` limpia al desmontar. | Conservar esta propiedad; prueba de montaje/desmontaje y de cambio de precisión debe comprobar que no quedan watches activos. |
| Ruta, progreso y recálculo | `frontend/src/hooks/useNavegacion.js:196-257` procesa cada posición aceptada si navega; no lee `siguiendo` ni bearing. | Esta independencia ya existe y no debe tocarse. La pausa de cámara no puede condicionar este efecto. |
| Brújula y permiso | `frontend/src/hooks/useOrientacion.js:18-30` normaliza iOS/Android; `:39-49` suaviza y limita emisión a ~10 Hz; `:57-79` solicita permiso y hace cleanup. | Debe publicar además la última hora de lectura válida, autorización y una suscripción idempotente. |
| Cámara y gesto | `frontend/src/componentes/detalle/InteractiveMap.jsx:184-187` posee `siguiendo`; `:286-298` hace `easeTo` solo si `enSeguimiento && siguiendo`; `:412-420` deja de seguir ante drag/rotate/pitch. | `siguiendo` es el único interruptor de pausa manual de cámara. El gesto no debe tocar hooks de GPS/orientación ni navegación. |
| Estado de sesión de cámara | `InteractiveMap.jsx:253-281` deriva `enSeguimiento` de ruta/navegando/GPS/simulación y restablece `siguiendo` al entrar en sesión viva. | Mantener `enSeguimiento` como elegibilidad de sesión, no como condición para congelar la flecha. |
| Rotación de flecha | `InteractiveMap.jsx:350-360` usa GPS/brújula solo dentro de `if (!enSeguimiento)` y deja 0° durante course-up. | Causa raíz de NAV-02. Reemplazar por un selector de rumbo y una transformación relativa al viewport. |
| Bearing del mapa | `InteractiveMap.jsx:291-297` aplica `userPosition.heading` al `easeTo`; con rumbo nulo conserva `map.getBearing()`. | El bearing real del viewport debe leerse/guardarse también cuando el usuario pausa o rota el mapa, para calcular una flecha relativa estable. |
| Geometría compartida | `frontend/src/utilidades/geoRuta.js:17-36` contiene `rumbo` y `:38-50` `suavizarRumbo`; `prepararRuta`/`localizarEnRuta` conservan los puntos de ruta. | La tangente de ruta, si se implementa como último respaldo visual, debe derivarse aquí o de un helper de esta utilidad; no duplicar proyección en el componente. |

Además, `InteractiveMap.jsx:36-55` contiene helpers geodésicos propios para el halo. No son necesarios para NAV-01–04, pero confirman el antipatrón señalado en arquitectura: no añadir allí otro cálculo geométrico de tangente o proyección.

## Diagnóstico de NAV-02: flecha relativa al viewport

La cámara course-up actual hace coincidir el bearing de mapa con `userPosition.heading` (`InteractiveMap.jsx:291-297`), por eso una flecha con rotación CSS 0° apunta visualmente hacia el rumbo mientras el seguimiento está activo. Cuando el usuario arrastra, rota o inclina, los handlers cambian `siguiendo` a `false`, pero `enSeguimiento` continúa verdadero. El bloque `:356-360` no asigna rumbo y deja `rotacionFlecha = 0`; como el mapa ya no acompaña el rumbo, la flecha parece congelada.

La derivación requerida es circular y relativa al viewport:

```text
rumboElegido = GPS-movimiento | brújula-fresca | tangente-de-ruta | null
rotaciónFlechaViewport = normalizar360(rumboElegido - bearingViewport)
```

En course-up, bearing y rumbo elegido serán aproximadamente iguales y la salida será 0°. Con cámara pausada, el bearing se conserva o cambia por gesto y la flecha continúa apuntando al rumbo correcto dentro del viewport. `rotationAlignment="viewport"`, ya usado por el marcador según el contexto de fase, es el complemento visual de esta fórmula.

## Precedencia y frescura del rumbo

1. **En movimiento:** usar rumbo GPS válido, incluido el deducido entre dos fixes aceptados. La implementación actual ya exige heading GPS con velocidad >0,5 m/s o desplazamiento de al menos 5 m (`useGeolocation.js:10-16`, `:128-143`). La fase debe definir un único umbral de “baja velocidad” coherente con estos valores, basándolo en las mediciones de Fase 1, sin mezclarlo con `siguiendo`.
2. **Detenido o baja velocidad:** usar brújula solo si el permiso está concedido/no requerido, el valor es finito y su edad no supera una ventana explícita. Hoy `useOrientacion` expone `heading` y permiso, pero no la marca temporal; un valor viejo puede seguir pareciendo actual.
3. **Sin fuente de sensor válida:** calcular una tangente local a partir de la ruta preparada y el índice/proyección de progreso ya existente. Es un respaldo visual, no cambia `ruta.puntos`, `localizarEnRuta`, progreso ni la geometría ArcGIS. Si no hay tangente, representar ausencia de rumbo (no una posición inventada ni un cambio de estado de navegación).

El selector debería ser una función pura con entrada explícita (velocidad, rumbo de movimiento y hora, brújula y hora/permiso, ruta/progreso) y salida `{ rumbo, fuente }` o `null`. Esta forma permite probar precedencia y frescura sin montar MapLibre.

## Suavizado circular y ciclo de listeners

`suavizarRumbo` ya usa promedio seno/coseno (`geoRuta.js:38-50`), adecuado para que 359° y 0° sigan el arco corto. La fase debe reutilizarlo y añadir pruebas específicas: 359°→0°, 0°→359°, secuencias ruidosas alrededor de norte y normalización de una resta con bearing (por ejemplo 5° - 350° = 15°). No se recomienda debounce adicional: la brújula ya emite como máximo cada 100 ms (`useOrientacion.js:44-49`) y NAV-04 fija un p95 <250 ms.

Hay un riesgo concreto de duplicación. `escuchar()` registra tanto `deviceorientationabsolute` como `deviceorientation` cada vez que se invoca (`useOrientacion.js:52-55`): en plataformas sin permiso se llama al montar (`:72-75`) y también puede llamarse mediante `activar()` (`:67-69`); en iOS se invoca tras cada autorización concedida (`:61-63`). El cleanup remueve ambos al desmontar (`:75-78`), pero no evita registros repetidos antes de desmontar ni que eventos equivalentes actualicen dos veces. El plan debe introducir una guarda de suscripción en ref (o un único evento preferido con fallback) y limpieza simétrica; las referencias del handler ya son estables gracias a `useCallback`.

## Implicaciones de latencia y medición

NAV-04 depende de la instrumentación dev-only de Fase 1, que el estado del proyecto aún marca en ejecución. La Fase 2 debe aplicarse después de integrar esa instrumentación y conservar/mover sus marcas, no reemplazarla por logs ni por un HUD.

Medición propuesta, sin coordenadas ni tokens:

- Al aceptar un rumbo que el selector considera válido, emitir/iniciar la marca de “rumbo válido”; tras el commit que actualiza la transformación de `FlechaUsuario`, cerrar “rumbo→flecha”. La marca final debe estar vinculada al render/efecto visible, no al evento crudo de orientación.
- Al aceptar una posición GPS, iniciar “GPS aceptado→cámara”; cerrar inmediatamente después de invocar la actualización de cámara (`map.easeTo`/comando MapLibre) o en el callback de render que Fase 1 haya definido de manera consistente. Documentar exactamente cuál se usa: mide latencia interna de aplicación, no la animación de 250 ms completa.
- Acumular sólo duraciones y etiqueta de fuente/estado inocua (GPS, brújula, tangente; siguiendo/pausado), calcular p95 de cada serie de sesión en desarrollo y verificar `<250 ms` y `<500 ms` respectivamente. No incluir lat/lng, rutas, nombres de destino ni trazas de movimiento.
- Ejecutar la comprobación en al menos Android Chrome real; iPhone Safari si está disponible, ya que permiso y eventos de orientación difieren. Las pruebas unitarias prueban causalidad y lifecycle; la meta p95 exige muestra física.

La cámara ya pide `duration: 250` ms (`InteractiveMap.jsx:296`). Un `map.stop()` previo (`:290`) evita colas de animaciones, pero una alta frecuencia de GPS puede cancelar animaciones repetidamente. Las métricas de Fase 1 deben determinar si esa cadencia explica p95 alto antes de cambiar duración o añadir throttling.

## Forma recomendada del plan

1. **Modelo y utilidades puras (NAV-01/NAV-03):** definir normalización/resta circular y selector de fuente con precedencia, frescura y respaldo de tangente derivada de `geoRuta`. Extender el contrato mínimo de GPS/brújula sólo con metadatos necesarios y conservar las posiciones aceptadas sin interpolación para navegación/cámara.
2. **Integración MapLibre desacoplada (NAV-01/NAV-02):** hacer que `InteractiveMap` mantenga por separado `siguiendo` y bearing de viewport; aplicar el selector y la rotación relativa siempre que haya rumbo. Limitar el efecto `easeTo` al seguimiento activo; los gestos sólo pausan la cámara y “Centrar en mí” la reactiva usando el último estado disponible.
3. **Lifecycle, instrumentación y pruebas (NAV-03/NAV-04):** hacer idempotente la suscripción de orientación, conservar cleanup de GPS, conectar las marcas dev-only de Fase 1 y ampliar las pruebas unitarias/componente. Terminar con el muestreo físico p95 documentado, sin datos de ubicación.

## Pruebas y verificación necesarias

Las pruebas existentes cubren parte de la cámara: `InteractiveMap.test.jsx` valida `easeTo` course-up, bearing conservado sin heading, pausas por drag/rotate/pitch y recentrado. No cubren rotación de flecha, selector de fuente, frescura de brújula, wrap circular ni listeners de orientación. `geoRuta.test.js` sólo prueba la convención cardinal de `rumbo`, y `useGeolocation.test.js` cubre política de watch, fixes obsoletos, precisión y conservación de posición, no heading GPS/deducido ni cleanup.

Añadir como mínimo:

- Tests unitarios de `suavizarRumbo` y helpers del selector: cruces 359°↔0°, resta relativa a bearing, GPS en movimiento sobre brújula, brújula fresca en reposo, rechazo de brújula vencida y fallback de tangente/ausencia.
- Tests de `useGeolocation`: heading GPS válido, deducción por desplazamiento suficiente y que valores no fiables no sustituyen el estado aceptado; comprobar número/cleanup de `watchPosition` al remonte y cambio de precisión.
- Tests de `useOrientacion`: una sola suscripción efectiva por lifecycle, remoción exacta al desmontar, reintento/autorización iOS sin duplicación y eventos equivalentes sin doble actualización observable.
- Tests de `InteractiveMap`: tras `onDragStart`/`onRotateStart`/`onPitchStart`, cambiar GPS o brújula y afirmar que la transformación de la flecha cambia respecto al bearing fijo; “Centrar en mí” reactiva `easeTo` sin ser condición de la flecha; la cámara no se actualiza mientras `siguiendo` sea falso.
- Verificación de instrumentación y UAT: en build de desarrollo, revisar p95 de ambos tramos y que las marcas no escriben coordenadas/tokens. Ejecutar lint, build y suite completa cuando las dependencias estén instaladas.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Usar `enSeguimiento` como proxy de bearing/flecha | Reintroduce NAV-02 al pausar la cámara. | Mantener selector y rotación viewport independientes de `siguiendo`/`enSeguimiento`. |
| Brújula vieja o sin permiso | La flecha parece válida pero está desactualizada. | Registrar timestamp de lectura aceptada y aplicar ventana de frescura; exponer ausencia si caduca. |
| Dos eventos/listeners equivalentes | Renders duplicados, ruido y posible incumplimiento p95. | Suscripción idempotente, fallback explícito y tests de add/remove. |
| Throttle/debounce indiscriminado | Añade retraso perceptible y falla NAV-04. | Reutilizar límite actual de ~10 Hz; cambiar ritmo sólo con datos de Fase 1. |
| Tangente implementada en el mapa | Duplica geometría y puede divergir de progreso. | Derivarla desde `geoRuta.js`/ruta preparada, sólo como salida visual. |
| Cambiar `easeTo` por intuición | Puede empeorar fluidez/cámara y ocultar la causa de latencia. | Comparar p95 antes/después con las marcas de Fase 1; no medir duración de animación como latencia interna. |
| Dependencias de prueba no disponibles localmente | No se puede confirmar línea base automatizada. | `npm.cmd test` no encuentra `vitest`, por lo que la fase debe reinstalar/usar el entorno con dependencias antes de declarar pruebas verdes. |

## Estado de línea base

La investigación es de sólo lectura sobre producción. Se intentó ejecutar la selección de tests de navegación con `npm.cmd test -- --run ...`; el comando alcanzó el script, pero falló porque `vitest` no está disponible en el entorno (`"vitest" no se reconoce`). La invocación directa `npm` está además bloqueada por la política de ejecución de PowerShell; `npm.cmd` evita ese bloqueo. No se infiere ningún fallo funcional de los tests a partir de esta limitación de dependencias.

## Límites mantenidos

Esta fase no propone migrar al SDK de ArcGIS, sustituir MapLibre, modificar o suavizar la geometría de ArcGIS, registrar coordenadas/rutas/tokens, ni alterar el diseño de recálculo. ArcGIS continúa como proveedor principal, OSRM como respaldo y `ruta.puntos` como fuente de verdad para matching/progreso/desvío.

