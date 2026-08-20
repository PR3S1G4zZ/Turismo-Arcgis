# Task 5 report — documentation and physical-device release gate

## Changes

- Updated `README.md` from the obsolete Leaflet/CARTO architecture to the
  actual MapLibre GL + `react-map-gl` map implementation, including the ArcGIS
  basemap style and CARTO fallback distinction.
- Updated `frontend/DOCUMENTACION_RUTAS.md` with the GPS acceptance contract:
  precision ≤50 m, monotonic timestamp, live freshness ≤5 s,
  `maximumAge: 1000`, and `timeout: 5000`.
- Documented raw accepted GPS position semantics, preservation of the last
  trusted coordinate after temporary signal loss, static manual/simulated
  previews, and live-only progress/arrival/voice/recalculation.
- Documented preview `fitBounds`, trusted-live course-up, north-up/pitch-zero
  exit, gesture pause/recenter, and informational-map pan/zoom preservation.
- Added a production HTTPS physical-device checklist that records only
  non-sensitive results and explicitly forbids personal coordinates/traces.

## Verification

Commands executed with the bundled Node/npm CLI:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' --prefix frontend run test
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' --prefix frontend run lint
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' --prefix frontend run build
```

- Tests: PASS — 5 files, 19 tests at Task 5 completion. Post-Task-5 final UI
  verification at `9bb67ef`: PASS — 6 files, 21 tests.
- Lint: PASS.
- Production build: PASS. Vite reports the existing non-blocking warning for
  chunks larger than 500 kB after minification.
- Documentation scan: no obsolete claims that Leaflet/CARTO is the navigation
  architecture remain in the updated documents.

## Release gate still requiring external execution

The HTTPS physical-device checklist in `frontend/DOCUMENTACION_RUTAS.md` has
been prepared but cannot be truthfully marked complete without a deployed HTTPS
URL, a device, controlled permissions, and real GPS conditions. Record the
checklist outcomes without storing personal coordinates.
