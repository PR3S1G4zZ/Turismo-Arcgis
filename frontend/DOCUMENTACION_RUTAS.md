# Rutas y navegación en tiempo real

Guía de la navegación paso a paso del portal: cómo está montada, cómo se
configura la credencial de ArcGIS y qué hacer cuando algo falla.

---

## Qué hace

Desde la ficha de un sitio, el visitante pulsa **Iniciar Ruta**, elige *a pie* o
*en auto*, y obtiene una guía equivalente a la de Google Maps o Waze:

- trayecto real por las calles de Itagüí dibujado sobre el mapa,
- indicaciones giro a giro en español, con la maniobra actual destacada,
- avance calculado **siguiendo la calle**, no en línea recta,
- recálculo automático si se sale del trayecto,
- indicaciones habladas (se pueden silenciar),
- cámara que acompaña al usuario, con botón para recentrar.

---

## Decisión de arquitectura

Esri **no** ofrece seguimiento de ruta en la web. El `RouteTracker` —el
componente que detecta el desvío, recalcula solo y anuncia las maniobras— existe
solo en los SDK nativos (iOS, Android, .NET, Qt, Flutter). El SDK de JavaScript
resuelve la ruta y devuelve las indicaciones, pero el seguimiento hay que
construirlo.

Por eso aquí:

1. **El mapa usa MapLibre GL mediante `react-map-gl`**, sin instalar el SDK de
   mapas de ArcGIS. Prefiere el estilo vectorial de ArcGIS cuando recibe un
   token de basemap y usa CARTO únicamente como respaldo del estilo.
2. **El ruteo se consume por REST**, a través del backend.
3. **El seguimiento es propio**, en `useNavegacion` + `geoRuta`.

```
Navegador (React + MapLibre)        Backend Express            ArcGIS
────────────────────────────        ───────────────            ──────
useNavegacion()                     POST /api/rutas/resolver   /solve
  watchPosition ──┐                   ├─ guarda la credencial
                  ├─► resolver ─────► ├─ cachea travelModes ──►
  proyectar sobre │                   ├─ rate-limit por IP
  la polilínea    │                   ├─ directionsLanguage=es
                  │                   └─ respaldo OSRM si falla
  ¿desviado >45m? ┘ (espera 15 s)
```

**La credencial nunca llega al navegador.** El frontend solo conoce
`/api/rutas/resolver`.

---

## Configuración de la credencial

En `backend/.env`. Basta con **una** de las dos opciones.

### Opción A (recomendada) — OAuth 2.0 de aplicación

Es la vía a usar cuando la cuenta no puede generar claves de API (la pantalla de
credenciales muestra *"¿Busca credenciales de clave de API? Póngase en contacto
con el administrador de su sistema"*).

En [arcgis.com](https://arcgis.com):
**Contenido → Mis contenidos → Nuevo elemento → Credenciales de desarrollador →
Credenciales de OAuth 2.0 (autenticación de *aplicaciones*)**.

```env
ARCGIS_CLIENT_ID=...
ARCGIS_CLIENT_SECRET=...
ARCGIS_REFERER=http://localhost:3001
```

El backend pide el token al vuelo contra
`https://www.arcgis.com/sharing/rest/oauth2/token` (`grant_type=client_credentials`),
lo cachea y lo renueva solo antes de que venza.

#### Las URL de referencia no son opcionales aquí

Al crear las credenciales se registran una o varias **URL de referencia**.
ArcGIS compara la cabecera `Referer` de cada petición contra esa lista. Node
**no envía esa cabecera por su cuenta**, así que el backend la añade
explícitamente en las tres llamadas (token, consulta de modos y `/solve`); sin
ella, ArcGIS rechazaría el token aunque las credenciales fueran correctas.

`ARCGIS_REFERER` debe ser un dominio **concreto** que encaje con lo registrado.
Si se registró el comodín `https://*.itagui.gov.co`, aquí va
`https://turismo.itagui.gov.co`, no el comodín.

| Entorno | Registrado en ArcGIS | `ARCGIS_REFERER` |
|---|---|---|
| Desarrollo | `http://localhost:3001` | `http://localhost:3001` |
| Producción | `https://*.itagui.gov.co` | `https://turismo.itagui.gov.co` |

### Opción B — API key directa

Requiere privilegio de administrador para generarla, con el permiso de
**Routing** (`premium:user:networkanalysis`).

```env
ARCGIS_API_KEY=...
```

### Sin credencial

Si no se configura ninguna, el ruteo cae al servidor público de **OSRM**.
Sirve para desarrollo, **no para producción**: es un servidor de demostración,
sin garantías de disponibilidad y con límite de peticiones. Además solo hospeda
el perfil de automóvil, por lo que el backend recalcula la duración a pie a
partir de la distancia (5 km/h) para no informar tiempos de coche.

Para saber qué proveedor está activo:

```bash
curl http://localhost:3001/api/rutas/estado
```

---

## El endpoint

`POST /api/rutas/resolver`

```json
{ "origen": { "lat": 6.1724, "lng": -75.6091 },
  "destino": { "lat": 6.1836, "lng": -75.5985 },
  "modo": "walk" }
```

Respuesta normalizada (idéntica venga de ArcGIS o de OSRM):

```json
{ "fuente": "arcgis",
  "puntos": [[6.1724, -75.6091], "…"],
  "pasos": [{ "texto": "Gira a la derecha hacia Carrera 55",
              "distanciaM": 872, "duracionMin": 10.4, "maniobra": "…" }],
  "distanciaM": 2042,
  "duracionMin": 24.5,
  "traficoSolicitado": true,
  "traficoAplicado": true,
  "degradacionTrafico": null }
```

`traficoSolicitado`/`traficoAplicado` (agregados en la Fase 6 — TRAFFIC-01) solo
pueden ser `true` en modo `car` con ArcGIS como proveedor activo. `walk` y el
respaldo OSRM siempre devuelven ambos en `false`, explícitamente — nunca se
omiten ni se simula tráfico inexistente. Pueden diferir entre sí: `traficoSolicitado:
true, traficoAplicado: false` significa que se pidió una ruta en auto pero el
`travelMode` configurado en esta organización de ArcGIS no tiene impedancia de
tráfico (`impedanceAttributeName: "TravelTime"`) — degradación clara por falta
de soporte configurado, no un fallo silencioso. `traficoAplicado: true`
confirma que ArcGIS aceptó la solicitud compatible con tráfico; no garantiza
datos en vivo para cada calle del trayecto.

`degradacionTrafico` es `null` cuando no hay degradación. Para una ruta en auto
sin tráfico explica la causa comprobable: `travel-mode-sin-impedancia-de-trafico`
si ArcGIS no expone `TravelTime`, o `proveedor-osrm-sin-trafico` si se usó el
respaldo. El contrato no afirma cobertura calle por calle ni costos que la
respuesta de ArcGIS no permita comprobar.

`puntos` va en `[lat, lng]` como límite de la aplicación. ArcGIS entrega
`[x, y]` = `[lng, lat]`; la conversión se hace en el backend. MapLibre recibe
GeoJSON en `[lng, lat]`, conversión que queda encapsulada en el componente de
mapa.

**Límite:** 60 peticiones por IP cada 5 minutos. No es una restricción al
usuario —navegar normalmente no pasa de ~20— sino una red de seguridad contra un
bucle en el cliente, porque cada recálculo es una petición facturable.

---

## Parámetros del servicio de ArcGIS

En `backend/src/utils/arcgisRouting.js`. Los que importan:

| Parámetro | Valor | Por qué |
|---|---|---|
| `stops` | conjunto de entidades con `Name` | Con el formato simple `lng,lat;lng,lat` las indicaciones dicen *"Ha llegado a Location 2"*. Nombrando las paradas dicen *"Ha llegado a la Casa de la Cultura"*. Ojo: la geometría va en `X,Y`, o sea longitud primero |
| `travelMode` | **objeto JSON completo** | Pasar el nombre (`"Walking Time"`) **falla**. Los modos se consultan al servicio y se cachean 6 h |
| `directionsLanguage` | `es` | Indicaciones ya en español, sin traducir nada |
| `directionsLengthUnits` | `esriNAUMeters` | Evita convertir millas en el cliente |
| `outputLines` | `esriNAOutputLineTrueShape` | Geometría real de la calle, no una recta entre paradas |
| `outSR` | `4326` | WGS 84 que preserva el límite `{ lat, lng }` y la geometría del mapa |
| `startTime` | `"now"`, solo en modo auto | Activa tráfico en vivo — solo se envía si el `travelMode` elegido ya usa `impedanceAttributeName: "TravelTime"` (ver Fase 6 / TRAFFIC-01); si la organización no lo configuró así, no se envía y `traficoAplicado` sale en `false` |

> ⚠️ ArcGIS devuelve **HTTP 200 incluso cuando falla**; el error viene en el
> cuerpo. `pedirJson()` lo comprueba y lanza excepción.

---

## Seguimiento en tiempo real

### `frontend/src/utilidades/geoRuta.js`

Geometría pura, sin React. Al recibir la ruta, `prepararRuta()` calcula una vez:

- la distancia acumulada hasta cada vértice,
- el punto del trayecto donde termina cada indicación.

Los pasos se anclan **por distancia recorrida**, no por su geometría: así el
mismo código sirve para ArcGIS y para el respaldo.

Después, en cada lectura del GPS, `localizarEnRuta()` proyecta la posición sobre
la polilínea (proyección punto-segmento en un plano local equirectangular) y
devuelve avance real, distancia restante y separación del trayecto.

La búsqueda se limita a una ventana de vértices hacia adelante. Sin eso, una
ruta que se cruza consigo misma haría saltar el progreso al tramo equivocado. Si
la ventana deja al usuario a más de 30 m, se reintenta sobre la ruta completa
(caso de quien retrocede o se desvía de verdad).

### `frontend/src/hooks/useNavegacion.js`

Máquina de estados `inactivo → calculando → navegando → llegado`, con los
umbrales en constantes al inicio del archivo:

| Constante | Valor | Motivo |
|---|---|---|
| `UMBRAL_DESVIO_M` | 45 m | Por debajo, el ruido del GPS urbano daría falsos desvíos |
| `LECTURAS_PARA_RECALCULAR` | 3 | Exige que el desvío sea sostenido, no un salto puntual |
| `ESPERA_ENTRE_RECALCULOS_MS` | 15 s | Cada recálculo se factura; sin esto un GPS ruidoso dispararía peticiones en bucle |
| `RADIO_LLEGADA_M` | 25 m | El trayecto puede terminar en la acera de enfrente |
| `AVISO_PROXIMIDAD_M` | 60 m | Antelación para anunciar la maniobra siguiente |

La navegación vive en `NavegacionProvider`, por encima de las vistas: hay **una
sola ruta activa y un solo `watchPosition`** para toda la aplicación. El mapa y
la isla de ruta leen del mismo contexto, así que no pueden mostrar datos
distintos.

### Política de ubicación y estados

`useGeolocation` acepta una lectura para live solo cuando su `timestamp` es
estrictamente posterior al último aceptado, `accuracy` es finita y no supera
**50 m**, y la lectura tiene como máximo **5 s** de antigüedad. Durante live,
`watchPosition` usa `enableHighAccuracy: true`, `maximumAge: 1000` y
`timeout: 5000`; fuera de live el seguimiento es de bajo consumo.

La lectura aceptada alimenta de inmediato navegación, cámara y rumbo. El único
suavizado permitido es la interpolación del marcador que se dibuja en
`InteractiveMap`; no se aplica a progreso, llegada ni recálculo. La interfaz
indica la antigüedad de la última lectura aceptada.

Estados relevantes:

| Estado | Comportamiento |
|---|---|
| `gpsConfiable=true` | Hay una lectura real, fresca, monotónica y con precisión ≤50 m; puede haber seguimiento live. |
| `gpsConfiable=false` tras un error o TTL | Se conserva la última coordenada confiable solo para mostrarla; se suspenden progreso, llegada, voz y recálculo. |
| `posicionSimulada=true` | Solo antes de una fijación confiable; nunca habilita seguimiento. |
| `previsualizando` | Ruta desde origen manual o simulado: se dibuja estática, sin ETA live, progreso, llegada, voz ni recálculo; un GPS posterior no la promociona automáticamente. |
| `navegando` | Ruta live creada desde GPS confiable. |

### Cámara MapLibre

- En `previsualizando`, `fitBounds` encuadra la geometría una vez y no activa
  seguimiento.
- En `navegando` con GPS confiable, la cámara usa la coordenada GPS aceptada,
  *course-up* y `pitch: 50`. Detiene cualquier transición anterior antes de
  mover la cámara; si no hay rumbo GPS, conserva el bearing actual.
- Al salir de navegación, la cámara vuelve explícitamente a norte (`bearing: 0`)
  y sin inclinación (`pitch: 0`). Un gesto de pan, rotación o inclinación pausa
  el seguimiento hasta usar el control de recentrado.
- En el mapa informativo, las actualizaciones GPS no recapturan pan ni zoom del
  usuario después de la vista inicial.

---

## Requisitos de despliegue

- **HTTPS obligatorio.** `watchPosition` no funciona fuera de contexto seguro
  (salvo en `localhost`). El servidor de la Alcaldía debe servirse por TLS o la
  navegación no arranca.
- Los sitios necesitan `lat`/`lng` cargados en el panel. Sin coordenadas no hay
  ruta: el modal lo indica en lugar de inventar un destino.

---

## Costos

Según la [tarifa de ArcGIS Location Platform](https://location.arcgis.com/pricing/):
**20.000 rutas gratis al mes**, y a partir de ahí USD 0,50 por cada 1.000.

Para el volumen de Itagüí es efectivamente gratuito. El riesgo no es el uso
orgánico sino un fallo que dispare peticiones en bucle; de ahí la espera entre
recálculos en el cliente y el rate-limit en el servidor.

El basemap se representa con MapLibre; el estilo de ArcGIS puede requerir su
propio token, y CARTO se conserva como respaldo si ese estilo no carga.

---

## Checklist de lanzamiento en dispositivo físico

Ejecutar en la URL de producción **HTTPS** (no solo en `localhost`). Registrar
únicamente resultado, proveedor de ruta, modo, precisión y edad de la lectura;
**no guardar coordenadas personales** ni trazas de ubicación en el repositorio.

- [ ] Con permiso limpio, conceder ubicación y confirmar una lectura con
  precisión ≤50 m y edad visible ≤5 s.
- [ ] Probar una ruta A→B tanto a pie como en auto; confirmar que el endpoint
  recibe `{ origen: {lat,lng}, destino: {lat,lng} }` en ese orden y anotar el
  proveedor ArcGIS u OSRM.
- [ ] Durante una ruta live, verificar cámara *course-up*, centrada en la
  ubicación real; mover, rotar e inclinar el mapa y comprobar que se pausa el
  seguimiento y aparece el control de recentrado.
- [ ] Provocar una desviación deliberada de al menos 50 m: un salto aislado no
  debe recalcular; tres lecturas confirmadas, respetando la espera de 15 s,
  deben hacerlo.
- [ ] Simular pérdida temporal de GPS después de una fijación válida: la última
  posición puede seguir dibujada, pero no deben avanzar progreso, llegada, voz
  ni recálculo; al superar 5 s debe verse estado no-live.
- [ ] Sin GPS confiable, elegir origen manual y confirmar que se muestra una
  vista previa estática, sin mensajes ni controles de seguimiento en vivo.
- [ ] Finalizar una ruta live y confirmar norte-arriba, `pitch: 0` y que no hay
  un `fitBounds` posterior que recupere course-up.
- [ ] Documentar fecha, navegador/dispositivo, permisos, modo, proveedor,
  precisión, antigüedad y resultado de cada caso sin incluir latitud, longitud
  ni capturas que revelen ubicación personal.

---

## Diagnóstico

| Síntoma | Causa probable |
|---|---|
| `estado` responde `osrm` con credencial puesta | El backend no releyó el `.env`: reinícialo |
| Log `ArcGIS falló, se usa el respaldo OSRM` | El mensaje siguiente trae el motivo real (token, privilegios, cuota) |
| `Invalid token` en el log | Credencial vencida o sin el privilegio de *Routing* |
| Error de *referer* no válido | `ARCGIS_REFERER` no coincide con ninguna URL de referencia registrada. Debe ser un dominio concreto, nunca el comodín |
| La ruta sale pero sin indicaciones | El modo de desplazamiento no se resolvió; se usó el predeterminado. Revisa el aviso `[arcgis] Sin modos de desplazamiento` |
| El progreso no avanza | Sin señal GPS o permiso denegado; el modal lo avisa |
| No se oye la voz | Silenciada con el botón del altavoz, o el navegador bloquea la síntesis hasta que haya interacción del usuario |
