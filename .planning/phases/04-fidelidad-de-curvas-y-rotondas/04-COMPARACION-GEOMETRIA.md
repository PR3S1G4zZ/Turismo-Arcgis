# Fase 4: Fidelidad de curvas y rotondas — Comparación de las 5 etapas

**Estado:** instrumentación lista; captura y validación visual reales pendientes de acción humana (ver `04-02-PLAN.md`).

No se incluyen coordenadas ni resultados de ejemplo: esta comparación solo se
completará con una única sesión real entre dos sitios turísticos públicos.

## Comparación de las 5 etapas

| Etapa | Nº de vértices | Fuente/proveedor | Observaciones |
|-------|----------------|-------------------|----------------|
| 1. ArcGIS crudo | pendiente de captura | pendiente de captura | — |
| 2. OSRM crudo (si intervino) | pendiente de captura | pendiente de captura | — |
| 3. Normalizado backend | pendiente de captura | pendiente de captura | — |
| 4. GeoJSON a MapLibre | pendiente de captura | pendiente de captura | — |
| 5. Resultado visual | pendiente de captura | — | — |

## Instrucciones de captura

1. Elegir dos sitios turísticos ya existentes en la base de datos (`GET /api/sitios` o el panel admin) cuyo trazado por calles pase por una rotonda/curva pronunciada de Itagüí. Anotar sus nombres y la curva elegida, pero no usar la ubicación GPS real de una persona como origen.
2. Bloquear el permiso de ubicación del navegador para esta sesión. En el selector **Elegir en el mapa**, marcar como origen el primer sitio público elegido. Confirmar que la vista indique **Punto de partida elegido** antes de calcular la ruta; si aparece **Mi ubicación**, detenerse y no activar la captura.
3. Desde PowerShell, levantar el backend con `$env:CAPTURAR_GEOMETRIA='true'; npm run dev` dentro de `backend/`. En Bash, usar `CAPTURAR_GEOMETRIA=true npm run dev`. La variable debe existir solo en esta terminal temporal.
4. Levantar el frontend en modo desarrollo (`npm run dev` dentro de `frontend/`) y, antes de pedir la ruta, abrir la consola del navegador y ejecutar `window.__capturarGeometria = true;` para activar la etapa 4.
5. En la página de detalle del sitio destino, iniciar **Fijar Ruta de Destino** usando el origen manual público del paso 2. Confirmar que la respuesta/estado del backend indica `fuente: "arcgis"`; si indica OSRM, registrarlo como respaldo y no afirmar que ArcGIS estuvo activo.
6. Revisar `.planning/phases/04-fidelidad-de-curvas-y-rotondas/captura/` desde la raíz: deben aparecer `arcgis-crudo` + `arcgis-normalizado`; también `osrm-crudo` + `osrm-normalizado` solo si intervino el respaldo.
7. Copiar de la consola la línea `[captura-geometria] geojson-maplibre`, guardar únicamente el JSON como `captura/<fecha>-geojson-maplibre.json`, y tomar una captura de pantalla del mapa mostrando la curva en la misma carpeta.
8. Verificar que todos los artefactos corresponden a esa misma solicitud, que no contienen tokens ni una ubicación personal, y contar los vértices de cada geometría para completar la tabla.
9. Apagar la captura: ejecutar `window.__capturarGeometria = false;`, detener el backend y limpiar la variable en PowerShell con `Remove-Item Env:CAPTURAR_GEOMETRIA` (o `unset CAPTURAR_GEOMETRIA` en Bash). No dejarla activa en staging ni producción.

## Rotondas/curvas candidatas

- Sugeridas como punto de partida: una glorieta principal sobre una vía arteria de Itagüí, u otra curva pronunciada conocida por el reporte original de fidelidad de curvas.
- La elección final la confirma el dueño del milestone al ejecutar la captura. No se fijan coordenadas candidatas aquí para evitar inventar o confundir ubicaciones.

## Criterios para completar la comparación

- ArcGIS crudo: contar los puntos de todos los `routes.features[0].geometry.paths` y comprobar en el código que la solicitud mantiene `outputLines: esriNAOutputLineTrueShape`.
- Normalizado backend: comparar el total y el orden de `puntos` con los paths crudos. La transformación esperada es solo `[lng, lat]` → `[lat, lng]`.
- GeoJSON MapLibre: comparar el total y el orden con el normalizado. La transformación esperada es solo `[lat, lng]` → `[lng, lat]`.
- OSRM: completar su fila únicamente si los archivos de esa sesión prueban que intervino; de lo contrario marcar **no intervino**.
- Resultado visual: registrar juicio humano sobre calzada, esquinas, separadores y edificios, adjuntando la captura. Sin esa observación no se valida GEOM-02.
- Confirmar por revisión de código que `prepararRuta()` y `localizarEnRuta()` siguen consumiendo `ruta.puntos`; esta fase no crea una geometría lógica alternativa.

## Conclusión (pendiente)

Pendiente de los artefactos reales y de la observación visual del Plan 04-02.
Hasta entonces no se afirma que GEOM-01 o GEOM-02 estén validados y no se
justifica ningún cambio de representación. Si la evidencia revela un problema,
cualquier ajuste futuro será exclusivamente visual y conservará `ruta.puntos`
como fuente de verdad para map matching, progreso y detección de desvíos.
