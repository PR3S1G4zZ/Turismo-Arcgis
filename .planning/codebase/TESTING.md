# Testing Patterns

**Analysis Date:** 2026-09-01

## Test Framework

**Runner:**
- Vitest 4.1.11 (frontend only)
- Config: `frontend/vitest.config.js`
- Environment: jsdom (browser-like DOM environment)
- Setup: `frontend/src/test/setup.js` (polyfills for browser APIs)

**Assertion Library:**
- Vitest built-in `expect()` (compatible with Jest)

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test -- --watch   # Watch mode (auto-rerun on changes)
npm run test -- --coverage  # Coverage report (if configured)
```

**Backend Testing:**
- No testing framework installed or configured
- No test files exist in `backend/src/`
- Recommend adding Jest or Vitest when backend tests are needed

## Test File Organization

**Location:**
- Co-located with source files (same directory)
- Test file next to source file: `src/hooks/useGeolocation.js` → `src/hooks/useGeolocation.test.js`

**Naming:**
- `.test.js` suffix (e.g., `geoRuta.test.js`, `useGeolocation.test.js`)
- Alternative `.spec.js` also supported by Vitest but not used in this codebase

**Structure:**
```
frontend/src/
  hooks/
    useGeolocation.js
    useGeolocation.test.js      ← co-located
  utilidades/
    geoRuta.js
    geoRuta.test.js              ← co-located
  componentes/
    detalle/
      InteractiveMap.jsx
      InteractiveMap.test.jsx     ← co-located
  test/
    setup.js                      ← shared test setup
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('geoRuta', () => {
  it('projects a position onto the correct route segment', () => {
    // Arrange
    const ruta = prepararRuta({ puntos: [[0, 0], [0.001, 0]], pasos: [] });
    
    // Act
    const ubicacion = localizarEnRuta(ruta, [0.0005, 0]);

    // Assert
    expect(ubicacion.desviacionM).toBeLessThan(0.5);
  });

  it('keeps bearings in the north-clockwise convention', () => {
    expect(rumbo([0, 0], [0.001, 0])).toBeCloseTo(0, 0);
  });
});
```

**Patterns:**
- **Setup**: `beforeEach(() => { ... })` — runs before each test
  - Mocking navigator APIs, resetting module state
  - Example: `vi.resetModules()`, `Object.defineProperty(navigator, 'geolocation', { ... })`
- **Teardown**: `afterEach(() => { ... })` — cleanup after each test
  - Reset timers: `vi.useRealTimers()`
  - Clear mocks: `vi.clearAllMocks()`, `vi.unstubAllGlobals()`
  - Clean up DOM: `cleanup()` from `@testing-library/react`
- **Assertion**: `expect().toBe()`, `expect().toBeCloseTo()`, `expect().toHaveBeenCalled()`

## Mocking

**Framework:** Vitest's `vi` object (compatible with Jest)

**Patterns:**
```javascript
// Mock a module entirely
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('react-map-gl/maplibre', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props, ref) => {
      // Custom mock implementation
      return <div data-testid="map" />;
    }),
  };
});

// Mock individual functions
const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
vi.stubGlobal('fetch', fetch);

// Verify calls
expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rutas'), ...);
expect(fetch).toHaveBeenCalledTimes(1);
```

**What to Mock:**
- Browser APIs: `navigator.geolocation`, `window.matchMedia`, `ResizeObserver`
- External modules: `react-map-gl`, `maplibre-gl` (CSS/rendering)
- API calls: `fetch`, backend services (`mapaApi`, `rutasApi`)
- Dependencies that cause side effects or are slow (HTTP requests, timers)

**What NOT to Mock:**
- Pure utility functions (math, formatting) — test the real logic
- Custom hooks (use real implementation unless testing isolation)
- User interactions (use real `act()`, `fireEvent()`, or user-event)
- DOM state and React rendering (use real rendering)

## Fixtures and Factories

**Test Data:**
```javascript
// Fixture function (factory pattern)
function fix({ timestamp, accuracy = 10, latitude = 0, longitude = 0 } = {}) {
  return {
    timestamp,
    coords: { latitude, longitude, accuracy, heading: null, speed: null },
  };
}

// Helper for complex object setup
function navigation(overrides = {}) {
  return {
    posicion: position,
    posicionSimulada: false,
    gpsConfiable: true,
    tramos: { recorrido: [], restante: puntos },
    ruta: { puntos },
    navegando: true,
    llegado: false,
    previsualizando: false,
    ...overrides,
  };
}

// Usage in test
const ubicacion = fix({ timestamp: Date.now(), latitude: 6.17 });
const navContext = navigation({ navegando: false });
```

**Location:**
- Fixtures defined at module level in test file (top after imports)
- Shared fixtures across multiple test files could be moved to `frontend/src/test/fixtures.js` (not yet present)

## Coverage

**Requirements:** 
- Not enforced (no `--coverage` command or threshold in package.json)
- Coverage gaps exist: backend has zero tests, frontend coverage percentage unknown

**View Coverage:**
```bash
npm run test -- --coverage
```
(Requires coverage reporter configuration in `vitest.config.js`)

## Test Types

**Unit Tests:**
- Scope: Individual functions and utility modules
- Approach: Test input → output, no side effects
- Example: `geoRuta.test.js` tests `distanciaM`, `rumbo`, `formatearDistancia` in isolation
- Pattern: Simple arrange-act-assert with real data

**Integration Tests:**
- Scope: Hooks with real React state, component rendering with mocked deps
- Approach: Render component/hook, simulate user interaction or state change, verify output
- Example: `useGeolocation.test.js` tests hook lifecycle with mocked `navigator.geolocation`
- Example: `InteractiveMap.test.jsx` tests component camera updates when route state changes
- Pattern: Use `renderHook()` for hooks, `render()` for components, `waitFor()` for async state

**E2E Tests:**
- Not implemented
- Would require: Cypress, Playwright, or similar
- Recommended for: Full user flows (search site → start route → navigate → arrival)

## Common Patterns

**Async Testing:**
```javascript
// Hook with async setup
it('uses the live watch policy while navigating', async () => {
  const { useGeolocation } = await import('./useGeolocation');
  renderHook(() => useGeolocation({ precisionAlta: true }));

  await waitFor(() => expect(watchOptions).toBeDefined());
  expect(watchOptions).toEqual({ enableHighAccuracy: true, ... });
});

// Component with async data
await waitFor(() => expect(map.easeTo).toHaveBeenCalled());

// API call
const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ... }) });
await rutasApi.resolver(origin, destination, 'walk', 'Destino');
expect(fetch).toHaveBeenCalledWith(...);
```

**State Updates (act):**
```javascript
// Call event or state setter inside act()
act(() => success(fix({ timestamp: now, latitude: 0 })));
await waitFor(() => expect(result.current.gpsConfiable).toBe(true));

// Component event
act(() => mapProps.onDragStart());
expect(screen.getByRole('button', { name: /centrar/ })).toBeTruthy();
```

**DOM Queries:**
```javascript
// Get by role (preferred)
const button = screen.getByRole('button', { name: /centrar en mí/i });

// Get by test ID
const map = screen.getByTestId('map');

// Query variants
getBy...   // throws if not found
queryBy... // returns null if not found
findBy...  // returns promise, waits for element
```

**Conditional Rendering & Effects:**
```javascript
// Wait for side effect to complete
await waitFor(() => expect(success).toBeTypeOf('function'));

// Verify re-render on prop change
view.rerender(
  <NavegacionContext.Provider value={navigation({ navegando: false })}>
    <InteractiveMap site={site} showRoute />
  </NavegacionContext.Provider>
);
expect(map.easeTo).not.toHaveBeenCalled();
```

**Error Testing:**
```javascript
it('rejects a fix whose accuracy exceeds 50 metres', async () => {
  const { useGeolocation } = await import('./useGeolocation');
  const { result } = renderHook(() => useGeolocation({ precisionAlta: true }));

  await waitFor(() => expect(success).toBeTypeOf('function'));
  act(() => success(fix({ accuracy: 51 })));

  await waitFor(() => expect(result.current.gpsConfiable).toBe(false));
  expect(result.current.position).toBeNull();
});
```

## Setup File

**Purpose:** `frontend/src/test/setup.js` configures jsdom environment for tests

**Content:**
```javascript
// Mock matchMedia (used by MapLibre for responsive behavior)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfill ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserver;

// Polyfill requestAnimationFrame (used for animations)
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
```

**What It Does:**
- Makes MapLibre GL tests work in jsdom (no real DOM rendering)
- Provides ResizeObserver for layout calculations
- Provides RAF/CAF for animation frame tests

## Test Coverage Gaps

**Untested Areas:**
- Backend: Zero tests (recommend starting with auth routes and database queries)
- Frontend coverage unknown (no coverage report generated)
- Likely gaps:
  - Error states in components (ErrorBoundary if used)
  - Accessibility (aria-labels, keyboard navigation)
  - Mobile-specific behavior (touch events, orientation change)
  - Internationalization edge cases
  - Network failures and timeouts beyond basic error messages

**Priority Additions:**
1. Backend tests: auth routes, database transactions
2. Frontend: component integration with full context providers
3. E2E: critical user flows (search → route → navigate)

---

*Testing analysis: 2026-09-01*
