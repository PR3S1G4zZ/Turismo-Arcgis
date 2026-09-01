# Revisión de preparación para producción

**Fecha:** 2026-09-01
**Rama:** `PR3S1G4zZ/chore-multiagent-dev-station`
**Alcance:** integración de las fases 1-7, verificación automatizada y revisión de configuración.

## Resultado ejecutivo

El código integrado está listo para publicarse en la rama remota después de esta
revisión. El despliegue público queda en **NO-GO provisional** hasta completar la
prueba en dispositivos físicos y configurar los secretos y credenciales reales
del entorno de producción.

## Verificaciones ejecutadas

| Área | Comando | Resultado |
|---|---|---|
| Backend Vitest | `npm.cmd test` en `backend/` | 8/8 passed |
| Backend Node | `npm.cmd run test:node` en `backend/` | 5/5 passed |
| Frontend Vitest | `npm.cmd test` en `frontend/` | 86/86 passed |
| Frontend lint | `npm.cmd run lint` en `frontend/` | exit 0 |
| Frontend build | `npm.cmd run build` en `frontend/` | exit 0 |
| Imagen de producción | `docker build -t turismo-itagui:production-review .` | exit 0 con Node 22 |
| Auditoría frontend | `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnerabilidades |
| Formato del diff | `git diff --check` | sin errores |

El build informa chunks JavaScript grandes de MapLibre (aprox. 1 MB); es una
advertencia de rendimiento, no un fallo de compilación.

## Cambios de endurecimiento aplicados

- Se eliminó la doble medición de `GPS → marcador` en `InteractiveMap`.
- Se separaron los runners Vitest y `node:test`; la prueba de captura geométrica
  quedó bajo `backend/test/`.
- Se actualizaron los contratos de tráfico y se eliminaron placeholders que ya
  estaban cubiertos por pruebas reales.
- ArcGIS y OSRM tienen timeout configurable mediante
  `ROUTING_HTTP_TIMEOUT_MS` (8 s por defecto), con fallback a OSRM.
- En producción se rechaza un `JWT_SECRET` ausente, corto o de ejemplo.
- La contraseña seed conocida no se utiliza en producción.
- El contenedor usa Node 22, compatible con las dependencias actuales del frontend.

## Riesgos y pendientes

- Backend: `node-ical@0.20.1` arrastra 2 vulnerabilidades moderadas en `uuid`.
  `npm audit fix --force` propone `node-ical@0.27.1`, un cambio mayor que no se
  incorporó sin una validación específica del calendario.
- No hay dispositivo Android/iPhone conectado en esta sesión (`adb devices` no
  reportó dispositivos). Por ello no se han validado Wake Lock, GPS, brújula,
  latencias p95, pérdida de señal, segundo plano ni la geometría real de una
  rotonda.
- La capa visual de tráfico permanece diferida por decisión de alcance; el
  ruteo `TravelTime`/`startTime=now` sí está integrado cuando ArcGIS lo soporta.
- Producción debe usar `NODE_ENV=production`, un `JWT_SECRET` único de al menos
  32 caracteres, `SEED_ADMIN_PASSWORD` no predeterminada, `CORS_ORIGIN` real,
  `PUBLIC_URL` HTTPS y credenciales ArcGIS. OSRM es solo respaldo de desarrollo.

## Decisión

**Push de la rama:** autorizado por el responsable.
**Deploy a producción:** pendiente de UAT físico, revisión de la vulnerabilidad
moderada de `node-ical` y confirmación de variables de entorno de producción.
