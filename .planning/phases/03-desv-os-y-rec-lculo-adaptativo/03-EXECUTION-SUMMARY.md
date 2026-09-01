# Fase 3 — Resumen de ejecución

**Fecha:** 2026-09-01
**Requisitos:** RECALC-01, RECALC-02

## Implementado

- `useNavegacion` conserva la proyección de `localizarEnRuta` y la geometría original, y añade evaluación de precisión, continuidad de velocidad y rumbo opcional.
- Un estado interno separa `normal`, `candidato`, `confirmado`, `solicitado` y `aplicado`; la solicitud solo ocurre al confirmar.
- Las respuestas usan identidad de sesión y generación monotónica. Una respuesta obsoleta no puede cambiar ruta, estado, contadores, voz, error ni UI; `detener` y `iniciar` invalidan solicitudes pendientes.
- Se mantienen el contrato de `rutasApi.resolver`, ArcGIS primario, OSRM fallback, el rate limit backend y la vista previa/origen manual.
- Las pruebas cubren salto aislado, precisión y señales opcionales, persistencia temporal, histéresis, confirmación inmediata, latest-request-wins, detener y nueva sesión.

## Calibración y coste

- `45 m`, `3` lecturas y `15 s` se conservan como baseline: el código previo usaba 45 m como entrada estricta, tres callbacks como persistencia y 15 s desde el inicio de cualquier cálculo como guardia de coste. No se redujeron.
- La entrada efectiva es `max(45 m, accuracy + 10 m)`: la lectura debe superar su radio de incertidumbre con margen, lo que reduce falsos positivos de baja precisión y no aumenta solicitudes en lecturas de alta precisión.
- La salida es `35 m`, una banda de 10 m bajo la entrada, para evitar alternancia por ruido cerca del límite y bucles facturables.
- La ventana de confirmación máxima es `15 s`: reutiliza el límite temporal heredado para que tres callbacks muy dispersos no se consideren persistencia; reinicia la candidatura, pero nunca añade espera tras confirmarla.
- Velocidad y rumbo solo contradicen una lectura cuando son valores finitos y físicamente incoherentes. Se usa una tolerancia amplia (`max(20 m, 3× desplazamiento esperado + 2× accuracy)`) y 120° de rumbo; `null`/ausente significa evidencia desconocida y no descarta la navegación.
- El umbral de 8 m solo decide cuándo confiar en el rumbo observado frente a la tangente local; no se reutiliza el umbral de 5 m de `useGeolocation` como calibración de desvío.

## Verificación ejecutada

- `npm run test -- --run src/hooks/useNavegacion.test.js` — 15/15.
- `npm run test -- --run` — suite frontend completa.
- `npm run lint` — sin errores.
- `npm run build` — correcto; Vite mantiene únicamente el warning existente de chunks mayores a 500 kB.

No se modificaron `geoRuta.js`, `api.js`, backend, proveedores de rutas ni otros worktrees.
