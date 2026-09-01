# Codebase Concerns

**Analysis Date:** 2026-09-01

## Tech Debt

**Monolithic Frontend Components:**
- Issue: Large components (AdminDashboard.jsx at 1,929 lines, RouteModal.jsx at 599 lines, PqrsPage.jsx at 641 lines) combine UI, state, API calls, and validation in single files
- Files: `frontend/src/componentes/admin/AdminDashboard.jsx`, `frontend/src/paginas/PqrsPage.jsx`, `frontend/src/componentes/detalle/RouteModal.jsx`, `frontend/src/componentes/detalle/InteractiveMap.jsx`
- Impact: Difficult to test, maintain, reuse components; high bug risk when refactoring; cognitive load on developers
- Fix approach: Extract smaller presentational components, separate business logic into custom hooks, create component composition boundaries (e.g., `AdminDashboard` should be split into `UserManager`, `SiteEditor`, `AnnouncementEditor`, `StatsDashboard` components)

**Backend Lacks Automated Tests:**
- Issue: Zero test files in `backend/src` despite complex business logic (routing, OAuth token management, file upload, database operations)
- Files: `backend/src/utils/arcgisRouting.js` (270 lines, token cache/refresh logic), `backend/src/db.js` (161 lines, schema initialization), `backend/src/routes/sites.js` (148 lines)
- Impact: Regressions silently introduced; OAuth token refresh not verified; database schema changes risky; file upload security not validated
- Fix approach: Add Jest/Vitest configuration to backend; start with critical paths: (1) token refresh cycle (2) route resolution with fallback to OSRM (3) file upload filtering (4) database query helpers

**Frontend Test Coverage Fragmented:**
- Issue: Only 6 test files for 7,945 lines of frontend code; coverage limited to GPS utilities and geolocation hooks
- Files: `frontend/src/componentes/detalle/estadoGps.test.js`, `frontend/src/hooks/useGeolocation.test.js`, `frontend/src/hooks/useNavegacion.test.js`, `frontend/src/utilidades/api.test.js`, `frontend/src/utilidades/geoRuta.test.js`, `frontend/src/componentes/detalle/InteractiveMap.test.jsx`
- Impact: Admin dashboard mutations (user, site, PQRS changes) untested; API error states untested; routes recalculation edge cases not comprehensive
- Fix approach: Add test coverage for AdminDashboard mutations, route recalculation, map interaction, PQRS form validation

**Untyped JavaScript in Critical Paths:**
- Issue: Core utility files (`geoRuta.js`, `useNavegacion.js`, `useGeolocation.js`) written in JS not TypeScript; no JSDoc coverage
- Files: `frontend/src/utilidades/geoRuta.js` (222 lines), `frontend/src/hooks/useNavegacion.js` (321 lines), `frontend/src/hooks/useGeolocation.js` (272 lines)
- Impact: Silent type bugs in GPS projection, bearings calculation, route deviation detection; hard to refactor
- Fix approach: Migrate critical utilities to TypeScript or add comprehensive JSDoc with type annotations

---

## Known Bugs

**GPS Route Progress Jumping (Recently Fixed):**
- Symptoms: User's progress indicator would skip ahead when route geometry came close to itself (loop-like paths); position would snap to wrong segment
- Files: `frontend/src/utilidades/geoRuta.js` (fixed by commit 677a933: "fix: no adelantar el progreso de ruta cuando esta pasa cerca de si misma")
- Trigger: Routes that loop back (e.g., going around a block or returning near starting point); detection window (30m) wasn't checking segment order
- Workaround: Not needed; fixed in main. But test coverage added in `frontend/src/utilidades/geoRuta.test.js` lines 25-42 shows the edge case.
- Residual risk: Similar edge cases may exist with alternate route topologies (sharp angles, zigzags); coverage should expand

**GPS Position Staleness Not Clearly Surfaced (Recently Fixed):**
- Symptoms: Map continued to show navigation UI and ETA even after GPS signal lost; user unaware navigation had stopped working
- Files: `frontend/src/componentes/detalle/estadoGps.js`, `frontend/src/hooks/useGeolocation.js`
- Trigger: GPS loss after initial lock (e.g., entering tunnel, GPS jamming); stale position from 5 seconds ago still used for camera/bearing
- Workaround: Implemented in commit 9bb67ef ("fix: clarify stale GPS route status") — now UI visually distinguishes live vs. stale position
- Residual risk: Users on slow GPS updates (rural areas) may misinterpret stale position as live; timeout (5s) is hardcoded, not configurable

**Map Camera Lifecycle Race Conditions (Recently Fixed):**
- Symptoms: Map tilted incorrectly, bearing froze, or camera didn't follow user during navigation transitions
- Files: `frontend/src/componentes/detalle/InteractiveMap.jsx` (lines 276-310 show fixed useEffect dependencies)
- Trigger: Rapid transitions (preview → live → preview) without proper cleanup; bearing interpolation conflicting with course-up rotation
- Workaround: Not needed; fixed in commit 6673f72 ("fix: stabilize map camera lifecycle")
- Residual risk: useRef-based state tracking (sesionEnVivoRef, vistaInformativaAplicadaRef) is fragile; new transitions not yet tested

**ArcGIS Token Refresh Timing (Potential Issue, Not Yet Reported):**
- Symptoms: Not observed in current code, but token cache logic may fail under high load
- Files: `backend/src/utils/arcgisRouting.js` (lines 24-63: cacheToken, cacheTokenExpira management)
- Trigger: If 20+ route requests arrive within OAuth token refresh window (expiry - 5m margin), race condition possible; multiple simultaneous calls to obtenerToken() will each call ArcGIS
- Workaround: None; add promise-based lock (single in-flight request) rather than simple cache check
- Impact: Multiple token requests charged; ephemeral failures if ArcGIS rate-limits; log spam

---

## Security Considerations

**Hardcoded Development Credentials in Config:**
- Risk: Default JWT secret `'dev-secreto-inseguro-cambiar'` (line 30, `backend/src/config.js`) is weak; if JWT_SECRET env var not set in production, any attacker can forge admin tokens
- Files: `backend/src/config.js` (line 30), `backend/src/config.js` (line 49: default admin password `'Itagui2026*Cambiar'`)
- Current mitigation: Console warning logged if JWT_SECRET not provided; seed admin password must be changed after first login (documented in db.js line 160)
- Recommendations: (1) Remove default JWT secret entirely; fail startup if JWT_SECRET not set in production (2) Require password change on first login (enforce via /api/auth/password middleware) (3) Add security headers scan to CI (use OWASP ZAP or similar)

**ArcGIS API Key Exposure Risk (Mitigated):**
- Risk: ArcGIS token (API key or OAuth) embedded in MapLibre requests sent to client; if token has wide permissions, attacker can call ArcGIS services directly
- Files: `frontend/src/componentes/detalle/InteractiveMap.jsx` (lines 266-274: transformRequest adds token to ArcGIS URLs)
- Current mitigation: Token scoped to basemap + routing only; web Referer header registered in ArcGIS credentials restricts origin
- Recommendations: (1) Rotate ArcGIS token monthly (2) monitor ArcGIS usage logs for anomalies (3) consider proxy-all-ArcGIS-calls approach if token is wide-scoped

**File Upload MIME Type Bypass:**
- Risk: Multer fileFilter checks MIME type only (`file.mimetype`); renamed malicious file (e.g., .svg pretending to be .jpg) could bypass, then browser executes as script if served with wrong Content-Type
- Files: `backend/src/middleware/upload.js` (line 30: fileFilter checks mimetype only)
- Current mitigation: (1) Files stored outside web root (/uploads, served via express.static with 7d cache, not executable) (2) extension only used for display naming (line 20) (3) no Content-Type header override attempted in express.static call
- Recommendations: (1) Add magic byte validation (check first 8 bytes via `file-type` package) before accepting (2) serve uploads with `Content-Disposition: attachment` to force download instead of inline viewing (3) consider storing uploads in a separate CDN bucket

**SQL Injection Protection:**
- Risk: All queries use parameterized statements; no detected SQL injection vectors
- Files: `backend/src/db.js`, all route files
- Current mitigation: mysql2 prepared statements in all queries
- Recommendations: Continue using parameterized queries; no changes needed

**JWT Expiry and Refresh Token Absence:**
- Risk: Tokens expire after 8 hours (`backend/src/config.js` line 31: `expiresIn: '8h'`); after expiry, user must re-login; no refresh token mechanism to extend session gracefully
- Files: `backend/src/middleware/auth.js` (line 11: expiresIn passed to jwt.sign)
- Current mitigation: 8-hour expiry is reasonable for admin panel (not high-traffic public API)
- Recommendations: For mobile navigation use case, consider shorter expiry (15 min) + refresh token rotation; current is acceptable for admin-only use

---

## Performance Bottlenecks

**Synchronous GPS Route Projection on Each Update:**
- Problem: `localizarEnRuta()` called every GPS update (~1/sec during navigation) without debouncing; geospatial distance/bearing calculations run inline
- Files: `frontend/src/utilidades/geoRuta.js` (lines 30-150: geometry computations), `frontend/src/hooks/useNavegacion.js` (called on each GPS tick)
- Cause: No Web Worker for heavy calculations; JavaScript event loop blocks render frame
- Improvement path: (1) Offload geometry to Web Worker (pre-compute segment tree for O(log n) lookup instead of O(n)) (2) debounce updates to 200ms (still 5 fps) (3) profile with Chrome DevTools Performance tab to verify frame drops

**Frontend Bundle Size Unknown:**
- Problem: No build analyzer configured; MapLibre GL + Recharts + React Router not tree-shaken
- Files: `frontend/package.json` (lists 8 dependencies; no build output analysis)
- Cause: Vite default config doesn't include size reporting
- Improvement path: (1) Add `vite-plugin-compression` for gzip/brotli stats (2) add vite-plugin-visualizer to audit bundle (3) target <300KB gzipped for main bundle

**Database Indexes Missing on Frequently Queried Columns:**
- Problem: Queries on `users.username`, `sites.category`, `sites.zone`, `pqrs.status` lack indexes
- Files: `backend/src/db.js` (schema CREATE TABLE statements lines 25-105)
- Cause: Initial schema focused on correctness, not performance
- Improvement path: Add indexes: `CREATE INDEX idx_users_username ON users(username)`, `idx_sites_category ON sites(category)`, `idx_sites_zone ON sites(zone)`, `idx_pqrs_status ON pqrs(status)`

**visit_log Table Unbounded Growth:**
- Problem: `visit_log` (line 99-105 in db.js) inserted once per site visit, no retention policy or partitioning
- Files: `backend/src/db.js` (CREATE TABLE visit_log), presumably used by stats routes
- Cause: Assumed infinite storage; no archive strategy
- Improvement path: (1) Add retention policy (delete records > 1 year old) (2) partition by month for faster queries (3) consider rolling aggregate table (pre-computed daily/weekly stats) to avoid scanning raw log

---

## Fragile Areas

**Map Initialization and State Synchronization:**
- Files: `frontend/src/componentes/detalle/InteractiveMap.jsx` (lines 148-214: multiple useState, multiple useEffect)
- Why fragile: 7 separate state variables (coordinates, loading, isDark, token, arcgisFallo, mapError, siguiendo) + 3 refs (mapRef, sesionEnVivoRef, vistaInformativaAplicadaRef) orchestrate map behavior; coupling between token fetch, theme changes, and camera tracking; missing dependency arrays can cause stale closures
- Safe modification: (1) Extract MapState context to reduce prop drilling and synchronization complexity (2) add invariant checks (assert mapListo && token before camera operations) (3) add React DevTools Profiler marks to detect unnecessary re-renders
- Test coverage: InteractiveMap.test.jsx has 142 lines but doesn't cover token/basemap fallback, dark mode theme transitions, or rapid coordinate changes

**Route Deviation and Recalculation Logic:**
- Files: `frontend/src/hooks/useNavegacion.js` (lines 100-180 approximate: deviation detection, recalculation timer)
- Why fragile: Recalculation triggered by (1) elapsed time check (15s min) AND (2) distance threshold (45m) AND (3) 3 consecutive GPS readings; multiple timers/refs interact; if any GPS update is stale/wrong, recalculation cascades unexpectedly
- Safe modification: (1) Add explicit state machine (IDLE → WAITING → RECALCULATING → LIVE) instead of flags (2) unit test each transition (3) add telemetry log for each recalculation (why it happened)
- Test coverage: useNavegacion.test.js exists but doesn't validate edge cases (e.g., exact 45m boundary, 2 of 3 GPS reads stale)

**ArcGIS Token Cache Renewal (Race Condition):**
- Files: `backend/src/utils/arcgisRouting.js` (lines 24-63: cacheToken + cacheTokenExpira)
- Why fragile: Simple cache check (lines 31) doesn't lock; if 2 requests arrive within token refresh window, both may call obtenerToken() concurrently, sending duplicate OAuth requests to ArcGIS
- Safe modification: (1) Add Promise-based mutex (single in-flight request) using a WeakMap or closure (2) queue pending requests behind the single call (3) add retry with exponential backoff if token fetch fails
- Test coverage: No unit tests for token refresh

**Database Connection Pool Exhaustion Under Load:**
- Files: `backend/src/db.js` (line 134: connectionLimit: 10)
- Why fragile: Only 10 concurrent connections; if 11+ requests arrive, they queue indefinitely; no timeout/circuit breaker
- Safe modification: (1) Add connection timeout and queue limit enforcement in mysql2 config (2) monitor pool usage via logs (3) consider increasing limit if production load warrants (but profile first)
- Test coverage: No load test

---

## Scaling Limits

**Concurrent Route Requests:**
- Current capacity: 10 MySQL connections × 3 seconds average per ArcGIS call = ~30 route requests per minute; rate limiter allows 60 per 5-min window, leaving headroom
- Limit: If >100 simultaneous users navigate, backend saturates; ArcGIS itself rate-limits after ~1000 calls/min depending on service tier
- Scaling path: (1) add Redis caching layer for identical origin-destination pairs (2) cache results for 5 min (3) consider background job queue (Bull/Bee-Queue) for non-urgent recalculations

**File Upload Throughput:**
- Current capacity: Multer single-file limit is 5 MB; 10 concurrent uploads = 50 MB in-flight
- Limit: Disk I/O on single container; no cloud storage integration (S3/GCS)
- Scaling path: (1) move uploads to S3/Cloudinary (2) add CDN (CloudFlare) for image delivery (3) pre-sign upload URLs to offload bandwidth from backend

**Admin Panel User List Performance:**
- Current capacity: GET /api/users loads all users (line 17-20, `backend/src/routes/users.js`) with no pagination; likely <100 admin users, so acceptable
- Limit: If system scales to 1000s of site records, GET /api/sites (line 18-20, backend/src/routes/sites.js) fetches all records every time
- Scaling path: Add pagination (limit/offset) to all list endpoints

---

## Dependencies at Risk

**Leaflet Included but Unused:**
- Risk: Leaflet 1.9.4 in package.json (frontend/src line 14, package.json) added for admin LocationPicker but entire navigation uses MapLibre; bundle weight penalty, maintenance burden
- Impact: +50KB gzipped in build; confusing for new developers
- Migration plan: Replace LocationPicker with MapLibre-based equivalent (react-map-gl Popup + click handlers) and remove leaflet dependency

**node-ical Dependency for Google Calendar Sync:**
- Risk: node-ical maintained externally; if Google Calendar API breaks, package may not update quickly; no fallback if import fails
- Impact: Calendar imports fail silently if package is stale
- Migration plan: Monitor package maintenance; consider switching to google-auth-library directly if ical parsing becomes a bottleneck

**express-rate-limit on req.ip Spoofing:**
- Risk: Rate limiter keys off `req.ip` (backend/src/routes/auth.js line 14, routing.js line 18); if behind proxy without X-Forwarded-For header, all requests appear from proxy IP
- Impact: Rate limit applies to entire proxy, not per-user; DDoS risk
- Migration plan: Configure express.set('trust proxy', 1) in index.js (line 30+); verify X-Forwarded-For header

---

## Missing Critical Features

**Error Boundaries and Crash Recovery:**
- Problem: No React Error Boundary component; if any component throws, entire app white-screens
- Impact: Navigation session lost if map crashes; no recovery UI
- Fix: Add ErrorBoundary wrapper in App.jsx, offer "retry" action

**Global Unhandled Promise Rejection Handler:**
- Problem: Async errors in API calls (e.g., fetch failures in useGeolocation) not caught; no centralized error reporting
- Impact: Errors silently logged to console; end-user has no visibility
- Fix: Add window.onunhandledrejection handler; show toast notification to user

**Structured Logging for Production Observability:**
- Problem: console.error/warn used throughout; no structured logs with timestamps, correlation IDs, or levels
- Impact: Production incidents hard to debug; no audit trail
- Fix: Add Winston or Pino logger; log with levels (info, warn, error, debug); include request ID in logs

**Data Backup and Disaster Recovery Plan:**
- Problem: No documented backup strategy for MySQL; uploads stored locally only
- Impact: Data loss if container fails; no RPO/RTO targets
- Fix: Add nightly MySQL dump to S3; document restore procedure; test monthly

**API Input Validation Schema:**
- Problem: Routes validate input manually (if statements); no centralized schema validation
- Impact: Inconsistent error messages; easy to miss edge cases
- Fix: Add Joi or Zod for schema validation; centralize in middleware

---

## Test Coverage Gaps

**Backend Route Handlers (All Routes):**
- What's not tested: POST /api/users (user registration), PATCH /api/users/:id (user updates), DELETE /api/users/:id, all CRUD operations on sites/events/pqrs
- Files: `backend/src/routes/users.js`, `backend/src/routes/sites.js`, `backend/src/routes/events.js`, `backend/src/routes/pqrs.js`
- Risk: Regression in role-based access control; SQL injection if parameterization ever breaks; concurrent updates corrupt data
- Priority: High (affects admin-only features; lower user blast radius but high trust impact)

**Frontend AdminDashboard Component:**
- What's not tested: User creation form, site edit form, PQRS review workflow, image upload in each section
- Files: `frontend/src/componentes/admin/AdminDashboard.jsx` (1,929 lines)
- Risk: Form validation bypass, API error handling, state corruption on failed uploads
- Priority: High (admin-only, but critical for data integrity)

**Route Recalculation Edge Cases:**
- What's not tested: Exact 45m boundary crossing, 2 of 3 GPS stale, GPS loop topology (route near itself), no GPS signal, rapid origin/destination changes
- Files: `frontend/src/hooks/useNavegacion.js`, `frontend/src/utilidades/geoRuta.js`
- Risk: Navigation fails silently under edge conditions; user unaware reroute didn't happen
- Priority: High (user-facing; safety concern in navigation)

**ArcGIS Token Refresh Cycle:**
- What's not tested: Simultaneous requests during token expiry, OAuth token fetch failure, retry with new token
- Files: `backend/src/utils/arcgisRouting.js`
- Risk: Token cache corruption; requests fail when they should retry
- Priority: Medium (rare under normal load, but production incident if it happens)

**File Upload Security:**
- What's not tested: MIME type bypass (e.g., .svg as .jpg), file size boundary (5 MB), concurrent uploads
- Files: `backend/src/middleware/upload.js`
- Risk: Malicious file execution, disk exhaustion
- Priority: Medium (site-specific; depends on CDN/file serving strategy)

---

*Concerns audit: 2026-09-01*
