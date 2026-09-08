# Fase 8 — Investigación local

## Evidencia

- `frontend/src/componentes/detalle/InteractiveMap.jsx:34-54,341-354` define
  OSM raster y arma manualmente `arcgis/navigation`/`navigation-night`; el
  token proviene de `mapaApi.token()`.
- `frontend/src/componentes/detalle/InteractiveMap.jsx:495-528` conecta el
  estilo a MapLibre y convierte errores ArcGIS en fallback OSM.
- `frontend/src/utilidades/api.js:143-159` pide `/api/mapa/token` y absorbe
  errores como ausencia de token.
- `backend/src/routes/mapa.js:2-6,23-33` expone token reutilizando routing y
  responde 204 para fallback.
- `backend/src/config.js:54-65` solo tiene `ARCGIS_API_KEY`, OAuth de routing y
  `ARCGIS_REFERER`; no existe `ARCGIS_BASEMAP_API_KEY`.
- `backend/src/utils/arcgisRouting.js:25-27,78-91` usa API key/OAuth para
  routing y también para basemap.
- `backend/src/routes/routing.js:59-83` demuestra ArcGIS primero y OSRM
  después; `backend/src/utils/osrmRouting.js:1-10` identifica OSRM como
  fallback público.
- `backend/src/index.js:44-66` ya permite hosts ArcGIS y OSM en CSP, pero debe
  comprobarse cobertura exacta de style/sprites/glyphs/tiles.

## Dependencias y pruebas

`frontend/package.json:13-36` incluye MapLibre/React Map GL pero no
`@esri/maplibre-arcgis`; `backend/package.json:8-31` usa Vitest y no tiene
script lint. Existen `InteractiveMap.test.jsx`, `api.test.js`, tests de hooks
de navegación y `backend/src/routes/routing.test.js`/`backend/test/*`.

## Riesgos

Mezclar la clave pública con OAuth expone privilegios; fallback visual y OSRM
pueden confundirse; CSP incompleta falla solo en runtime; y un cambio de estilo
puede afectar legibilidad. Se mitiga con contratos separados, diagnóstico por
proveedor, pruebas de cabeceras y checkpoint físico, sin tocar geometría.

