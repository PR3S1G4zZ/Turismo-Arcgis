# Coding Conventions

**Analysis Date:** 2026-09-01

## Naming Patterns

**Files:**
- React components: `ComponentName.jsx` or `componentName.jsx` (PascalCase for component files, camelCase for utilities)
- Utilities: `functionName.js` (camelCase)
- Test files: `fileName.test.js` or `fileName.spec.js` (co-located with source)
- Examples: `InteractiveMap.jsx`, `geoRuta.js`, `geoRuta.test.js`, `useGeolocation.js`

**Functions:**
- camelCase throughout (Spanish names common)
- Hook functions: `useXxxName` pattern (e.g., `useGeolocation`, `useNavegacion`, `useOrientacion`)
- Utility functions: `accionVerbo` pattern (e.g., `distanciaM`, `formatearDistancia`, `localizarEnRuta`)
- Middleware/handlers: descriptive camelCase (e.g., `asyncHandler`, `requireAuth`, `signToken`)
- Internal helpers: lowercase with descriptive names (e.g., `aPlano`, `circuloGeoJSON`, `lineaGeoJSON`)

**Variables:**
- camelCase with Spanish names: `ubicacion`, `ultimaActualizacion`, `gpsConfiable`, `posicion`
- State variables match their setters: `const [gpsConfiable, setGpsConfiable] = useState(...)`
- Reference variables: `xxxRef` (e.g., `mapRef`, `rafRef`, `permisoRef`)

**Types:**
- No TypeScript in this codebase; JavaScript with JSDoc type hints
- JSDoc used for function documentation (e.g., `@param`, `@returns`)
- Object properties follow camelCase (e.g., `{ lat, lng, heading, accuracy }`)

**Constants:**
- SCREAMING_SNAKE_CASE for module-level constants
- Examples: `RADIO_TIERRA_M`, `ZOOM_NAVEGACION`, `PITCH_NAVEGACION`, `PRECISION_MAXIMA_M`, `ERROR_PERMISO_DENEGADO`
- Component-level constants use `const NOMBRE = ...` (e.g., `const CARTO_CLARO = ...`)

## Code Style

**Formatting:**
- No Prettier config (not enforced)
- No explicit formatter configured; follows ESLint recommendations
- 2-space indentation (inferred from source files)
- Semicolons used throughout
- Single quotes in JSDoc, template literals for dynamic strings

**Linting:**
- ESLint enabled (flat config format in `frontend/eslint.config.js`)
- Plugins: `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Extends: `js.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- Ignores: `dist/`
- No TypeScript—pure JavaScript with JSX
- Backend uses same naming but no ESLint config found in this repo

## Import Organization

**Order:**
1. React/framework imports: `import { useState, useEffect } from 'react'`
2. Third-party libraries: `import Map from 'react-map-gl/maplibre'`
3. CSS/styles: `import 'maplibre-gl/dist/maplibre-gl.css'`
4. Internal utilities: `import { distanciaM } from '../utilidades/geoRuta'`
5. Internal components/hooks: `import { useOrientacion } from '../hooks/useOrientacion'`
6. Context: `import { NavegacionContext } from '../contexto/NavegacionContext'`

**Path Aliases:**
- No path aliases configured; relative paths used throughout
- Examples: `../../utilidades/api`, `../../hooks/useOrientacion`, `../../contexto/NavegacionContext`

**Barrel Files:**
- No barrel files (index.js exports) observed; direct imports of source files

## Error Handling

**Frontend Patterns:**
- React state for errors: `const [error, setError] = useState(null)`
- Try-catch in async functions and effects
- Graceful fallbacks for API errors (e.g., fallback basemaps in `InteractiveMap.jsx`)
- Validation before operations (e.g., username/password length checks)
- Generic user-facing error messages in Spanish
- Example from `useGeolocation.js`: `mensajeDeError(err, permiso)` translates GPS errors to actionable messages

**Backend Patterns:**
- `asyncHandler` wrapper (`backend/src/utils/http.js`) catches Promise rejections and passes to error middleware
- All route handlers wrapped: `asyncHandler(async (req, res) => { ... })`
- Centralized error middleware (last middleware in `index.js`): catches multer errors and logs others
- HTTP response pattern: `res.status(code).json({ error: 'message' })`
- Example error responses:
  ```javascript
  res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' })
  res.status(401).json({ error: 'Credenciales incorrectas.' })
  res.status(403).json({ error: 'Acción reservada al super-administrador.' })
  ```
- JWT verification wraps try-catch for invalid tokens: `catch { return res.status(401).json(...) }`

## Logging

**Frontend:**
- No logging framework; uses `console.log`, `console.error` for debugging
- Example: `console.error('[error]', err)` in error handlers
- No production logging observed; relies on browser DevTools

**Backend:**
- `console.log` and `console.error` with prefixed tags
- Format: `console.log('[tag]', message)` or `console.error('[tag]', message)`
- Tags used: `[db]`, `[error]`
- Examples:
  ```javascript
  console.log('[db] Base de datos lista.')
  console.error('[db] No se pudo conectar/inicializar MySQL:', err.message)
  ```

## Comments

**When to Comment:**
- Complex algorithms: explained before implementation (e.g., `geoRuta.js` comments on Haversine, local plane projection)
- Configuration rationale: explain "why" for non-obvious settings (e.g., `vite.config.js` explains why postcss is empty)
- Security/validation: note sensitive operations (e.g., "Mensaje genérico para no revelar si el usuario existe")
- Browser API quirks: document workarounds and their purpose (e.g., ResizeObserver polyfill, RAF cancellation)

**JSDoc/TSDoc:**
- Used for functions with multiple parameters or complex return types
- Format: `/** description */` followed by `@param {type} name - description`
- Example from `geoRuta.js`:
  ```javascript
  /**
   * Mezcla circular de dos rumbos (0–360) para suavizar el ruido del sensor
   * (GPS o brújula). Promedia en el plano seno/coseno para cruzar bien el corte
   * 359°→0°. `factor` es el peso de la lectura nueva (0–1).
   */
  export function suavizarRumbo(anterior, nuevo, factor = 0.35) { ... }
  ```

**Language:**
- All comments and strings in Spanish (matches user interface and team language)
- Technical terms use Spanish names where established (e.g., `distanciaM`, `rumbo`, `ubicacion`)

## Function Design

**Size:**
- No strict size limit enforced, but functions favor single responsibility
- Complex geometry utilities (e.g., `prepararRuta`) documented with multiple steps
- Event handlers and effects kept under 50 lines where possible

**Parameters:**
- Destructured objects for multiple related parameters (e.g., `function mensajeEstadoGps({ gpsConfiable, ultimaActualizacion, ahora })`)
- Positional arguments for single/unrelated parameters
- Default parameters used (e.g., `function usePosicionAnimada(objetivo, duracionMs = 600)`)
- Hooks pass options objects: `useGeolocation({ precisionAlta: true })`

**Return Values:**
- Explicit returns for clarity (no implicit undefined)
- Object returns use spread operator to preserve full payload: `return { ...ruta, puntos, pasos, acumulados, largoTotalM }`
- Null used for "no value" in nullable cases (e.g., `if (puntos.length < 2) return null;`)
- Hooks return objects with state and functions: `{ position, error, loading, gpsConfiable, ultimaActualizacion }`

## Module Design

**Exports:**
- Named exports preferred: `export function xxx() { }`
- Default export used only for components and Context providers
- Example: `export const authRouter = Router();` (backend routes)
- Frontend components: `export function App() { }` or `export const App = () => { }`

**Barrel Files:**
- No barrel files observed in this codebase
- Direct imports from source files recommended

**Module Structure:**
- **Frontend utilities** (`src/utilidades/`): pure functions, no side effects
  - Example: `geoRuta.js` — geometry calculations
  - Example: `api.js` — fetch wrappers
- **Frontend hooks** (`src/hooks/`): React custom hooks
  - Example: `useGeolocation.js` — GPS state management
  - Example: `useNavegacion.js` — navigation logic
- **Frontend components** (`src/componentes/`): organized by feature
  - `admin/`, `calendario/`, `comunes/`, `detalle/`, `estructura/`, `inicio/`
  - Each component has `ComponentName.jsx` and optional `ComponentName.css`
- **Frontend context** (`src/contexto/`): global state with Context API
  - Example: `AppProvider.jsx`, `NavegacionProvider.jsx`
- **Backend routes** (`src/routes/`): Express routers
  - Each router mounted in `index.js`
  - Example: `auth.js`, `sites.js`, `pqrs.js`
- **Backend middleware** (`src/middleware/`): cross-cutting concerns
  - Example: `auth.js` — JWT verification
  - Example: `upload.js` — file upload handling
- **Backend utils** (`src/utils/`): helper functions
  - Example: `http.js` — asyncHandler, type conversions
  - Example: `mappers.js` — data transformation

## Language & Internationalization

**Primary Language:** Spanish
- All user-facing strings, comments, variable names in Spanish
- Examples: `formatearDistancia`, `ultimaActualizacion`, `gpsConfiable`, `navegando`
- Error messages in Spanish: "Usuario y contraseña son obligatorios", "GPS no disponible"

---

*Convention analysis: 2026-09-01*
