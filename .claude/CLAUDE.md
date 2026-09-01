<!-- GSD:project-start source:PROJECT.md -->

## Project

**Turismo Itagüí — Navegación Móvil ArcGIS**

Portal turístico del Municipio de Itagüí (Antioquia, Colombia): catálogo de sitios, calendario de eventos, PQRS ciudadano y panel de administración, construido en React 19 + Vite (frontend) y Node/Express + MySQL (backend). Su función central para el visitante es la **navegación en tiempo real por calles reales** hasta cada sitio turístico, estilo Waze/Google Maps: GPS en vivo, indicaciones giro a giro con voz en español, cámara course-up y recálculo automático por desvío, apoyada en el servicio ArcGIS World Route (con respaldo OSRM).

**Core Value:** Que la navegación en tiempo real sea confiable y responsiva: la flecha, la cámara y el progreso deben reflejar la posición y el rumbo reales del visitante sin retraso perceptible ni orientaciones incorrectas — manteniendo la geometría de ArcGIS como fuente de verdad para el trazado, el progreso y la detección de desvíos.

### Constraints

- **Proveedor de rutas**: ArcGIS World Route sigue como proveedor principal; OSRM solo como respaldo — no reemplazar
- **Mapa**: MapLibre GL vía `react-map-gl` se mantiene; no migrar al ArcGIS Maps SDK for JavaScript sin ADR + comparación técnica + aprobación humana explícita
- **Geometría**: la geometría cruda de ArcGIS sigue siendo la fuente de verdad para map matching, progreso y detección de desvíos — ninguna suavización visual puede alterarla
- **Privacidad**: no registrar coordenadas personales, recorridos completos ni tokens en ningún artefacto generado (código, docs, instrumentación, tests, UAT)
- **Multi-agente**: un único cliente escritor por fase; dos clientes no modifican los mismos archivos simultáneamente; revisores de solo lectura no tocan código de producción
- **Despliegue**: HTTPS obligatorio para `watchPosition` (o `localhost`); UAT final en dispositivos físicos Android Chrome y, si disponible, iPhone Safari
- **Costos**: cada recálculo de ruta es una petición facturable a ArcGIS (20.000 rutas gratis/mes) — cualquier cambio a los umbrales de recálculo debe justificar el impacto en volumen de peticiones

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ES Module) - Frontend and backend applications
- SQL - MySQL database schemas and migrations

## Runtime

- Node.js 20 (Alpine) - Containerized via Docker
- Browser APIs - Web Speech API, Geolocation API, Web Workers
- npm (v10+)
- Lockfiles: `package-lock.json` (present in both frontend and backend)

## Frameworks

- React 19.2.6 - Frontend UI framework
- Express 4.21.2 - Backend REST API framework
- Vite 8.0.12 - Frontend build tool and dev server
- MapLibre GL 5.24.0 - Vector map rendering (primary)
- react-map-gl 8.1.2 - React wrapper for MapLibre GL
- Leaflet 1.9.4 - Legacy dependency (navigation uses MapLibre, not Leaflet)
- react-leaflet 5.0.0 - Legacy dependency
- Recharts 3.8.1 - Chart library for analytics/dashboards
- Testing: Vitest 4.1.11 - Unit and integration test framework
- Testing Environment: jsdom 29.1.1 - DOM simulation for tests

## Key Dependencies

- maplibre-gl 5.24.0 - Open-source map rendering; replaces ArcGIS JavaScript SDK for map display
- mysql2 3.12.0 - MySQL connection pool and query execution
- express-rate-limit 7.5.0 - Rate limiting for routing API (protects against excessive ArcGIS charges)
- jsonwebtoken 9.0.2 - JWT authentication for admin panel
- bcryptjs 2.4.3 - Password hashing
- helmet 8.0.0 - HTTP header hardening (CSP, HSTS, X-Frame-Options, etc.)
- cors 2.8.5 - Cross-Origin Resource Sharing for frontend/backend communication
- multer 2.0.1 - File upload handling (site/announcement/PQRS images)
- express 4.21.2 - HTTP server framework
- node-ical 0.20.1 - iCalendar (.ics) parsing for Google Calendar events
- dotenv 16.4.7 - Environment variable loading
- react-router-dom 7.17.0 - Client-side routing
- react-icons 5.6.0 - Icon library

## Configuration

- Backend: `backend/.env` (database, JWT secret, ArcGIS credentials, OSRM fallback)
- Frontend: `frontend/.env` (VITE_API_URL, points to backend API)
- Docker: Environment variables injected by Railway platform (PORT, DATABASE_URL, etc.)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MySQL connection
- `JWT_SECRET` - Admin authentication token signing
- `ARCGIS_API_KEY` or (`ARCGIS_CLIENT_ID` + `ARCGIS_CLIENT_SECRET`) - Routing service credentials
- `ARCGIS_REFERER` - Required for OAuth authentication with ArcGIS
- `NODE_ENV` - `production` for Railway deployments
- `PORT` - HTTP server port (default 3001, overridden by Railway)
- `CORS_ORIGIN` - Allowed frontend origins
- `vite.config.js` - Frontend build configuration (React plugin, no PostCSS)
- `vitest.config.js` - Test runner configuration with jsdom environment
- `eslint.config.js` - Flat ESLint config (recommended, React hooks, React Refresh)
- `Dockerfile` - Multi-stage Docker image (frontend build → backend + static assets)
- `docker-compose.yml` - Local development services (MySQL 8.0 + Adminer)

## Platform Requirements

- Node.js 20+
- npm 10+
- Docker (for local MySQL development)
- Modern browser with Web APIs (Geolocation, Web Speech, Web Workers)
- Deployment target: Railway (documented in Dockerfile)
- MySQL 8.0 (external service, not containerized in production)
- Node.js 20 runtime (Railway container)
- 2 MB request limit (configured in Express)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: `ComponentName.jsx` or `componentName.jsx` (PascalCase for component files, camelCase for utilities)
- Utilities: `functionName.js` (camelCase)
- Test files: `fileName.test.js` or `fileName.spec.js` (co-located with source)
- Examples: `InteractiveMap.jsx`, `geoRuta.js`, `geoRuta.test.js`, `useGeolocation.js`
- camelCase throughout (Spanish names common)
- Hook functions: `useXxxName` pattern (e.g., `useGeolocation`, `useNavegacion`, `useOrientacion`)
- Utility functions: `accionVerbo` pattern (e.g., `distanciaM`, `formatearDistancia`, `localizarEnRuta`)
- Middleware/handlers: descriptive camelCase (e.g., `asyncHandler`, `requireAuth`, `signToken`)
- Internal helpers: lowercase with descriptive names (e.g., `aPlano`, `circuloGeoJSON`, `lineaGeoJSON`)
- camelCase with Spanish names: `ubicacion`, `ultimaActualizacion`, `gpsConfiable`, `posicion`
- State variables match their setters: `const [gpsConfiable, setGpsConfiable] = useState(...)`
- Reference variables: `xxxRef` (e.g., `mapRef`, `rafRef`, `permisoRef`)
- No TypeScript in this codebase; JavaScript with JSDoc type hints
- JSDoc used for function documentation (e.g., `@param`, `@returns`)
- Object properties follow camelCase (e.g., `{ lat, lng, heading, accuracy }`)
- SCREAMING_SNAKE_CASE for module-level constants
- Examples: `RADIO_TIERRA_M`, `ZOOM_NAVEGACION`, `PITCH_NAVEGACION`, `PRECISION_MAXIMA_M`, `ERROR_PERMISO_DENEGADO`
- Component-level constants use `const NOMBRE = ...` (e.g., `const CARTO_CLARO = ...`)

## Code Style

- No Prettier config (not enforced)
- No explicit formatter configured; follows ESLint recommendations
- 2-space indentation (inferred from source files)
- Semicolons used throughout
- Single quotes in JSDoc, template literals for dynamic strings
- ESLint enabled (flat config format in `frontend/eslint.config.js`)
- Plugins: `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Extends: `js.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- Ignores: `dist/`
- No TypeScript—pure JavaScript with JSX
- Backend uses same naming but no ESLint config found in this repo

## Import Organization

- No path aliases configured; relative paths used throughout
- Examples: `../../utilidades/api`, `../../hooks/useOrientacion`, `../../contexto/NavegacionContext`
- No barrel files (index.js exports) observed; direct imports of source files

## Error Handling

- React state for errors: `const [error, setError] = useState(null)`
- Try-catch in async functions and effects
- Graceful fallbacks for API errors (e.g., fallback basemaps in `InteractiveMap.jsx`)
- Validation before operations (e.g., username/password length checks)
- Generic user-facing error messages in Spanish
- Example from `useGeolocation.js`: `mensajeDeError(err, permiso)` translates GPS errors to actionable messages
- `asyncHandler` wrapper (`backend/src/utils/http.js`) catches Promise rejections and passes to error middleware
- All route handlers wrapped: `asyncHandler(async (req, res) => { ... })`
- Centralized error middleware (last middleware in `index.js`): catches multer errors and logs others
- HTTP response pattern: `res.status(code).json({ error: 'message' })`
- Example error responses:
- JWT verification wraps try-catch for invalid tokens: `catch { return res.status(401).json(...) }`

## Logging

- No logging framework; uses `console.log`, `console.error` for debugging
- Example: `console.error('[error]', err)` in error handlers
- No production logging observed; relies on browser DevTools
- `console.log` and `console.error` with prefixed tags
- Format: `console.log('[tag]', message)` or `console.error('[tag]', message)`
- Tags used: `[db]`, `[error]`
- Examples:

## Comments

- Complex algorithms: explained before implementation (e.g., `geoRuta.js` comments on Haversine, local plane projection)
- Configuration rationale: explain "why" for non-obvious settings (e.g., `vite.config.js` explains why postcss is empty)
- Security/validation: note sensitive operations (e.g., "Mensaje genérico para no revelar si el usuario existe")
- Browser API quirks: document workarounds and their purpose (e.g., ResizeObserver polyfill, RAF cancellation)
- Used for functions with multiple parameters or complex return types
- Format: `/** description */` followed by `@param {type} name - description`
- Example from `geoRuta.js`:
- All comments and strings in Spanish (matches user interface and team language)
- Technical terms use Spanish names where established (e.g., `distanciaM`, `rumbo`, `ubicacion`)

## Function Design

- No strict size limit enforced, but functions favor single responsibility
- Complex geometry utilities (e.g., `prepararRuta`) documented with multiple steps
- Event handlers and effects kept under 50 lines where possible
- Destructured objects for multiple related parameters (e.g., `function mensajeEstadoGps({ gpsConfiable, ultimaActualizacion, ahora })`)
- Positional arguments for single/unrelated parameters
- Default parameters used (e.g., `function usePosicionAnimada(objetivo, duracionMs = 600)`)
- Hooks pass options objects: `useGeolocation({ precisionAlta: true })`
- Explicit returns for clarity (no implicit undefined)
- Object returns use spread operator to preserve full payload: `return { ...ruta, puntos, pasos, acumulados, largoTotalM }`
- Null used for "no value" in nullable cases (e.g., `if (puntos.length < 2) return null;`)
- Hooks return objects with state and functions: `{ position, error, loading, gpsConfiable, ultimaActualizacion }`

## Module Design

- Named exports preferred: `export function xxx() { }`
- Default export used only for components and Context providers
- Example: `export const authRouter = Router();` (backend routes)
- Frontend components: `export function App() { }` or `export const App = () => { }`
- No barrel files observed in this codebase
- Direct imports from source files recommended
- **Frontend utilities** (`src/utilidades/`): pure functions, no side effects
- **Frontend hooks** (`src/hooks/`): React custom hooks
- **Frontend components** (`src/componentes/`): organized by feature
- **Frontend context** (`src/contexto/`): global state with Context API
- **Backend routes** (`src/routes/`): Express routers
- **Backend middleware** (`src/middleware/`): cross-cutting concerns
- **Backend utils** (`src/utils/`): helper functions

## Language & Internationalization

- All user-facing strings, comments, variable names in Spanish
- Examples: `formatearDistancia`, `ultimaActualizacion`, `gpsConfiable`, `navegando`
- Error messages in Spanish: "Usuario y contraseña son obligatorios", "GPS no disponible"

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **Backend-First Auth**: JWT tokens stored in localStorage, validated on protected routes via middleware
- **Stateless API**: No session store; each request re-validates the token
- **Dual Mapping Library**: MapLibre GL (public navigation) + Leaflet (admin edit UI) — NOT ArcGIS SDK
- **Proxy Architecture**: Frontend never holds ArcGIS API keys; backend brokers routing and geocoding requests
- **Real-Time Navigation**: GPS + Waze-style turn-by-turn via client-side route projection (not relying on server websockets)
- **Fallback Routing**: ArcGIS primary (with token), OSRM secondary (no key needed, open data)
- **Optimistic UI**: Frontend loads data upfront in AppProvider, modifies local state immediately, syncs to backend
- **Rate Limiting**: Routing endpoint capped at 60 requests/5min to protect against ArcGIS billing surprises

## Layers

- Purpose: Render UI, handle user input, manage visual state
- Location: `frontend/src/componentes`, `frontend/src/paginas`
- Contains: JSX components, page layouts, styled with vanilla CSS
- Depends on: Context (AppProvider, NavegacionProvider), hooks (useNavegacion, useGeolocation), API client
- Used by: User browser
- Purpose: Hold global and feature-specific state (data, auth, navigation)
- Location: `frontend/src/contexto`, `frontend/src/hooks`
- Contains: React Context providers, custom hooks wrapping useGeolocation, useNavegacion, etc.
- Depends on: API client, localStorage for JWT
- Used by: Components
- Purpose: Normalize HTTP requests, inject auth headers, standardize errors
- Location: `frontend/src/utilidades/api.js`
- Contains: Fetch wrapper, per-entity API groups (sitesApi, authApi, pqrsApi, etc.)
- Depends on: Browser fetch, localStorage
- Used by: AppProvider, hooks, components
- Purpose: Geometry, event handling, image utils
- Location: `frontend/src/utilidades/` (geoRuta.js, events.js, image.js)
- Contains: Pure functions for distance, bearing, route projection; event scheduling; image handling
- Depends on: Math only (no React, no API)
- Used by: Hooks (useNavegacion)
- Purpose: HTTP server, middleware pipeline, routing
- Location: `backend/src/index.js`
- Contains: Express app setup, helmet CSP, CORS, static files, error handler
- Depends on: express, helmet, cors, config
- Used by: Routes
- Purpose: Define HTTP endpoints, parse requests, call services, return normalized responses
- Location: `backend/src/routes/*.js` (13 route files)
- Contains: Router definitions, input validation, HTTP status codes
- Depends on: Database query function, utils (geocoding, routing, mappers), middleware (auth)
- Used by: Express app
- Purpose: Execute SQL, manage schema, pool connections
- Location: `backend/src/db.js`
- Contains: mysql2 pool, CREATE TABLE statements, query() helper, idempotent schema init
- Depends on: mysql2/promise, config (host, user, password, database)
- Used by: All route handlers
- Purpose: Broker calls to ArcGIS, OSRM, Nominatim, Google Calendar
- Location: `backend/src/utils/` (arcgisRouting.js, osrmRouting.js, geocode.js, etc.)
- Contains: API request builders, credential handling, response normalization
- Depends on: config (API keys), axios/fetch
- Used by: Route handlers
- Purpose: Cross-cutting concerns: auth, rate limiting, error wrapping, data mapping
- Location: `backend/src/middleware/auth.js`, `backend/src/utils/http.js` & `mappers.js`
- Contains: JWT validation (requireAuth, requireSuperadmin), asyncHandler wrapper, field mappers
- Depends on: config (JWT secret), jsonwebtoken
- Used by: Route handlers

## Data Flow

### Primary Request Path: User Views a Site

### Secondary: Admin Edits Site Data

### Error Handling Flow

```

```

- **Frontend:** React Context (AppProvider holds normalized entities) + hooks for features (useNavegacion)
- **Backend:** Stateless; token payload = current user (no server-side sessions)
- **Database:** Single source of truth for all entities; visit_log table tracks analytics over time

## Key Abstractions

- Purpose: Immutable, precomputed route state for efficient GPS matching
- Examples: `{ puntos: [[lat,lng]…], pasos: […], acumulados: [0, 100, 200…], largoTotalM: 2500 }`
- Pattern: Prepared once on fetch; mutated only by full recalculation
- Purpose: Represents a tourist attraction across frontend/backend
- Examples: `{ id: 1, name: 'Parque Central', category: 'Parque', lat: 5.x, lng: -75.x, images: [...], visits: 42 }`
- Pattern: Loaded globally in AppProvider; individual access via GET /api/sites/:id
- Purpose: Prevent invalid state transitions in useNavegacion
- States: `inactivo` → `calculando` → `previsualizando` | `navegando` → `llegado` | `error`
- Pattern: useCallback setEstado guards transitions; UI disables buttons based on state
- Purpose: Carry user identity + role without hitting database on every request
- Example: `{ sub: 1, username: 'admin', role: 'superadmin', name: 'Admin Principal', iat: ..., exp: ... }`
- Pattern: Unpacked by requireAuth middleware into req.user; routes check role

## Entry Points

- Location: `frontend/src/main.jsx`
- Triggers: Browser loads http://localhost:5173 (dev) or deployed URL (prod)
- Responsibilities: Mount React, initialize Leaflet marker icon fix, render App
- Location: `backend/src/index.js` (start function)
- Triggers: `npm run dev` or `node src/index.js`
- Responsibilities: Initialize MySQL pool + schema, configure Express, mount routes, listen on port
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

### Hardcoded API URL Selection

### Admin Forms Without Validation Feedback

### Missing Test Coverage for geoRuta Geometry

## Error Handling

- **Validation errors:** 400 + `{ error: "El punto no tiene coordenadas válidas." }`
- **Auth errors:** 401 + `{ error: "No autenticado. Inicia sesión para continuar." }`
- **Rate limit:** 429 + `{ error: "Demasiadas solicitudes de ruta. Espera un momento e inténtalo de nuevo." }`
- **External API failures:** 502 + `{ error: "No se pudo calcular la ruta en este momento. Inténtalo de nuevo en unos segundos." }`
- **Server errors:** 500 + `{ error: "Error interno del servidor." }` (actual error logged to console, not exposed)

## Cross-Cutting Concerns

- Backend: `console.log('[tag]', message)` with prefixes like `[db]`, `[rutas]`, `[error]`. Unstructured; good for dev, would need structured logging (e.g., pino) for prod.
- Frontend: useNavegacion logs GPS state changes, route calculations; minimal logging elsewhere. localStorage token silently fails to be read/written without logging.
- Backend: Per-route input checks (leerPunto validates lat/lng ranges; normalizeTags cleans arrays; required field checks)
- Frontend: Minimal; relies on HTML form attributes (required, type="email") + downstream API error messages
- Missing: Centralized schema validation (would benefit from zod or yup)
- Backend: JWT signed with secret; validated via requireAuth middleware
- Frontend: Token stored in localStorage; injected by API client
- Session: None; token is the session (8h expiry by default)
- Logout: Clear token from localStorage; next API call fails with 401, triggers re-login

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
