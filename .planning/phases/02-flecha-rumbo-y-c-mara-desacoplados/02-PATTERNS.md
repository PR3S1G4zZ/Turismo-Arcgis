# Mapeo de patrones — Fase 2: flecha, rumbo y cámara desacoplados

**Fecha:** 2026-09-01  
**Base inspeccionada:** `02-CONTEXT.md`, `02-RESEARCH.md`, los hooks y pruebas de navegación, `InteractiveMap`, `geoRuta` y la configuración/convenios del frontend.

## Decisión de estructura

El patrón más cercano ya está repartido correctamente: `useGeolocation` conserva la fijación GPS aceptada y el rumbo de marcha; `useNavegacion` consume esa fijación para progreso y recálculo; `InteractiveMap` es dueño de MapLibre, sus gestos y la cámara; `useOrientacion` encapsula permiso y sensor de brújula. La Fase 2 debe **hacer explícitas las salidas derivadas**, sin convertir la cámara en una dependencia del motor de navegación.

```text
useGeolocation ── posición aceptada, rumboMovimiento, velocidad ─┐
useOrientacion ── rumboBrújula, permiso, última lectura ──────────┼─ selector puro ── rumboElegido
useNavegacion ── ruta preparada, avance/progreso ─────────────────┘                     │
                                                                                           ▼
MapLibre / InteractiveMap: bearingViewport + siguiendo ── rotación = rumboElegido - bearingViewport
```

`siguiendo` solo permite o impide el efecto que llama a `map.easeTo`. No puede aparecer como condición del selector de rumbo ni de la rotación de `FlechaUsuario`. `enSeguimiento` sigue siendo elegibilidad de sesión GPS/ruta, no un proxy de rumbo ni de bearing.

## Clasificación de archivos candidatos

| Archivo | Clasificación | Patrón existente que se conserva | Cambio de Fase 2 |
|---|---|---|---|
| `frontend/src/utilidades/geoRuta.js` | Modificar | Funciones puras nombradas en español (`rumbo`, `suavizarRumbo`, `localizarEnRuta`) y ruta preparada con `puntos`/`acumulados`. | Añadir normalización/resta circular, tangente local y selector puro de fuente. No modificar `puntos`, proyección ni matching. |
| `frontend/src/utilidades/geoRuta.test.js` | Modificar | Vitest directo con rutas pequeñas y aserciones geométricas. | Cubrir wrap 359°↔0°, rotación relativa, precedencia, frescura y ausencia/tangente. |
| `frontend/src/hooks/useGeolocation.js` | Modificar mínimo | Un `watchPosition` en `watchIdRef`, callbacks estables, posición aceptada sin interpolar y `ultimaActualizacion`. | Mantener el contrato de rumbo de marcha y, solo si el selector necesita distinguirlo, exponer su timestamp/validez explícita junto a la fijación aceptada. No iniciar un watch nuevo para la fase. |
| `frontend/src/hooks/useGeolocation.test.js` | Modificar | `renderHook`, mock de `navigator.geolocation`, callbacks capturados y política de watch. | Añadir heading GPS válido, heading deducido y cleanup/remonte; conservar casos de precisión, obsolescencia y última fijación. |
| `frontend/src/hooks/useOrientacion.js` | Modificar | `useRef` para datos de alta frecuencia, `useCallback` estable y cleanup simétrico. | Registrar hora de lectura válida y hacer la suscripción idempotente/deduplicada; conservar permiso iOS mediante `activar`. |
| `frontend/src/hooks/useOrientacion.test.js` | Crear | Tests co-localizados de hooks con Vitest/Testing Library; este archivo aún no existe. | Mock de `DeviceOrientationEvent`/listeners para permiso, prioridad/fallback, una suscripción y remoción exacta. |
| `frontend/src/hooks/useNavegacion.js` | Modificar mínimo | El efecto de líneas 196–257 procesa GPS sin conocer cámara; la ruta preparada y `avance` son su fuente de progreso. | Exponer el mínimo dato derivado de progreso necesario para la tangente visual (por ejemplo `avanceRuta`), sin llevar cámara/brújula a este hook ni cambiar recálculo. |
| `frontend/src/hooks/useNavegacion.test.js` | Modificar mínimo | Mock de `useGeolocation` y pruebas del origen/preview. | Verificar que el dato de avance publicado refleja el matching existente y que la pausa de cámara no forma parte de las entradas del hook. |
| `frontend/src/componentes/detalle/InteractiveMap.jsx` | Modificar | `mapRef`, estado `siguiendo`, efectos de cámara y `rotationAlignment="viewport"`. | Mantener bearing del viewport, derivar la flecha siempre que haya rumbo y limitar `easeTo` a `enSeguimiento && siguiendo`. |
| `frontend/src/componentes/detalle/InteractiveMap.test.jsx` | Modificar | Mock imperativo de MapLibre (`easeTo`, `getBearing`) y eventos de gesto en `mapProps`. | Simular bearing/gesto y comprobar que la flecha sigue rotando sin recentrado; probar recentrado y que la cámara sigue pausada. |
| `frontend/src/contexto/NavegacionProvider.jsx` y `NavegacionContext.js` | Sin cambio previsto | El provider ya pasa el objeto completo de `useNavegacion` sin adaptación. | No crear un contexto paralelo. Solo cambiar si el contrato actual deja de propagar el campo mínimo de navegación. |
| `frontend/src/componentes/detalle/InteractiveMap.css` | Sin cambio previsto | Transición actual de `transform` de `.user-arrow`. | La rotación sigue llegando por `style`; no agregar animación, debounce o HUD para esta fase. |
| `frontend/src/test/setup.js`, `vitest.config.js`, `package.json` | Sin cambio previsto | jsdom, RAF simulado y script `vitest run`. | No incorporar dependencias ni cambiar runner; los mocks nuevos viven en sus tests. |

## Patrón recomendado para utilidades puras

`geoRuta.js` es la ubicación correcta porque ya define la convención de rumbo (0–360, horario desde el norte), el suavizado circular y la geometría de la ruta preparada. El selector debe recibir valores, no leer React, MapLibre ni APIs del navegador.

Fragmento orientativo, con nombres consistentes con el proyecto:

```javascript
export function normalizarRumbo(grados) {
  if (!Number.isFinite(grados)) return null;
  return ((grados % 360) + 360) % 360;
}

export function rotacionRelativaViewport(rumboElegido, bearingViewport) {
  const rumboNormalizado = normalizarRumbo(rumboElegido);
  const bearingNormalizado = normalizarRumbo(bearingViewport);
  if (rumboNormalizado == null || bearingNormalizado == null) return null;
  return normalizarRumbo(rumboNormalizado - bearingNormalizado);
}

export function tangenteRuta(ruta, indice) {
  const puntos = ruta?.puntos;
  if (!puntos || puntos.length < 2) return null;
  const inicio = Math.max(0, Math.min(indice ?? 0, puntos.length - 2));
  return rumbo(puntos[inicio], puntos[inicio + 1]);
}

export function seleccionarRumbo({
  moviendo,
  rumboMovimiento,
  gpsConfiable,
  rumboBrujula,
  permisoBrujula,
  ultimaLecturaBrujula,
  ahora,
  maxEdadBrujulaMs,
  rumboRespaldo,
}) {
  if (moviendo && gpsConfiable && Number.isFinite(rumboMovimiento)) {
    return { rumbo: normalizarRumbo(rumboMovimiento), fuente: 'movimiento' };
  }
  const brujulaFresca = Number.isFinite(rumboBrujula)
    && ultimaLecturaBrujula != null
    && ahora - ultimaLecturaBrujula <= maxEdadBrujulaMs;
  if (!moviendo && permisoBrujula !== 'denegado' && brujulaFresca) {
    return { rumbo: normalizarRumbo(rumboBrujula), fuente: 'brujula' };
  }
  if (Number.isFinite(rumboRespaldo)) {
    return { rumbo: normalizarRumbo(rumboRespaldo), fuente: 'tangente-ruta' };
  }
  return null;
}
```

Notas de integración:

- El umbral de `moviendo` debe consolidarse con la semántica ya usada por `useGeolocation` (`VELOCIDAD_MIN_MS = 0.5`) y por el mapa (hoy `0.7`); no introducir dos umbrales incompatibles. La constante final se documenta con el porqué y se valida con las métricas de Fase 1.
- La tangente usa los `puntos` inmutables de `prepararRuta` y el índice que ya produjo `localizarEnRuta`. Es solo un respaldo de render: no reescribe `ruta.puntos`, `acumulados`, `proyeccion`, `avance` ni el proveedor ArcGIS/OSRM.
- No suavizar de nuevo la rotación relativa. `suavizarRumbo` ya es el patrón reutilizable para cada fuente sensor; la resta circular solo normaliza la salida contra la cámara.

## Patrón de contrato entre hooks

`useGeolocation` ya hace el trabajo crítico: actualiza `position` únicamente tras aceptar una lectura y sitúa `heading` suavizado dentro de dicha posición. La ampliación debe ser aditiva, no sustituir `position.heading` ni transportar coordenadas a logs.

```javascript
// Dentro de handleSuccess, después de aceptar la fijación:
const rumboMovimiento = rumboRef.current;
setPosition({ lat: latitude, lng: longitude, accuracy, heading: rumboMovimiento, speed });
setUltimaActualizacion(timestamp);

// En el retorno del hook, solo si el selector requiere metadato separado:
return {
  // …contrato actual
  rumboMovimiento,
  ultimaActualizacionRumbo: rumboMovimiento == null ? null : timestamp,
};
```

La implementación puede evitar estado React extra si el timestamp de la posición aceptada ya es suficiente para el selector; el requisito es que la validez sea explícita y que no se use una lectura GPS caducada como rumbo de marcha. `gpsConfiable` debe seguir cayendo cuando vence la fijación, sin borrar la última posición visual.

En `useOrientacion`, el patrón debe mantener refs para recibir eventos y emitir a React solo al ritmo actual (~10 Hz). Se necesita una guarda de suscripción y una marca temporal de lecturas válidas:

```javascript
const escuchandoRef = useRef(false);
const ultimaLecturaRef = useRef(null);

const escuchar = useCallback(() => {
  if (escuchandoRef.current) return;
  window.addEventListener('deviceorientationabsolute', manejar, true);
  window.addEventListener('deviceorientation', manejar, true);
  escuchandoRef.current = true;
}, [manejar]);

const dejarDeEscuchar = useCallback(() => {
  if (!escuchandoRef.current) return;
  window.removeEventListener('deviceorientationabsolute', manejar, true);
  window.removeEventListener('deviceorientation', manejar, true);
  escuchandoRef.current = false;
}, [manejar]);
```

Antes de llamar a `suavizarRumbo`, `manejar` debe descartar el evento equivalente que llega por la otra variante (`deviceorientationabsolute`/`deviceorientation`) según una política explícita y testeable: preferir la lectura absoluta válida y permitir la otra solo como fallback. No basta con que el límite de 100 ms oculte el segundo render: el segundo evento tampoco debe volver a suavizar la referencia. Tras aceptar una lectura, publicar `ultimaActualizacion` (timestamp actual) junto a `heading`, `permiso` y `activar`.

El cleanup del efecto usa `dejarDeEscuchar`; `activar()` puede llamarlo muchas veces sin sumar listeners. Así se preserva el patrón de callbacks estables y cleanup simétrico ya utilizado en `useGeolocation`.

`useNavegacion` no debe importar `useOrientacion`, estado de gesto ni bearing. Solo debe publicar el avance existente cuando haga falta para el respaldo visual:

```javascript
return {
  // …ruta, tramos y derivados actuales
  avanceRuta: avance,
};
```

Esto evita recalcular proyección en el mapa. Si se prefiere exponer directamente `rumboRespaldoRuta`, debe calcularse con el helper de `geoRuta` a partir de `rutaRef.current`/`avance`, conservarse como valor derivado de navegación y probarse como tal.

## Patrón de integración en `InteractiveMap`

El cambio local más importante sustituye el bloque actual de líneas 350–360. La cámara sigue siendo un efecto; la flecha se vuelve una derivación de datos independientes.

```javascript
const [bearingViewport, setBearingViewport] = useState(0);

const actualizarBearingViewport = useCallback((evento) => {
  const siguiente = evento?.viewState?.bearing ?? mapRef.current?.getBearing();
  if (!Number.isFinite(siguiente)) return;
  setBearingViewport((anterior) => {
    const normalizado = normalizarRumbo(siguiente);
    return anterior === normalizado ? anterior : normalizado;
  });
}, []);

const rumboRespaldo = tangenteRuta(ruta, avanceRuta?.indice);
const rumboElegido = seleccionarRumbo({
  moviendo,
  rumboMovimiento: userPosition?.heading,
  gpsConfiable,
  rumboBrujula: orientacion.heading,
  permisoBrujula: orientacion.permiso,
  ultimaLecturaBrujula: orientacion.ultimaActualizacion,
  ahora: Date.now(),
  maxEdadBrujulaMs: VENTANA_BRUJULA_FRESCA_MS,
  rumboRespaldo,
});
const rotacionFlecha = rumboElegido
  ? rotacionRelativaViewport(rumboElegido.rumbo, bearingViewport)
  : 0;
```

Integración de MapLibre:

- Inicializar `bearingViewport` al cargar el mapa y actualizarlo con el evento de movimiento/rotación que expone `react-map-gl`. El valor cambia porque debe repintar la flecha; no se necesita crear estado para muestras crudas de GPS o brújula fuera de sus hooks.
- Mantener el efecto actual con la guarda `!mapListo || !enSeguimiento || !siguiendo || !userPosition`. Solo dentro de él se llama `map.stop()` y `map.easeTo`; al hacerlo, el bearing aplicado acaba reflejado por la misma fuente de bearing del viewport.
- `onDragStart`, `onRotateStart` y `onPitchStart` conservan su responsabilidad actual: `setSiguiendo(false)` si hay sesión en vivo. Nunca reinician GPS, ruta, avance, recálculo ni `useOrientacion`.
- El botón «Centrar en mí» debe limitarse a `setSiguiendo(true)`. El efecto consume el último GPS/ruta/orientación disponible en el siguiente render; no vuelve a suscribir sensores ni requiere que la flecha estuviera parada.
- Con `rotationAlignment="viewport"`, `rumboElegido - bearingViewport` hace que course-up deje la flecha cerca de 0°, y una cámara pausada o rotada manualmente mantenga la punta correctamente orientada dentro del viewport.

La instrumentación dev-only de Fase 1 se conserva alrededor de la aceptación de rumbo y el commit visible de `FlechaUsuario`, y alrededor de GPS aceptado y la invocación de `easeTo`. Usar `performance.mark()`/`measure()` solo bajo `import.meta.env.DEV`; medir duraciones y etiquetas inocuas de fuente/estado, nunca latitud, longitud, geometría de ruta ni tokens.

## Patrones de prueba concretos

Las pruebas deben seguir Vitest + Testing Library + jsdom, co-localizadas y con mocks locales; no hace falta cambiar configuración ni agregar dependencias.

```javascript
// geoRuta.test.js: la mezcla debe cruzar norte por el arco corto.
expect(suavizarRumbo(359, 1)).toBeLessThan(5);
expect(rotacionRelativaViewport(5, 350)).toBe(15);

// La precedencia no conoce cámara.
expect(seleccionarRumbo({
  moviendo: true, gpsConfiable: true, rumboMovimiento: 92,
  rumboBrujula: 10, permisoBrujula: 'concedido',
  ultimaLecturaBrujula: 1000, ahora: 1001, maxEdadBrujulaMs: 2000,
})).toEqual({ rumbo: 92, fuente: 'movimiento' });
```

Cobertura mínima por archivo:

- `geoRuta.test.js`: cruce 359°→0° y 0°→359°, resta circular, GPS en movimiento sobre brújula, brújula fresca en reposo, rechazo de brújula caducada, tangente y `null` cuando no hay fuente/tangente.
- `useGeolocation.test.js`: extender `fix()` para aceptar `heading` y `speed`; comprobar heading GPS válido y el deducido tras desplazamiento suficiente. Añadir un test de desmontaje/remonte o cambio de precisión que pruebe que el watch previo se limpia antes de abrir el siguiente.
- nuevo `useOrientacion.test.js`: espiar `addEventListener`/`removeEventListener`; llamar dos veces a `activar()` y verificar una suscripción efectiva; emitir eventos equivalentes y comprobar una sola aceptación; desmontar y comprobar remoción exacta; cubrir permiso concedido y denegado en iOS.
- `useNavegacion.test.js`: ampliar el mock de GPS con `ultimaActualizacion` si el contrato lo consume y afirmar que `avanceRuta` expone el resultado existente cuando navega. No crear una prueba que tenga que manipular `siguiendo`: ese estado no pertenece al hook.
- `InteractiveMap.test.jsx`: ampliar el mock de `useOrientacion` para devolver timestamp; inspeccionar el `style.transform` de `.user-arrow`. Tras `onDragStart`/`onRotateStart`/`onPitchStart`, cambiar GPS o brújula y bearing simulado; confirmar que cambia `rotate(...)` y que no aumenta `easeTo`. Pulsar «Centrar en mí» y confirmar que `easeTo` se reanuda sin requerir un nuevo sensor. Mantener las aserciones actuales de `stop()` antes de `easeTo` y bearing preservado sin heading.

## Límites de integración

- No migrar el renderer a ArcGIS SDK ni reemplazar MapLibre/react-map-gl.
- ArcGIS World Route sigue siendo principal y OSRM el respaldo; no tocar API, proveedor ni tokenización.
- No mutar `ruta.puntos`, no recalcular progreso en `InteractiveMap` y no duplicar proyección/tangente fuera de `geoRuta.js`.
- No interpolar una coordenada para navegación o cámara: `usePosicionAnimada` permanece exclusivamente visual.
- No registrar coordenadas, rutas recorridas, destinos identificables ni tokens. La instrumentación queda dev-only y de duración agregada.
- No introducir debounce de sensores; el límite actual de emisión de brújula y las marcas de Fase 1 determinan cualquier ajuste posterior para cumplir p95 rumbo→flecha <250 ms y GPS→cámara <500 ms.

## Orden sugerido de integración

1. Añadir y probar helpers puros en `geoRuta.js`; definir el contrato mínimo de tangente/selector antes de cambiar render.
2. Hacer idempotente `useOrientacion` y completar metadatos de rumbo GPS/brújula; publicar el avance mínimo desde `useNavegacion` sin tocar su efecto de progreso/recálculo.
3. Integrar bearing del viewport, selector y flecha en `InteractiveMap`; después ampliar pruebas de componente y conservar marcas dev-only de Fase 1.

La Fase 2 debe aplicarse sobre las versiones instrumentadas de Fase 1, ya que ambas tocan `InteractiveMap.jsx`, `useNavegacion.js`, `useGeolocation.js` y `useOrientacion.js`.

## PATTERN MAPPING COMPLETE
