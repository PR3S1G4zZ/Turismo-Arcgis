# Wave A report: GPS and navigation state

## Implementation commit

`8f15dd15edc38523507596844301a0f1504486f9` — `fix: make GPS navigation state trustworthy`

## Delivered

- Added a Vitest/jsdom test harness and `npm run test`.
- Enforced timestamp ordering, 50 m accuracy, a 5 s live freshness window, and live watch options.
- Preserved the last trusted location after temporary GPS failure, exposing `gpsConfiable` and `ultimaActualizacion` while retaining `posicionSimulada`.
- Added the `previsualizando` state for manual or simulated origins, suppressing route following, arrival, voice, and automatic recalculation.
- Updated the route modal to identify previews and hide live navigation controls and metrics.

## TDD evidence

The focused red runs failed before implementation for the expected missing behavior:

- `useGeolocation.test.js`: existing watch options were `maximumAge: 0` / `timeout: 10000`, and `gpsConfiable` was absent.
- `useNavegacion.test.js`: a manual origin route reached `llegado` rather than `previsualizando`.

## Verification

| Command | Result |
| --- | --- |
| `npm --prefix frontend run test -- src/hooks/useGeolocation.test.js` | Red: 4 expected failures before implementation |
| `npm --prefix frontend run test -- src/hooks/useNavegacion.test.js` | Red: 1 expected failure before implementation |
| `npm --prefix frontend run test -- src/hooks/useGeolocation.test.js src/hooks/useNavegacion.test.js src/utilidades/geoRuta.test.js` | Green: 3 files, 8 tests |
| `npm --prefix frontend run test` | Green: 3 files, 8 tests |
| `npm --prefix frontend run lint` | Green |
| `npm --prefix frontend run build` | Green |

## Concerns

- The production build reports existing large chunks over 500 kB; it succeeds, but code splitting remains a separate performance concern.
- `InteractiveMap.jsx` was intentionally not edited. Its owner must ensure that `previsualizando` renders the static route without activating the live follow camera.

## QA correction round

- Removed position smoothing from `useGeolocation`; navigation and camera now receive each accepted raw fix immediately, while marker-only interpolation remains owned by `InteractiveMap`.
- Added jsdom shims for `matchMedia`, `ResizeObserver`, and animation frames.
- Kept preview in low-power GPS mode and verified that a later trustworthy GPS state does not auto-promote a preview.
- Added the direct `rutasApi` POST-body contract test, a >5 s freshness regression, and last-fix status in `RouteModal`.

| Command | Result |
| --- | --- |
| `npm --prefix frontend run test -- src/hooks/useGeolocation.test.js src/hooks/useNavegacion.test.js src/utilidades/api.test.js` | Green: 3 files, 9 tests |
| `npm --prefix frontend run test` | Green: 4 files, 11 tests |
| `npm --prefix frontend run lint` | Green |
| `npm --prefix frontend run build` | Green; existing chunk-size warning only |
