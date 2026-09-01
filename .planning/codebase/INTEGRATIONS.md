# External Integrations

**Analysis Date:** 2026-09-01

## APIs & External Services

**Routing & Navigation:**
- **ArcGIS World Route Service** - Primary routing provider for real-time turn-by-turn navigation
  - SDK/Client: Direct HTTP/REST API calls (no SDK)
  - Endpoint: `https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve`
  - Auth: ARCGIS_API_KEY (direct API key) OR ARCGIS_CLIENT_ID + ARCGIS_CLIENT_SECRET (OAuth 2.0 app credentials)
  - Implementation: `backend/src/utils/arcgisRouting.js`
  - Features: Route calculation respecting one-way streets and turn restrictions, support for walking/driving modes, Spanish language directions
  - Token caching: Refreshed every 2 weeks with OAuth; API keys cached daily by default
  - Fallback: OSRM public server if credentials missing or service fails

- **OSRM (Open Source Routing Machine)** - Fallback routing provider
  - Public demo server: `https://router.project-osrm.org/route/v1`
  - Auth: None (public demo)
  - Implementation: `backend/src/utils/osrmRouting.js`
  - Features: Route calculation, instruction generation in Spanish, maneuver-based directions
  - Note: Demonstration server with no SLA; valid for development and emergency fallback only

- **Nominatim (OpenStreetMap)** - Geocoding for address search
  - Endpoint: `https://nominatim.openstreetmap.org`
  - Auth: None (public)
  - CSP allow-listed: `connect-src` directive in `backend/src/index.js`
  - Frontend usage: Direct browser requests via `InteractiveMap.jsx` for geocoding without backend proxy

**Mapping & Basemaps:**
- **ArcGIS Basemap Vector Services** - Primary interactive map basemap
  - Endpoints: 
    - `https://basemapstyles-api.arcgis.com` (style definitions)
    - `https://ibasemaps-api.arcgis.com` (imagery basemaps)
    - `https://static-map-tiles-api.arcgis.com` (static tile cache)
  - Auth: Reuses ARCGIS_API_KEY or ARCGIS_CLIENT_ID credentials from routing
  - Token Referer: Must match `ARCGIS_REFERER` env var (registered in ArcGIS credentials)
  - Implementation: `backend/src/routes/mapa.js` (`/api/mapa/token` endpoint returns token to client)
  - Client-side: MapLibre GL with ArcGIS Vector layer (via `react-map-gl` component)
  - Fallback: CARTO basemaps if ArcGIS fails

- **CARTO Basemaps** - Fallback basemap provider
  - Endpoints: 
    - `https://basemaps.cartocdn.com` (raster tiles)
    - `https://basemaps-api-internal.cartocdn.com` (API)
  - Auth: None (public layer)
  - CSP allow-listed in helmet configuration

**Calendar Integration:**
- **Google Calendar** - Event import and synchronization
  - Integration method: iCalendar (.ics) feed parsing (not OAuth)
  - Client library: `node-ical` (v0.20.1)
  - Implementation: `backend/src/googleCalendar.js` (URL normalization, event parsing, date/time handling)
  - Calendar URL handling:
    - Public iCalendar URLs (`*.ics` or `/ical/` paths) accepted directly
    - Google Calendar interface URLs converted to iCal feed format
    - Base calendar ID extracted from URL parameters and reconstructed to public iCal URL format
  - Endpoint: `https://calendar.google.com/calendar/ical/{calendarId}/public/basic.ics`
  - Route: `backend/src/routes/googleCalendar.js` (POST `/api/eventos/google-calendar` endpoint)
  - Features: Fetch events by month, normalize dates and times to local timezone, support for all-day events

**Image Services:**
- **Unsplash** - Fallback placeholder images for sites
  - Domain: `images.unsplash.com`
  - CSP allow-listed in helmet (img-src directive)
  - Usage: Site cards and detail pages fall back to Unsplash if site images unavailable
  - Auth: None (public)

## Data Storage

**Databases:**
- **MySQL 8.0**
  - Connection: `backend/src/db.js` (connection pool via `mysql2/promise`)
  - Environment: DB_HOST, DB_PORT (default 3306), DB_USER, DB_PASSWORD, DB_NAME
  - Client: `mysql2/promise` (prepared statements, async pool)
  - Schema: Created on first backend startup via `backend/src/scripts/initDb.js`
  - Tables: users, sites, announcements, events, pqrs_submissions, stats_pages
  - Dev deployment: Docker container (`mysql:8.0` in docker-compose.yml), runs on port 3307 by default

**File Storage:**
- **Local Filesystem** - Site/announcement/PQRS images
  - Storage path: `backend/uploads/` directory
  - Implementation: `backend/src/middleware/upload.js` (multer middleware)
  - Route: POST `/api/upload` (MIME type validation, file size limits)
  - Static serving: Express serves `/uploads` as static with 7-day cache headers
  - Considerations: Must be persistent volume in production (Railway PersistentDisks or external S3)

**Caching:**
- None (no Redis or external cache layer detected)
- In-memory token caching only (ArcGIS OAuth token refreshed every 2 weeks, API key daily)

## Authentication & Identity

**Auth Provider:**
- **Custom JWT** - Admin panel authentication
  - Implementation: `backend/src/middleware/auth.js` (JWT verification middleware)
  - Token generation: `backend/src/routes/auth.js` (POST `/api/auth/login`)
  - Secret: Stored in `JWT_SECRET` env var
  - Expiration: Configurable via `JWT_EXPIRES_IN` (default 8h)
  - Algorithm: HS256 (default for `jsonwebtoken`)
  - Password hashing: bcryptjs (2.4.3) with salt rounds

**Admin Users:**
- Super-admin provisioned on first database initialization via `backend/src/scripts/initDb.js`
- Default credentials: `admin` / `Itagui2026*Cambiar` (must be changed in production)
- Roles: `superadmin` (full access) and `admin` (limited to role permissions)

**API Security:**
- Rate limiting: `express-rate-limit` on routing endpoint (60 requests per 5 minutes per IP)
- CORS: Whitelist configured in `backend/src/index.js`, localhost auto-allowed in development
- HTTP headers: Helmet CSP, X-Frame-Options, HSTS, etc. (see `backend/src/index.js` for full policy)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, or equivalent integration)
- Logging: `console.error()` and `console.warn()` in routing/auth modules

**Logs:**
- Approach: stdout/stderr via Node.js console (captured by Docker/Railway logs)
- Key log points: routing provider fallback, authentication failures, database connection errors
- Structured logging: Not implemented; plain text messages

## CI/CD & Deployment

**Hosting:**
- **Railway** - Production hosting platform
  - Dockerfile: `Dockerfile` (multi-stage, Node.js 20 Alpine)
  - Environment injection: PORT, DATABASE_URL, and all env vars from Railway project settings
  - Database: Railway MySQL plugin (external service)
  - Static files: Frontend dist served from same backend container via `express.static()`

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, or Circle CI configuration)
- Manual deployment to Railway (push to main branch or manual trigger in Railway dashboard)

## Environment Configuration

**Required env vars:**
- `DB_HOST` - MySQL host (localhost for dev, Railway service for prod)
- `DB_PORT` - MySQL port (3306 default, 3307 in docker-compose)
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - MySQL database name
- `JWT_SECRET` - Admin authentication secret (must be random, long string in production)
- `NODE_ENV` - Set to `production` for Railway
- `PORT` - HTTP server port (3001 default, overridden by Railway)
- `CORS_ORIGIN` - Comma-separated list of allowed frontend origins
- `PUBLIC_URL` - Base URL for redirect URLs and file serving

**ArcGIS Routing (one required):**
- `ARCGIS_API_KEY` - Direct API key (long-lived), OR
- `ARCGIS_CLIENT_ID` + `ARCGIS_CLIENT_SECRET` - OAuth 2.0 app credentials (automatic token refresh)
- `ARCGIS_REFERER` - Domain registered in ArcGIS app (required for OAuth token binding)

**Secrets location:**
- `.env` files (git-ignored via `.gitignore`)
- Railway project settings → Environment Variables (dashboard)
- Never committed to git

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

---

*Integration audit: 2026-09-01*
