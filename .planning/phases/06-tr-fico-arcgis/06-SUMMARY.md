# Fase 6: Tráfico ArcGIS — Resumen

**Fecha:** 2026-09-01  
**Requisitos:** TRAFFIC-01 completado; TRAFFIC-02 investigado y pendiente de decisión

## TRAFFIC-01 — Ruteo sensible al tráfico

El contrato de `POST /api/rutas/resolver` conserva todos sus campos previos y
agrega:

- `traficoSolicitado`: `true` únicamente para una ruta `car` resuelta por
  ArcGIS.
- `traficoAplicado`: `true` únicamente cuando el `travelMode` real declara
  `impedanceAttributeName: "TravelTime"` y la solicitud ArcGIS acepta
  `startTime: "now"`.
- `degradacionTrafico`: causa comprobable cuando una ruta en auto no usa
  tráfico (`travel-mode-sin-impedancia-de-trafico` o
  `proveedor-osrm-sin-trafico`); `null` cuando no corresponde.

El modo peatonal no envía parámetros de tráfico y devuelve ambos booleanos en
`false`. OSRM permanece como fallback sin tráfico y lo declara explícitamente.
No se fuerza una impedancia distinta de la configurada por la organización y
no se afirma cobertura calle por calle.

## Evidencia aplicada

La investigación oficial registrada en `06-RESEARCH.md` respalda
`startTime="now"` y `TravelTime` para ruteo con tráfico, además de cobertura
predictiva a nivel Colombia. La implementación inspecciona el travel mode real
antes de enviar `startTime`; no usa como garantía el nombre estándar
"Driving Time". No se afirma un costo adicional ni su ausencia porque las
fuentes públicas no lo confirman de forma contractual.

## TRAFFIC-02 — Capa visual

No se implementó la capa visual. Permanece pendiente porque el Traffic Map
Service es dinámico, no tiene integración oficial documentada con MapLibre, y
su costo, privilegios, atribución regional y rendimiento móvil no están
confirmados con evidencia suficiente. Cualquier spike futuro deberá estar
detrás de un feature flag apagado por defecto. No se migró ni se propuso migrar
al ArcGIS Maps SDK.

## Verificación

- Backend: pruebas de contrato con `node:test` para auto con `TravelTime`, auto
  sin impedancia compatible, modo peatonal y fallback OSRM.
- Frontend: suite Vitest y ESLint.
- Build frontend de producción.
- No se ejecutó una llamada facturable contra credenciales reales; las pruebas
  usan respuestas ArcGIS/OSRM controladas y no contienen tokens reales.
