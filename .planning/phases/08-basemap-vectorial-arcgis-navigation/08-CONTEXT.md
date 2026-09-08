# Fase 8 — Contexto

## Objetivo

Hacer que el mapa de navegación use el basemap vectorial oficial de ArcGIS
Navigation (`arcgis/navigation` y `arcgis/navigation-night`), idioma español,
atribución correcta y fallback OSM explícito. Solo cambia representación y
autenticación del basemap; no cambia GPS, flecha, cámara, progreso, recálculo,
voz, rutas ni geometría.

## Decisiones y límites

- Separar `ARCGIS_BASEMAP_API_KEY` de `ARCGIS_API_KEY`/OAuth del backend de
  routing. Nunca documentar valores reales.
- Preferir `@esri/maplibre-arcgis` y `BasemapStyle.applyStyle` con locale `es`;
  verificar versión/firma durante implementación, sin instalar ahora.
- Ante fallo de estilo, autenticación, sprites, glyphs o tiles, usar OSM solo
  como fallback visual explícito y reportar proveedor/motivo. OSRM sigue siendo
  únicamente fallback del proveedor de rutas.
- No guardar tokens, client secrets, coordenadas precisas ni recorridos.

## Criterios de aceptación

1. Navigation claro/oscuro solicita locale español y conserva copyright del
   estilo; OSM informa su propio proveedor.
2. CSP cubre exactamente style API, sprites, glyphs y tiles necesarios.
3. La clave pública no se mezcla con credenciales privadas ni aparece en logs,
   tests o artefactos; referrers HTTPS quedan pendientes de registrar/verificar.
4. Tests unitarios e integración mockeada cubren temas, locale, atribución,
   rechazo/timeout/fallback y ausencia de clave.
5. No-regresión de GPS, flecha, cámara, progreso, recálculo, voz y geometría;
   lint/build/todas las pruebas pasan.
6. UAT HTTPS en Android Chrome y, si está disponible, iPhone Safari queda como
   checkpoint humano.

