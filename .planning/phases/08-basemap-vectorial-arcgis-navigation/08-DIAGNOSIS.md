# Diagnóstico Fase 0 — basemap y routing

Fecha: 2026-09-08

Base inspeccionada: `5035f96` (`fix: stabilize mobile navigation GPS and recalc`)

Checkpoint GSD: `1507736` (`docs: plan ArcGIS Navigation basemap phase 8`)

## Hallazgo previo a la implementación

- `frontend/src/componentes/detalle/InteractiveMap.jsx` usaba un URL manual de
  `basemapstyles-api.arcgis.com` y añadía el mismo token a peticiones ArcGIS;
  si `/api/mapa/token` no devolvía valor, el estilo era OSM raster.
- `backend/src/routes/mapa.js` llamaba a `obtenerTokenBasemap()` de
  `arcgisRouting.js`. Esa función reutilizaba la API key de routing o generaba
  un OAuth token con `ARCGIS_CLIENT_SECRET`, por lo que un navegador podía
  recibir una credencial de routing.
- `frontend/src/utilidades/api.js` convertía cualquier error del endpoint en
  `null`; eso ocultaba si faltaba configuración, había un 401/403 o existía un
  fallo de red.
- `backend/src/routes/routing.js` seleccionaba ArcGIS cuando
  `hayArcgis()` era verdadero y caía a OSRM cuando la resolución fallaba. La
  respuesta de cada resolución ya declaraba `fuente` (`arcgis` u `osrm`), y
  `/api/rutas/estado` exponía el proveedor nominal sin credenciales.
- `backend/src/index.js` ya permitía varios hosts ArcGIS, pero no enumeraba
  explícitamente `basemaps-api.arcgis.com` ni `basemaps.arcgis.com`.

## Contrato resultante

- `backend/src/config.js:58-72` separa `ARCGIS_BASEMAP_API_KEY` de
  `ARCGIS_API_KEY`, `ARCGIS_CLIENT_ID`, `ARCGIS_CLIENT_SECRET` y
  `ARCGIS_REFERER`.
- `backend/src/routes/mapa.js:22-52` solo entrega la key pública de basemap y
  devuelve `motivo: not-configured` si no existe; nunca importa ni genera el
  token de routing. `GET /api/mapa/estado` da el basemap activo y el proveedor
  nominal de rutas sin secretos ni coordenadas.
- `frontend/src/componentes/detalle/InteractiveMap.jsx:55-99` define los
  estilos oficiales y clasifica errores en categorías seguras. Las líneas
  `437-505` aplican `BasemapStyle.applyStyle` con `arcgis/navigation` o
  `arcgis/navigation-night`, `preferences.language: 'es'` y atribución Esri;
  OSM solo se monta como fallback explícito.
- El diagnóstico visible informa `Basemap: OSM (fallback)` y el motivo. Los
  logs solo contienen proveedor, estilo e idioma o una categoría de error;
  nunca imprimen tokens, URLs del SDK ni coordenadas.
- `backend/src/index.js:50-72` permite style API, sprites, glyphs y tiles
  ArcGIS junto con los hosts de fallback OSM/Carto.

## Variables y referrers pendientes de configuración

En Railway configura:

```text
ARCGIS_BASEMAP_API_KEY=<API key pública con únicamente Basemaps>
ARCGIS_API_KEY=<API key privada de Routing, opcional>
ARCGIS_CLIENT_ID=<OAuth de aplicación para Routing, alternativa>
ARCGIS_CLIENT_SECRET=<secreto OAuth de Routing, solo backend, alternativa>
ARCGIS_REFERER=https://backend-production-8889.up.railway.app
```

En la credencial de basemap de ArcGIS Online registra como referrers exactos,
según los orígenes que se utilicen realmente:

```text
https://backend-production-8889.up.railway.app
http://localhost:5173
http://127.0.0.1:5173
http://localhost:5174
http://127.0.0.1:5174
https://skyward-gains-quicksand.ngrok-free.dev
```

No registres un wildcard amplio. Si el teléfono abre Vite mediante una IP LAN
o un túnel distinto, añade ese origen HTTPS/HTTP exacto y elimínalo cuando deje
de usarse. `ARCGIS_CLIENT_SECRET` nunca debe ir en `frontend/.env` ni en una
variable `VITE_*`.

## Límites de evidencia

Las pruebas automatizadas cubren el contrato, el estilo claro/oscuro, idioma,
atribución, 401/403, key requerida, red, fallback, CSP declarada y separación
de credenciales. El request real a `basemapstyles-api.arcgis.com` y el no uso
de OSM con una key válida requieren una ejecución con credencial autorizada.
La carga en teléfono HTTPS, rotación/pitch, etiquetas españolas y atribución
visible quedan como `HUMAN_NEEDED` hasta ejecutar UAT contra Railway o un
túnel HTTPS con la key configurada.
