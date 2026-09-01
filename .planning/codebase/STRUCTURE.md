# Codebase Structure

**Analysis Date:** 2026-09-01

## Directory Layout

```
leatherback/
├── frontend/                   # React 19 + Vite SPA (public + admin UIs)
│   ├── public/                 # Static assets (compiled dist in prod)
│   ├── src/
│   │   ├── main.jsx            # Entry point; Leaflet icon fix
│   │   ├── App.jsx             # Router, context providers, layout
│   │   ├── index.html          # HTML template for Vite
│   │   ├── componentes/        # Reusable UI components
│   │   │   ├── admin/          # Admin panel: CRUD forms, Leaflet editor
│   │   │   ├── calendario/     # Calendar + event components
│   │   │   ├── comunes/        # Shared: Header, Footer, Cards, etc.
│   │   │   ├── detalle/        # Detail pages: SiteCard, InteractiveMap, RouteModal
│   │   │   ├── estructura/     # Layout: ScrollToTop, modals
│   │   │   └── inicio/         # Home page sections
│   │   ├── contexto/           # React Context + Providers
│   │   │   ├── AppContext.js   # Global portal state
│   │   │   ├── AppProvider.jsx # Loads data, exposes setters
│   │   │   ├── NavegacionContext.js
│   │   │   └── NavegacionProvider.jsx # Navigation state (GPS, route)
│   │   ├── paginas/            # Page-level components (React Router routes)
│   │   │   ├── Home.jsx        # Portal landing
│   │   │   ├── SiteDetailPage.jsx
│   │   │   ├── AdminPage.jsx   # Admin dashboard
│   │   │   ├── CalendarPage.jsx
│   │   │   └── PqrsPage.jsx    # Citizen submissions
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useNavegacion.js # Real-time navigation engine
│   │   │   ├── useGeolocation.js
│   │   │   ├── useOrientacion.js
│   │   │   ├── useDarkMode.js
│   │   │   └── *.test.js       # Vitest unit tests
│   │   ├── utilidades/         # Pure functions + API client
│   │   │   ├── api.js          # Fetch wrapper, per-entity API groups
│   │   │   ├── geoRuta.js      # Geometry: distance, bearing, projection
│   │   │   ├── events.js       # Event scheduling helpers
│   │   │   ├── image.js        # Image optimization
│   │   │   └── *.test.js
│   │   ├── estilos/            # Global CSS (vanilla, no PostCSS)
│   │   │   ├── variables.css   # --color-*, --spacing-* custom properties
│   │   │   ├── global.css      # Resets, base styles
│   │   │   └── animations.css  # @keyframes, transitions
│   │   ├── dados/              # Static data (categories, templates)
│   │   ├── assets/             # Images, icons, fonts
│   │   └── test/               # Test fixtures, setup
│   ├── package.json            # React 19, MapLibre, Leaflet, Vite, Vitest
│   ├── vite.config.js          # Vite config (explicit empty postcss to avoid parent projects' tailwind)
│   ├── eslint.config.js        # ESLint rules (React, React Hooks)
│   ├── .env.example            # Template: VITE_API_URL, VITE_ARCGIS_TOKEN (if needed)
│   └── node_modules/           # Deps (git-ignored)
│
├── backend/                    # Express.js REST API + MySQL
│   ├── src/
│   │   ├── index.js            # App entry point, middleware setup, route mounting
│   │   ├── config.js           # Centralized config from env vars
│   │   ├── db.js               # MySQL pool, schema creation, query helper
│   │   ├── routes/             # API route handlers
│   │   │   ├── auth.js         # POST login, GET /me, PATCH password
│   │   │   ├── users.js        # List, create, update, delete admins (superadmin only)
│   │   │   ├── sites.js        # GET list/by-id, POST/PUT/DELETE (admin), POST visit (public)
│   │   │   ├── announcements.js
│   │   │   ├── events.js
│   │   │   ├── pqrs.js         # POST submit (public), GET/PATCH status (admin)
│   │   │   ├── settings.js     # GET/PUT global settings
│   │   │   ├── upload.js       # Multer multipart form upload handler
│   │   │   ├── stats.js        # Analytics: daily/weekly/monthly visit trends
│   │   │   ├── geocode.js      # Nominatim proxy (one-off geocoding)
│   │   │   ├── routing.js      # POST /resolver (route calc), GET /estado (provider status)
│   │   │   ├── mapa.js         # MapLibre token/style endpoint
│   │   │   └── googleCalendar.js # Google Calendar webhook receiver
│   │   ├── middleware/
│   │   │   ├── auth.js         # requireAuth, requireSuperadmin JWT middleware
│   │   │   └── upload.js       # Multer config (destination, size limits)
│   │   ├── utils/
│   │   │   ├── http.js         # asyncHandler, asArray helpers
│   │   │   ├── mappers.js      # mapSite, mapEvent (entity normalization)
│   │   │   ├── geocode.js      # Nominatim forward/reverse geocoding
│   │   │   ├── arcgisRouting.js # Calls ArcGIS Route Service, manages token refresh
│   │   │   ├── osrmRouting.js  # OSRM fallback (open-source)
│   │   │   └── googleCalendar.js # Proxy to Google Calendar API
│   │   ├── scripts/
│   │   │   ├── initDb.js       # Manual schema initialization (idempotent)
│   │   │   └── seedSites.js    # Seed initial test data
│   │   └── uploads/            # Directory for uploaded images (git-ignored, created at runtime)
│   ├── package.json            # Express, MySQL2, JWT, bcryptjs, Multer, Helmet, CORS
│   ├── .env.example            # Template: DB_*, JWT_SECRET, ARCGIS_*, CORS_ORIGIN, NODE_ENV
│   └── node_modules/           # Deps (git-ignored)
│
├── BD/                         # Database (documentation + schema)
│   └── schema.sql              # (if manual init is needed; otherwise auto-generated by db.js)
│
├── .planning/
│   └── codebase/               # Architecture/structure analysis docs
│
├── .superpowers/               # GSD framework metadata (not code)
│   └── sdd/
│
├── docker-compose.yml          # Local dev: MySQL + Node backend + Vite frontend
├── Dockerfile                  # Production: single image, serves API + SPA
├── README.md                   # Project overview
├── .gitignore                  # Excludes node_modules, .env, uploads, dist
└── .env.example                # Root env template (merged with frontend/.env, backend/.env)
```

## Directory Purposes

**frontend/src/componentes/**
- Purpose: Reusable UI building blocks organized by feature area
- Contains: React components (.jsx), component-scoped CSS
- Key files: 
  - `estructura/`: Header, Footer, ScrollToTop
  - `comunes/`: SiteCard, SearchBar, Modal, Button, etc.
  - `detalle/`: InteractiveMap (MapLibre), RouteModal, SiteDetail card
  - `admin/`: CRUD forms, Leaflet editor for sites
  - `calendario/`: Calendar widget, event timeline

**frontend/src/hooks/**
- Purpose: Custom React hooks encapsulating stateful logic
- Contains: useNavegacion (navigation engine), useGeolocation (GPS), useOrientacion (compass), useDarkMode
- Pattern: Each hook returns state + methods; used by multiple components
- Tests: parallel `.test.js` files using Vitest

**frontend/src/utilidades/**
- Purpose: Stateless utility functions and API client
- Contains: 
  - `api.js`: Single-point fetch wrapper, token injection, per-entity API groups
  - `geoRuta.js`: Geometry (Haversine distance, bearing, route projection)
  - `events.js`: Event scheduling helpers (timezone handling, recurring events)
  - `image.js`: Image optimization (resize, format conversion)

**backend/src/routes/**
- Purpose: HTTP endpoint handlers
- Pattern: Each file exports a Router; handles one entity type (sites, events, etc.)
- Responsibility: Parse request, validate input, call database/service, return JSON

**backend/src/utils/**
- Purpose: Reusable business logic and external service integration
- Contains:
  - `http.js`: asyncHandler wrapper (catch errors, attach status)
  - `mappers.js`: Normalize database rows to API responses (add computed fields, format dates)
  - `arcgisRouting.js`: Broker ArcGIS Route Service calls, handle token refresh, rate limiting
  - `osrmRouting.js`: Open-source OSRM fallback (no credentials)

**backend/src/middleware/**
- Purpose: Express middleware (auth, file upload, error handling)
- Contains: JWT verification (requireAuth), role checks (requireSuperadmin), Multer config

## Key File Locations

**Entry Points:**
- `frontend/src/main.jsx`: React mount, Leaflet icon fix for Vite
- `frontend/src/App.jsx`: Router setup, context providers, layout
- `backend/src/index.js`: Express setup, route mounting, port listen

**Configuration:**
- `frontend/.env.example`: VITE_API_URL, VITE_ARCGIS_TOKEN (if used)
- `backend/src/config.js`: Centralized env var parsing + defaults
- `frontend/vite.config.js`: Vite build config (empty postcss to avoid parent project Tailwind)
- `backend/package.json`: scripts: `dev` (nodemon), `start` (node)

**Core Logic:**
- `frontend/src/hooks/useNavegacion.js`: Real-time GPS + route projection + recalculation logic
- `frontend/src/utilidades/geoRuta.js`: Geometry functions for route tracking
- `backend/src/db.js`: MySQL pool + idempotent schema creation + query helper
- `backend/src/utils/arcgisRouting.js`: ArcGIS Route Service integration + token refresh

**API Layer:**
- `frontend/src/utilidades/api.js`: Fetch wrapper + per-entity API groups (sitesApi, authApi, etc.)
- `backend/src/routes/sites.js`: Site CRUD + visit tracking (example of route pattern)

**Testing:**
- `frontend/src/hooks/useNavegacion.test.js`: Unit tests for navigation engine
- `frontend/src/hooks/useGeolocation.test.js`: GPS hook tests
- `frontend/src/utilidades/geoRuta.test.js`: Geometry function tests
- `frontend/src/utilidades/api.test.js`: API client tests

## Naming Conventions

**Files:**
- React components: PascalCase.jsx (e.g., `SiteDetailPage.jsx`, `InteractiveMap.jsx`)
- Utilities/hooks: camelCase.js (e.g., `useNavegacion.js`, `geoRuta.js`)
- Tests: same base name + `.test.js` (e.g., `useNavegacion.test.js`)
- CSS: match component name (e.g., `InteractiveMap.css`)
- Routes/modules: camelCase.js (e.g., `auth.js`, `sites.js`)

**Directories:**
- Feature folders: lowercase Spanish (e.g., `componentes`, `utilidades`, `contexto`, `paginas`)
- Grouped logic: lowercase plural (e.g., `routes`, `utils`, `hooks`, `scripts`)
- Database: `BD` (not db, src/db)

**Functions/Variables:**
- Frontend: camelCase for JS, kebab-case for CSS variables (e.g., `--color-primary`, `--spacing-md`)
- Backend: camelCase for functions (e.g., `leerPunto`, `mapSite`, `geocodeAddress`)
- Database table names: snake_case lowercase (e.g., `sites`, `announcements`, `visit_log`)

**CSS Classes:**
- BEM-inspired where complex (e.g., `.site-card__title`, `.route-modal__step`)
- Simple camelCase where flat (e.g., `.fullscreen`, `.pageTransition`)
- Global utility classes in variables.css (e.g., `.hidden`, `.flex-center`)

## Where to Add New Code

**New Feature (e.g., "Favorites"):**
1. **Context/State:** Create `FavoritesContext.js` + `FavoritesProvider.jsx` in `frontend/src/contexto/`
2. **Hooks:** If complex, extract to `frontend/src/hooks/useFavorites.js`
3. **API:** Add `favoritesApi` group to `frontend/src/utilidades/api.js`
4. **Backend:** Create `backend/src/routes/favorites.js`; mount in `backend/src/index.js`
5. **Database:** Add `CREATE TABLE favorites (...)` to `backend/src/db.js` SCHEMA_STATEMENTS
6. **Components:** Build favorite button/list in `frontend/src/componentes/comunes/`
7. **Page:** Integrate into existing pages (e.g., Home) or create `FavoritesPage.jsx`

**New Component (e.g., "SearchBar"):**
- Location: `frontend/src/componentes/comunes/SearchBar.jsx`
- Tests: `frontend/src/componentes/comunes/SearchBar.test.jsx`
- Styles: `frontend/src/componentes/comunes/SearchBar.css`

**New Utility Function (e.g., "Format phone number"):**
- Location: `frontend/src/utilidades/format.js`
- Tests: `frontend/src/utilidades/format.test.js`
- Import from components via `import { formatPhone } from '../utilidades/format'`

**New Backend API Endpoint (e.g., "Get site reviews"):**
- Location: `backend/src/routes/reviews.js`
- Mount in `backend/src/index.js`: `app.use('/api/reviews', reviewsRouter);`
- Database: Add tables to `backend/src/db.js` schema
- Client: Add to `frontend/src/utilidades/api.js` as `reviewsApi` group

**New Admin Page (e.g., "Reviews Management"):**
- Component: `frontend/src/componentes/admin/ReviewsAdmin.jsx`
- Route: Add to AdminPage.jsx tabs
- State: Integrate with AppProvider context (or create ReviewsProvider if isolated)

## Special Directories

**frontend/uploads/ or backend/uploads/**
- Purpose: Runtime storage for user-uploaded images (sites, announcements, PQRS)
- Generated: Yes (created if not exists, by Multer middleware)
- Committed: No (.gitignore)
- Served: Via `app.use('/uploads', express.static(UPLOADS_DIR))` in backend

**frontend/public/**
- Purpose: Static assets served by Vite dev server; compiled SPA dist in prod
- Generated: Yes (build output)
- Committed: No (.gitignore) — dist not tracked
- Note: In prod deployment, backend mirrors compiled frontend to `public/` directory and serves as SPA

**backend/node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore)

**frontend/node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore)

**.planning/codebase/**
- Purpose: Architecture/structure analysis (this document)
- Generated: Yes (via gsd-map-codebase)
- Committed: Yes (reference for developers)

**.superpowers/sdd/**
- Purpose: GSD framework metadata (not code)
- Generated: Yes (by GSD tools)
- Committed: Maybe (framework tracking)

---

*Structure analysis: 2026-09-01*
