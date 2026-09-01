<!-- refreshed: 2026-09-01 -->
# Architecture

**Analysis Date:** 2026-09-01

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 19 + Vite)                       │
│     MapLibre GL Viewer + Leaflet Admin + React Router SPA                │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Pages (Home, Site, Admin,    │ Components (Maps, Cards, Forms, Admin   │
│ Calendar, PQRS)              │ Dashboard) `frontend/src/componentes`    │
│ `frontend/src/paginas`       │                                          │
├──────────────────┬───────────┴──────────────────────┬────────────────────┤
│ Contexts         │ Hooks (Nav, Geo, Orientation)   │ Utilities (API,     │
│ (AppProvider,    │ & Services `frontend/src/hooks` │ GeoRuta, Events)    │
│ NavegacionProv)  │                                  │ `frontend/src/util` │
└────────┬─────────┴──────────────────────────────────┴─────────┬──────────┘
         │                                                      │
         └──────────────────────┬───────────────────────────────┘
                                │ HTTP (JSON)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  BACKEND (Express.js + MySQL + Node.js)                  │
│              REST API: Auth, Data CRUD, Routing, Webhooks                │
├─────────────────────┬───────────────────┬──────────────┬─────────────────┤
│ Routes: auth, sites,│ Middleware: JWT,  │ Utils:       │ Services:       │
│ announcements,      │ auth, errors,     │ geocoding,   │ ArcGIS Routing  │
│ events, PQRS,       │ rate-limiting     │ routing      │ (with OSRM      │
│ calendar, mapa,     │ `src/middleware`  │ (ArcGIS +    │ fallback)       │
│ geocode, routing    │                   │ OSRM)        │                 │
│ `src/routes`       │                   │ `src/utils`  │ `src/utils/*`  │
├─────────────────────┴───────────────────┴──────────────┴─────────────────┤
│ Config: database, JWT, ArcGIS, seeds `src/config.js`                     │
│ Database Layer: MySQL pool + schema + queries `src/db.js`                │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         MySQL Database                                    │
│  Schema: users, sites, announcements, events, pqrs, settings, visit_log  │
│  `BD/schema.sql`                                                          │
└──────────────────────────────────────────────────────────────────────────┘

External Services:
  ├─ ArcGIS Route Service (routing, geocoding, token)
  ├─ OSRM (fallback routing)
  ├─ Nominatim (geocoding from browser)
  └─ Google Calendar (events proxy)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App Provider | Global state: sites, announcements, events, PQRS, auth session | `frontend/src/contexto/AppProvider.jsx` |
| Navegacion Provider | Navigation state: active route, mode, progress, instructions | `frontend/src/contexto/NavegacionProvider.jsx` |
| Home Page | Public portal landing, site grid with search/filter | `frontend/src/paginas/Home.jsx` |
| SiteDetailPage | Site info card, map preview, route launch button | `frontend/src/paginas/SiteDetailPage.jsx` |
| InteractiveMap | MapLibre GL renderer, GPS marker animation, course-up rotation | `frontend/src/componentes/detalle/InteractiveMap.jsx` |
| RouteModal | Navigation panel: step-by-step instructions, ETA, progress bar | `frontend/src/componentes/detalle/RouteModal.jsx` |
| AdminPage | CRUD interface for sites, announcements, events, users (Leaflet) | `frontend/src/paginas/AdminPage.jsx` |
| CalendarPage | Events list/calendar view with Google Calendar proxy | `frontend/src/paginas/CalendarPage.jsx` |
| PqrsPage | Citizen submissions (inclusion, updates, complaints) | `frontend/src/paginas/PqrsPage.jsx` |
| Auth Routes | POST login, GET /me, PATCH password, roles (superadmin/admin) | `backend/src/routes/auth.js` |
| Sites Routes | GET/POST/PUT/DELETE, visit tracking, geocoding | `backend/src/routes/sites.js` |
| Routing Routes | POST /resolver (route calculation), GET /estado (provider status) | `backend/src/routes/routing.js` |
| useNavegacion Hook | Real-time navigation engine: GPS tracking, route projection, recalc | `frontend/src/hooks/useNavegacion.js` |
| useGeolocation Hook | GPS + compass reading, high-accuracy vs low-power modes | `frontend/src/hooks/useGeolocation.js` |
| geoRuta Utils | Geometry: distance, bearing, route projection, progress | `frontend/src/utilidades/geoRuta.js` |
| API Client | Single fetch wrapper, token injection, error normalization | `frontend/src/utilidades/api.js` |
| Config | Centralized env vars: database, JWT, ArcGIS, seeds | `backend/src/config.js` |
| Database Layer | MySQL pool, schema creation, query helper | `backend/src/db.js` |

## Pattern Overview

**Overall:** Modular REST API + SPA with tightly-coupled real-time navigation features.

**Key Characteristics:**
- **Backend-First Auth**: JWT tokens stored in localStorage, validated on protected routes via middleware
- **Stateless API**: No session store; each request re-validates the token
- **Dual Mapping Library**: MapLibre GL (public navigation) + Leaflet (admin edit UI) — NOT ArcGIS SDK
- **Proxy Architecture**: Frontend never holds ArcGIS API keys; backend brokers routing and geocoding requests
- **Real-Time Navigation**: GPS + Waze-style turn-by-turn via client-side route projection (not relying on server websockets)
- **Fallback Routing**: ArcGIS primary (with token), OSRM secondary (no key needed, open data)
- **Optimistic UI**: Frontend loads data upfront in AppProvider, modifies local state immediately, syncs to backend
- **Rate Limiting**: Routing endpoint capped at 60 requests/5min to protect against ArcGIS billing surprises

## Layers

**Frontend - Presentation (React Components):**
- Purpose: Render UI, handle user input, manage visual state
- Location: `frontend/src/componentes`, `frontend/src/paginas`
- Contains: JSX components, page layouts, styled with vanilla CSS
- Depends on: Context (AppProvider, NavegacionProvider), hooks (useNavegacion, useGeolocation), API client
- Used by: User browser

**Frontend - State Management (Context + Hooks):**
- Purpose: Hold global and feature-specific state (data, auth, navigation)
- Location: `frontend/src/contexto`, `frontend/src/hooks`
- Contains: React Context providers, custom hooks wrapping useGeolocation, useNavegacion, etc.
- Depends on: API client, localStorage for JWT
- Used by: Components

**Frontend - Integration (API Client):**
- Purpose: Normalize HTTP requests, inject auth headers, standardize errors
- Location: `frontend/src/utilidades/api.js`
- Contains: Fetch wrapper, per-entity API groups (sitesApi, authApi, pqrsApi, etc.)
- Depends on: Browser fetch, localStorage
- Used by: AppProvider, hooks, components

**Frontend - Business Logic (Utilities):**
- Purpose: Geometry, event handling, image utils
- Location: `frontend/src/utilidades/` (geoRuta.js, events.js, image.js)
- Contains: Pure functions for distance, bearing, route projection; event scheduling; image handling
- Depends on: Math only (no React, no API)
- Used by: Hooks (useNavegacion)

**Backend - Web Framework:**
- Purpose: HTTP server, middleware pipeline, routing
- Location: `backend/src/index.js`
- Contains: Express app setup, helmet CSP, CORS, static files, error handler
- Depends on: express, helmet, cors, config
- Used by: Routes

**Backend - Routing (API Endpoints):**
- Purpose: Define HTTP endpoints, parse requests, call services, return normalized responses
- Location: `backend/src/routes/*.js` (13 route files)
- Contains: Router definitions, input validation, HTTP status codes
- Depends on: Database query function, utils (geocoding, routing, mappers), middleware (auth)
- Used by: Express app

**Backend - Data Access (Database):**
- Purpose: Execute SQL, manage schema, pool connections
- Location: `backend/src/db.js`
- Contains: mysql2 pool, CREATE TABLE statements, query() helper, idempotent schema init
- Depends on: mysql2/promise, config (host, user, password, database)
- Used by: All route handlers

**Backend - Services (External Integration):**
- Purpose: Broker calls to ArcGIS, OSRM, Nominatim, Google Calendar
- Location: `backend/src/utils/` (arcgisRouting.js, osrmRouting.js, geocode.js, etc.)
- Contains: API request builders, credential handling, response normalization
- Depends on: config (API keys), axios/fetch
- Used by: Route handlers

**Backend - Middleware & Utilities:**
- Purpose: Cross-cutting concerns: auth, rate limiting, error wrapping, data mapping
- Location: `backend/src/middleware/auth.js`, `backend/src/utils/http.js` & `mappers.js`
- Contains: JWT validation (requireAuth, requireSuperadmin), asyncHandler wrapper, field mappers
- Depends on: config (JWT secret), jsonwebtoken
- Used by: Route handlers

## Data Flow

### Primary Request Path: User Views a Site

1. **App mounts** (`frontend/src/main.jsx`, `frontend/src/App.jsx`)
   - AppProvider loads public data: `Promise.all([sitesApi.list(), announcementsApi.list(), eventsApi.list(), settingsApi.get()])`
   - Sets state: `sites`, `announcements`, `events`, `loading`

2. **User navigates to `/site/:id`** → SiteDetailPage renders
   - Reads site from AppContext (already loaded)
   - Shows images, description, contact, category
   - Displays small map preview (MapLibre GL or Leaflet)
   - Offers "Get Directions" button

3. **User clicks "Get Directions"** → RouteModal opens, useNavegacion activates
   - `useNavegacion()` calls `rutasApi.resolver({ origen: userGPS, destino: sitio, modo: 'walk' })`
   - **Backend Route:** `POST /api/rutas/resolver` in `backend/src/routes/routing.js`
   - **Service Layer:** `resolverRutaArcgis()` or fallback `resolverRutaOsrm()` in `backend/src/utils/`
   - Returns: `{ puntos: [[lat,lng]…], pasos: [{distancia, instruccion}…], distanciaM, duracionMin }`

4. **Route calculated, navigation begins** → GPS tracking loop in useNavegacion
   - useGeolocation() polls navigator.geolocation.watchPosition() at high precision
   - Each GPS update → `localizarEnRuta(ruta, position, fromIndex)` projects user onto route
   - Calculates: `recorridoM`, `restanteM`, `paso activo`
   - Updates state: `avance`, `instruccion`, `tramos`
   - RouteModal and InteractiveMap re-render with live progress

5. **User deviates 45m from route** → Automatic recalculation
   - `useNavegacion` detects deviation, waits 15 sec (rate limit), calls `/api/rutas/resolver` again
   - New route replaces old one; navigation resumes from current position

### Secondary: Admin Edits Site Data

1. **Admin logs in** → POST /api/auth/login → receives JWT token
   - Token stored in localStorage; injected as `Authorization: Bearer <token>` on subsequent requests

2. **Admin adds site** → POST /api/sites with form data
   - Backend: `requireAuth` middleware validates JWT; handler geocodes address via Nominatim or accepts lat/lng
   - Inserts into `sites` table via `backend/src/db.js` query()
   - Returns created site

3. **Frontend refleshes data** → AppProvider re-fetches sitesApi.list() or receives live update
   - Local state updated; pages re-render with new site

### Error Handling Flow

```
Route Handler
  ├─ Input Validation → 400 + error message
  ├─ Database Error → caught by asyncHandler
  │  └─ logged to console, 500 + generic "Error interno del servidor"
  ├─ External API Failure (ArcGIS, Nominatim)
  │  └─ logged as warning, fallback invoked (OSRM) or 502 returned
  └─ Auth Failure (missing/invalid JWT)
     └─ 401 + "No autenticado" or "Sesión inválida"
```

**State Management:**
- **Frontend:** React Context (AppProvider holds normalized entities) + hooks for features (useNavegacion)
- **Backend:** Stateless; token payload = current user (no server-side sessions)
- **Database:** Single source of truth for all entities; visit_log table tracks analytics over time

## Key Abstractions

**Route Object (after prepararRuta):**
- Purpose: Immutable, precomputed route state for efficient GPS matching
- Examples: `{ puntos: [[lat,lng]…], pasos: […], acumulados: [0, 100, 200…], largoTotalM: 2500 }`
- Pattern: Prepared once on fetch; mutated only by full recalculation

**Site Entity:**
- Purpose: Represents a tourist attraction across frontend/backend
- Examples: `{ id: 1, name: 'Parque Central', category: 'Parque', lat: 5.x, lng: -75.x, images: [...], visits: 42 }`
- Pattern: Loaded globally in AppProvider; individual access via GET /api/sites/:id

**Navigation State Machine:**
- Purpose: Prevent invalid state transitions in useNavegacion
- States: `inactivo` → `calculando` → `previsualizando` | `navegando` → `llegado` | `error`
- Pattern: useCallback setEstado guards transitions; UI disables buttons based on state

**JWT Payload (after decode):**
- Purpose: Carry user identity + role without hitting database on every request
- Example: `{ sub: 1, username: 'admin', role: 'superadmin', name: 'Admin Principal', iat: ..., exp: ... }`
- Pattern: Unpacked by requireAuth middleware into req.user; routes check role

## Entry Points

**Frontend:**
- Location: `frontend/src/main.jsx`
- Triggers: Browser loads http://localhost:5173 (dev) or deployed URL (prod)
- Responsibilities: Mount React, initialize Leaflet marker icon fix, render App

**Backend:**
- Location: `backend/src/index.js` (start function)
- Triggers: `npm run dev` or `node src/index.js`
- Responsibilities: Initialize MySQL pool + schema, configure Express, mount routes, listen on port

**SPA Router:**
- Location: `frontend/src/App.jsx` (AnimatedRoutes component)
- Triggers: User navigates via links or browser back/forward
- Responsibilities: Match URL to page component (Home, SiteDetailPage, AdminPage, etc.)

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop; CPU-bound tasks (image resizing) would block. Database pool isolates connection I/O.
- **Global state:** AppProvider holds sites/announcements/events in-memory; changes require API calls (not optimistic updates for shared data). NavegacionProvider state is isolated (only one active navigation at a time).
- **Circular imports:** None detected; layers are acyclic (components → hooks → utils → nothing).
- **Stateless backend:** No server-side sessions; JWT is self-contained. Scale horizontally without session affinity.
- **Rate limiting:** Routing endpoint (60 req/5min) only; other endpoints unlimited. Protects ArcGIS billing.
- **Map library split:** MapLibre GL for public (performance), Leaflet for admin UI (familiarity). No unified map abstraction; duplicated geometry logic in InteractiveMap and admin components.

## Anti-Patterns

### Duplicate Route Projection Logic

**What happens:** MapLibre component (InteractiveMap.jsx) recalculates bearing, distance, polygon rendering (not using geoRuta.js); useNavegacion also does the same in geoRuta.js for progress tracking.

**Why it's wrong:** Changes to projection logic (e.g., handling a special case at the datum boundary) must be updated in two places, risking divergence.

**Do this instead:** Extract a shared geometry library (already mostly done in geoRuta.js); make InteractiveMap import and use those functions instead of re-implementing.

### Hardcoded API URL Selection

**What happens:** API_BASE in `frontend/src/utilidades/api.js` defaults to `http://localhost:3001` in dev. Vite env var handling uses `??` to allow empty string, but logic is cryptic.

**Why it's wrong:** Developers unfamiliar with the `??` vs `||` distinction may misconfigure and hit wrong backend.

**Do this instead:** Document the intention more clearly; consider using a .env file with explicit `VITE_API_URL=` (empty means same origin) to avoid confusion.

### Admin Forms Without Validation Feedback

**What happens:** AdminPage forms (add/edit site, announcement, etc.) post to backend; if validation fails, a generic error message appears, but the form state is not rolled back.

**Why it's wrong:** User loses context about which field was invalid; UX is poor for complex forms.

**Do this instead:** Implement field-level validation (frontend pre-check + backend return field errors), then update form state with per-field errors.

### Missing Test Coverage for geoRuta Geometry

**What happens:** `geoRuta.js` contains complex math (Haversine, route projection). Only basic tests in `geoRuta.test.js` cover happy paths.

**Why it's wrong:** Edge cases (routes crossing themselves, user at exact route start, wrapping at dateline) could cause silent failures.

**Do this instead:** Add property-based tests (fuzzing random points near routes); test edge cases (route == single point, user very far from route, bearing wrapping).

## Error Handling

**Strategy:** Try-catch in asyncHandler; normalize to HTTP status codes + JSON error objects.

**Patterns:**
- **Validation errors:** 400 + `{ error: "El punto no tiene coordenadas válidas." }`
- **Auth errors:** 401 + `{ error: "No autenticado. Inicia sesión para continuar." }`
- **Rate limit:** 429 + `{ error: "Demasiadas solicitudes de ruta. Espera un momento e inténtalo de nuevo." }`
- **External API failures:** 502 + `{ error: "No se pudo calcular la ruta en este momento. Inténtalo de nuevo en unos segundos." }`
- **Server errors:** 500 + `{ error: "Error interno del servidor." }` (actual error logged to console, not exposed)

**Frontend:** API client normalizes all non-2xx responses to Error, stores status on error object. Components catch and display error.message.

## Cross-Cutting Concerns

**Logging:** 
- Backend: `console.log('[tag]', message)` with prefixes like `[db]`, `[rutas]`, `[error]`. Unstructured; good for dev, would need structured logging (e.g., pino) for prod.
- Frontend: useNavegacion logs GPS state changes, route calculations; minimal logging elsewhere. localStorage token silently fails to be read/written without logging.

**Validation:**
- Backend: Per-route input checks (leerPunto validates lat/lng ranges; normalizeTags cleans arrays; required field checks)
- Frontend: Minimal; relies on HTML form attributes (required, type="email") + downstream API error messages
- Missing: Centralized schema validation (would benefit from zod or yup)

**Authentication:**
- Backend: JWT signed with secret; validated via requireAuth middleware
- Frontend: Token stored in localStorage; injected by API client
- Session: None; token is the session (8h expiry by default)
- Logout: Clear token from localStorage; next API call fails with 401, triggers re-login

---

*Architecture analysis: 2026-09-01*
