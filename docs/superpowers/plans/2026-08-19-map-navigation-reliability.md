# Map Navigation Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make route tracking trustworthy when GPS is unavailable or imprecise, and make map orientation deterministic across navigation state changes.

**Architecture:** Keep ArcGIS route resolution behind the existing Express proxy and preserve `{ lat, lng }` as the application boundary type. Add a pure GPS acceptance policy, use an explicit preview state for manual origins, and make MapLibre camera transitions depend on one navigation-camera state instead of competing effects.

**Tech Stack:** React 19, MapLibre GL, Express, ArcGIS World Route, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-map-navigation-audit.md`

## Global Constraints

- Do not expose ArcGIS credentials to the browser.
- Keep ArcGIS requests at `POST /api/rutas/resolver` and preserve the OSRM fallback.
- Keep the existing `walk` and `car` travel-mode identifiers.
- Do not use a simulated coordinate for live navigation decisions.
- Serve browser geolocation only over HTTPS or localhost.

---

## Priority and dependency order

| Priority | Work package | Why it blocks release | Depends on |
|---|---|---|---|
| P0 | Decide the GPS contract | The app cannot distinguish a fresh, usable fix from a stale or simulated one without fixed thresholds. | None |
| P1 | GPS acceptance and error recovery | Prevents false progress, arrival, recalculation, and jumps to Itagüí after signal loss. | P0 |
| P1 | Preview versus live state | Prevents a manual/fallback route from claiming real-time tracking. | P0, GPS contract |
| P1 | Automated test harness and route contract tests | Makes the P1 fixes repeatable and protects A→B coordinate ordering. | None; must land before P1 verification |
| P2 | Camera ownership and orientation | Removes `fitBounds`/`easeTo` races, improves course-up, and preserves user camera intent. | Preview/live state |
| P2 | Documentation and physical-device release check | Aligns README with MapLibre and records the only checks that require a real phone. | P1, camera |

### P0 decision record (must be approved before implementation)

- `MAX_ACCURACY_M = 50`.
- `MAX_FIX_AGE_MS = 5_000`; a live session becomes non-live after this TTL.
- `MAX_CACHED_FIX_AGE_MS = 1_000`; `watchPosition` uses `maximumAge: 1000` and `timeout: 5000` during live navigation.
- A fix is accepted only when `timestamp` is strictly newer than the last accepted fix, `accuracy` is finite and at most 50 m, and the timestamp is not older than the TTL.
- A manual origin or the Itagüí fallback can calculate a route preview only. It cannot enter `navegando`, update progress, announce voice instructions, detect arrival, or trigger recalc.
- A temporary GPS error preserves the last trusted coordinate for display but marks it non-live. The fallback is allowed only before the first trusted fix exists.
- A route preview must remain visible in the route map, so `mostrarTrayecto` includes `previsualizando` while `enSeguimiento` remains limited to trusted `navegando`.
- The accepted GPS fix is exposed immediately to navigation logic, camera, ETA, and heading. Only the rendered marker may interpolate, with no more than one update of visual lag.

### Dependency graph

`P0 contract → test harness + GPS policy → preview/live state → camera → docs/device gate`

### Task 1: Add an executable map-navigation test harness

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.js`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/utilidades/geoRuta.test.js`

**Interfaces:**
- Consumes: exported pure functions from `src/utilidades/geoRuta.js`.
- Produces: `npm run test` and a regression suite runnable without a device GPS.

- [ ] **Step 1: Add the test dependencies and script**

Add `"test": "vitest run"` to scripts, and add `vitest`, `jsdom`, and `@testing-library/react` under `devDependencies`.

- [ ] **Step 2: Create the configuration**

Create `frontend/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.js'] },
});
```

Create `frontend/src/test/setup.js` with deterministic browser shims:

```js
import { vi } from 'vitest';

Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
});

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
```

- [ ] **Step 3: Write the geometry regressions**

Create `frontend/src/utilidades/geoRuta.test.js` and add the route API contract test alongside the geometry tests. The contract test must mock `fetch`, call `rutasApi.resolver({lat: 6.17, lng: -75.61}, {lat: 6.171, lng: -75.61}, 'walk')`, parse the request body, and assert that `body.origen` precedes `body.destino` and both retain `{lat, lng}` keys.

```js
import { describe, expect, it } from 'vitest';
import { distanciaM, localizarEnRuta, prepararRuta, rumbo } from './geoRuta';

describe('geoRuta', () => {
  it('projects a position onto the correct route segment', () => {
    const ruta = prepararRuta({ puntos: [[6.17, -75.61], [6.171, -75.61]], pasos: [] });
    const ubicacion = localizarEnRuta(ruta, [6.1705, -75.61]);
    expect(ubicacion.desviacionM).toBeLessThan(0.5);
    expect(ubicacion.restanteM).toBeCloseTo(distanciaM([6.1705, -75.61], [6.171, -75.61]), 0);
  });

  it('keeps bearings in the north-clockwise convention', () => {
    expect(rumbo([6.17, -75.61], [6.171, -75.61])).toBeCloseTo(0, 0);
    expect(rumbo([6.17, -75.61], [6.17, -75.609])).toBeCloseTo(90, 0);
  });
});
```

- [ ] **Step 4: Verify it**

Run: `npm --prefix frontend run test`

Expected: both geometry tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.js frontend/src/test/setup.js frontend/src/utilidades/geoRuta.test.js
git commit -m "test: add map navigation test harness"
```

### Task 2 (P1): Accept only trustworthy GPS fixes

**Files:**
- Modify: `frontend/src/hooks/useGeolocation.js`
- Create: `frontend/src/hooks/useGeolocation.test.js`

**Interfaces:**
- Consumes: `GeolocationPosition` values from `watchPosition`.
- Produces: `{ position, isSimulated, gpsConfiable, ultimaActualizacion }`.

- [ ] **Step 1: Write the failing position-policy test**

Mock `navigator.geolocation.watchPosition`. Feed a 10 m accurate fix, then a fix with an older timestamp and a 120 m accurate fix. Assert that the first fix remains exposed and that `gpsConfiable` becomes false for the rejected sample.

- [ ] **Step 2: Add the acceptance helper**

In `useGeolocation.js`, add a helper that rejects non-increasing timestamps, fixes older than 5 seconds during live mode, and accuracy over 50 m. Store `pos.timestamp` in a ref and expose `ultimaActualizacion` plus `gpsConfiable`. Configure the live watch with `enableHighAccuracy: true`, `maximumAge: 1000`, and `timeout: 5000`; keep the non-live watch low-power.

```js
function aceptarLecturaGps(pos, ultimoTimestamp) {
  const accuracy = pos.coords.accuracy;
  const vigente = Date.now() - pos.timestamp <= 5_000;
  return Number.isFinite(accuracy) && accuracy <= 50 && pos.timestamp > ultimoTimestamp && vigente;
}
```

- [ ] **Step 3: Preserve the last trusted fix after an error**

Change `handleError` so it creates the Itagüí fallback only if no trusted fix has ever been accepted. Otherwise keep the last position on screen and set `gpsConfiable` false; never replace it with a distant synthetic coordinate. A rejected success callback must not update `ultimaCoordRef`, `rumboRef`, `position`, progress, or recalculation counters. Expose the accepted position immediately; do not apply the visual interpolation filter inside the hook used by navigation.

- [ ] **Step 4: Verify it**

Run: `npm --prefix frontend run test -- useGeolocation.test.js`

Expected: stale, imprecise, temporary-error, and latency/freshness cases pass; the accepted fix is observable without waiting for a second callback.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useGeolocation.js frontend/src/hooks/useGeolocation.test.js
git commit -m "fix: reject stale GPS fixes during navigation"
```

### Task 3 (P1): Separate static route previews from live tracking

**Files:**
- Modify: `frontend/src/hooks/useNavegacion.js`
- Modify: `frontend/src/componentes/detalle/RouteModal.jsx`
- Modify: `frontend/src/componentes/detalle/InteractiveMap.jsx`
- Create: `frontend/src/hooks/useNavegacion.test.js`

**Interfaces:**
- Consumes: `position`, `isSimulated`, `gpsConfiable`, and optional `origenManual`.
- Produces: `estado: 'previsualizando' | 'calculando' | 'navegando' | 'llegado' | 'error'`.

- [ ] **Step 1: Write the failing manual-origin regression**

Mock `rutasApi.resolver` and start a route with `origenManual` and untrusted GPS. Assert that the route is visible, the state is `previsualizando`, `fueraDeRuta` is false, and no second resolver call occurs after simulated fixes.

- [ ] **Step 2: Implement the preview state**

After `calcular`, select `previsualizando` whenever the origin is manual or GPS is not trustworthy. Run the position-following effect only in live mode. Do not automatically promote preview to live when a later GPS fix arrives; require a new explicit start so the A point is recalculated from the trusted fix.

```js
const seguirEnVivo = estado === 'navegando' && gpsConfiable && !isSimulated;
if (!seguirEnVivo || !position || !rutaRef.current || !destino) return;
```

- [ ] **Step 3: Correct the displayed state**

In `RouteModal.jsx`, show “Vista previa: activa el GPS para seguimiento en vivo” for `previsualizando`; hide progress, live ETA, arrival, voice, and automatic recalculation for that state.

In `InteractiveMap.jsx`, include `previsualizando` in `mostrarTrayecto` so the route remains visible, but keep `enSeguimiento = mostrarTrayecto && navegando && gpsConfiable && !isSimulated`. Disable the recenter-follow camera and user arrow course-up in preview.

- [ ] **Step 4: Verify it**

Run: `npm --prefix frontend run test -- useNavegacion.test.js`

Expected: manual-origin routes never claim live tracking.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useNavegacion.js frontend/src/componentes/detalle/RouteModal.jsx frontend/src/hooks/useNavegacion.test.js
git commit -m "fix: distinguish route preview from live navigation"
```

### Task 4 (P2): Make camera ownership and north reset deterministic

**Files:**
- Modify: `frontend/src/componentes/detalle/InteractiveMap.jsx`
- Create: `frontend/src/componentes/detalle/InteractiveMap.test.jsx`

**Interfaces:**
- Consumes: `navegando`, `posicion.heading`, `siguiendo`, and route geometry.
- Produces: one `map.easeTo` transition for each active-navigation GPS fix.

- [ ] **Step 1: Write the failing camera-order test**

Mock the MapLibre ref with `easeTo`, `fitBounds`, and `getBearing`. Assert that changing to `navegando` ends at the user coordinate with `bearing: heading` and `pitch: 50`, and that no later `fitBounds` overrides it. Assert that leaving navigation calls `easeTo` with `bearing: 0` and `pitch: 0`.

- [ ] **Step 2: Restrict fit-bounds to preview**

Guard the route-fit effect so it runs before tracking, not for a live route. Reset `siguiendo` to true when a new live-navigation session begins.

```js
if (!mapListo || !mostrarTrayecto || navegando || !ruta?.puntos?.length) return;
```

- [ ] **Step 3: Stop a superseded transition**

Before every live `easeTo`, call `map.stop()`. Keep duration at or below 250 ms so a 1 Hz fix never queues animations, and only use a finite heading. With no heading, preserve the existing bearing. The camera consumes the accepted GPS coordinate directly, not the marker's interpolated coordinate.

Outside navigation, stop moving the map on every GPS update after the initial center. A user pan/zoom in the informational map must persist; recenter only through an explicit control. In live mode, any drag, rotate, or pitch gesture pauses following and exposes the existing recenter control.

- [ ] **Step 4: Verify it**

Run: `npm --prefix frontend run test -- InteractiveMap.test.jsx`

Run: `npm --prefix frontend run lint && npm --prefix frontend run build`

Expected: camera tests, lint, and production build pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/detalle/InteractiveMap.jsx frontend/src/componentes/detalle/InteractiveMap.test.jsx
git commit -m "fix: stabilize navigation camera transitions"
```

### Task 5 (P2): Align documentation and verify the deployed flow with controlled permissions

**Files:**
- Modify: `frontend/DOCUMENTACION_RUTAS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: a real mobile HTTPS session with known permission state.
- Produces: a repeatable release checklist.

- [ ] **Step 1: Add the release checklist**

Correct the architecture text from Leaflet/CARTO to the actual MapLibre/ArcGIS basemap implementation, then document these checks: fresh permission grant, accuracy below 50 m, route from A to B in walking and driving modes, a 50 m deliberate deviation, one noisy 50 m jump versus three confirmed readings, GPS loss after a trusted fix, manual-origin preview, route finish, and north-up map after navigation.

- [ ] **Step 2: Run the checks on a physical phone**

Use the production HTTPS URL. Record accuracy, timestamp, route provider, route mode, and whether the displayed state matches the permission state. Do not store the person's precise coordinates in the repository.

- [ ] **Step 3: Commit**

```bash
git add frontend/DOCUMENTACION_RUTAS.md
git commit -m "docs: add map navigation release checklist"
```
