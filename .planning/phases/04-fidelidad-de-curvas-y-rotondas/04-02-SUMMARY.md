---
phase: 04-fidelidad-de-curvas-y-rotondas
plan: 02
subsystem: routing-geometry
tags: [human-checkpoint, arcgis, maplibre, privacy]
status: awaiting-human
requirements: [GEOM-01, GEOM-02]
requirements_completed: []
completed: null
---

# Fase 4 Plan 2: checkpoint de captura real

## Estado

Pendiente de acción humana. No se generaron rutas, coordenadas, JSON ni capturas
de pantalla ficticias.

La instrumentación y el procedimiento están listos en
`04-COMPARACION-GEOMETRIA.md`. Para reanudar, el dueño del milestone debe
ejecutar sus nueve pasos en una única sesión, usando como origen y destino dos
sitios turísticos públicos y manteniendo bloqueado el GPS personal.

## Evidencia requerida

1. Nombres de los dos sitios públicos y de la rotonda/curva observada.
2. Archivos no vacíos de ArcGIS crudo y normalizado; archivos OSRM solo si el
   respaldo intervino.
3. GeoJSON copiado de MapLibre para la misma solicitud.
4. Captura de pantalla y juicio visual sobre calzada, esquinas, separadores y
   edificios.
5. Confirmación de que los artefactos no contienen tokens ni una ubicación
   personal.

## Cierre pendiente

Con esos artefactos se contarán y compararán los vértices, se completará
`04-COMPARACION-GEOMETRIA.md` y se decidirá con evidencia si hace falta una
mejora exclusivamente visual. Hasta entonces GEOM-01 y GEOM-02 permanecen
pendientes y la Fase 4 no se declara completa.
