# Backend — Turismo Itagüí

API REST del portal (Node.js + Express + **MySQL**). Gestiona sitios turísticos,
anuncios, eventos, PQRS, autenticación de administradores, subida de imágenes y
el proxy del calendario compartido (`.ics`) de Google.

Toda la lógica de negocio vive aquí; el frontend solo consume esta API.

## Requisitos

- Node.js 18 o superior.
- Un servidor MySQL 5.7+ / MariaDB 10.4+ en ejecución.

## Instalación y ejecución

```bash
cd backend
npm install
cp .env.example .env    # ajusta credenciales de MySQL, JWT y super-admin
npm run init-db         # crea la base de datos, el esquema y el super-admin
npm run dev             # desarrollo con recarga automática (--watch)
# npm start             # producción
```

Al arrancar, el backend crea automáticamente la base de datos (`DB_NAME`), las
tablas y —solo la primera vez— el **super-administrador** con las credenciales
`SEED_ADMIN_*` del `.env`. Escucha por defecto en `http://localhost:3001`.

## Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend (3001). |
| `CORS_ORIGIN` | Orígenes permitidos, separados por comas. |
| `PUBLIC_URL` | URL pública del backend (para armar las URLs de las imágenes). |
| `ROUTING_HTTP_TIMEOUT_MS` | Tiempo máximo, en milisegundos, para cada llamada externa de ruteo antes de activar el respaldo. |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | Conexión MySQL. |
| `JWT_SECRET` | Secreto para firmar los tokens. **Usa uno aleatorio y largo en producción.** |
| `JWT_EXPIRES_IN` | Vigencia del token (ej. `8h`). |
| `SEED_ADMIN_USERNAME` `SEED_ADMIN_PASSWORD` `SEED_ADMIN_NAME` | Super-admin inicial. |

## Seguridad

- Contraseñas almacenadas con **bcrypt** (nunca en texto plano).
- Sesiones con **JWT** firmado; las rutas de escritura exigen `Authorization: Bearer <token>`.
- **Rate-limiting** en el login (anti fuerza bruta) y en el envío público de PQRS/imágenes.
- Cabeceras de seguridad con **helmet**.
- Roles: `superadmin` (registra y administra otras cuentas) y `admin`.

## Endpoints principales

Públicos (lectura y formularios ciudadanos):
- `GET /api/health`
- `GET /api/sites` · `GET /api/sites/:id` · `POST /api/sites/:id/visit`
- `GET /api/announcements`
- `GET /api/events`
- `GET /api/settings`
- `POST /api/pqrs` (envío del formulario de contacto/inclusión)
- `POST /api/upload/public` (imagen del establecimiento en PQRS)
- `GET /api/google-calendar?url=<ics>&month=YYYY-MM`

Autenticación:
- `POST /api/auth/login` → `{ token, user }`
- `GET /api/auth/me`
- `PATCH /api/auth/password`

Protegidos (requieren token de administrador):
- `POST/PUT/DELETE /api/sites/:id`
- `POST/PUT/DELETE /api/announcements/:id`
- `POST/PUT/DELETE /api/events/:id`
- `GET /api/pqrs` · `PATCH /api/pqrs/:id` · `DELETE /api/pqrs/:id`
- `PUT /api/settings/google-calendar`
- `POST /api/upload` (subida de imágenes del panel)

Reservados al super-administrador:
- `GET/POST /api/users` · `PATCH/DELETE /api/users/:id`

## Imágenes

Las imágenes se guardan como archivos en `backend/uploads/` y se sirven en
`/uploads/<archivo>`. La carpeta está excluida de git (salvo `.gitkeep`).

## Cómo obtener la URL `.ics` en Google Calendar

Google Calendar → *Configuración del calendario* → *Integrar calendario* →
**Dirección pública en formato iCal** (el calendario debe ser público).
