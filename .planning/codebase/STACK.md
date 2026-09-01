# Technology Stack

**Analysis Date:** 2026-09-01

## Languages

**Primary:**
- JavaScript (ES Module) - Frontend and backend applications
- SQL - MySQL database schemas and migrations

## Runtime

**Environment:**
- Node.js 20 (Alpine) - Containerized via Docker
- Browser APIs - Web Speech API, Geolocation API, Web Workers

**Package Manager:**
- npm (v10+)
- Lockfiles: `package-lock.json` (present in both frontend and backend)

## Frameworks

**Core:**
- React 19.2.6 - Frontend UI framework
- Express 4.21.2 - Backend REST API framework
- Vite 8.0.12 - Frontend build tool and dev server

**Mapping & Routing:**
- MapLibre GL 5.24.0 - Vector map rendering (primary)
- react-map-gl 8.1.2 - React wrapper for MapLibre GL
- Leaflet 1.9.4 - Legacy dependency (navigation uses MapLibre, not Leaflet)
- react-leaflet 5.0.0 - Legacy dependency

**Charting & Visualization:**
- Recharts 3.8.1 - Chart library for analytics/dashboards

**Routing:**
- Testing: Vitest 4.1.11 - Unit and integration test framework
- Testing Environment: jsdom 29.1.1 - DOM simulation for tests

## Key Dependencies

**Critical:**
- maplibre-gl 5.24.0 - Open-source map rendering; replaces ArcGIS JavaScript SDK for map display
- mysql2 3.12.0 - MySQL connection pool and query execution
- express-rate-limit 7.5.0 - Rate limiting for routing API (protects against excessive ArcGIS charges)
- jsonwebtoken 9.0.2 - JWT authentication for admin panel
- bcryptjs 2.4.3 - Password hashing

**Security & Infrastructure:**
- helmet 8.0.0 - HTTP header hardening (CSP, HSTS, X-Frame-Options, etc.)
- cors 2.8.5 - Cross-Origin Resource Sharing for frontend/backend communication
- multer 2.0.1 - File upload handling (site/announcement/PQRS images)
- express 4.21.2 - HTTP server framework

**External API Integration:**
- node-ical 0.20.1 - iCalendar (.ics) parsing for Google Calendar events
- dotenv 16.4.7 - Environment variable loading

**Frontend Utilities:**
- react-router-dom 7.17.0 - Client-side routing
- react-icons 5.6.0 - Icon library

## Configuration

**Environment:**
- Backend: `backend/.env` (database, JWT secret, ArcGIS credentials, OSRM fallback)
- Frontend: `frontend/.env` (VITE_API_URL, points to backend API)
- Docker: Environment variables injected by Railway platform (PORT, DATABASE_URL, etc.)

**Key Environment Variables:**
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MySQL connection
- `JWT_SECRET` - Admin authentication token signing
- `ARCGIS_API_KEY` or (`ARCGIS_CLIENT_ID` + `ARCGIS_CLIENT_SECRET`) - Routing service credentials
- `ARCGIS_REFERER` - Required for OAuth authentication with ArcGIS
- `NODE_ENV` - `production` for Railway deployments
- `PORT` - HTTP server port (default 3001, overridden by Railway)
- `CORS_ORIGIN` - Allowed frontend origins

**Build:**
- `vite.config.js` - Frontend build configuration (React plugin, no PostCSS)
- `vitest.config.js` - Test runner configuration with jsdom environment
- `eslint.config.js` - Flat ESLint config (recommended, React hooks, React Refresh)
- `Dockerfile` - Multi-stage Docker image (frontend build → backend + static assets)
- `docker-compose.yml` - Local development services (MySQL 8.0 + Adminer)

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- Docker (for local MySQL development)
- Modern browser with Web APIs (Geolocation, Web Speech, Web Workers)

**Production:**
- Deployment target: Railway (documented in Dockerfile)
- MySQL 8.0 (external service, not containerized in production)
- Node.js 20 runtime (Railway container)
- 2 MB request limit (configured in Express)

---

*Stack analysis: 2026-09-01*
