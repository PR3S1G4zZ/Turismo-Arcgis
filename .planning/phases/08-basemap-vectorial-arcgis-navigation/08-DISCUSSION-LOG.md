# Fase 8 — Discusión

**Modo:** equivalente documental; no hay wrapper interactivo GSD visible como
comando en este worktree. Se preservaron contexto, investigación, plan y
verificación equivalente.

## Decisiones del encargo

- Basemap actual: ArcGIS vectorial manual si hay token; OSM raster si falta o
  falla ArcGIS.
- Rutas actuales: ArcGIS primero; OSRM como fallback explícito.
- Alcance: basemap, credencial pública separada, locale, atribución, CSP,
  diagnóstico y tests; nunca lógica de navegación.
- Pendientes humanos: referrers HTTPS de producción y UAT físico.

## Supuestos a validar

La versión compatible de `@esri/maplibre-arcgis`, firma exacta de
`BasemapStyle.applyStyle`, hosts finales de recursos y origen HTTPS real se
confirmarán durante implementación/configuración autorizada.

