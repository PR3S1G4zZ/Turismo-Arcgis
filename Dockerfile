# Dockerfile
# Imagen única para Railway: compila el frontend y lo sirve desde el mismo
# backend Express (ver backend/src/index.js). La base de datos MySQL es un
# servicio/plugin aparte en Railway, no vive en esta imagen.

# ─── Etapa 1: build del frontend ────────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Vacío = mismo origen (backend y frontend en el mismo servicio). Solo hace
# falta pasar un valor distinto si el frontend se sirve desde otro dominio.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ─── Etapa 2: backend + frontend compilado ─────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
# Railway inyecta PORT en runtime; config.js ya lo respeta (con 3001 de
# respaldo para correr la imagen fuera de Railway).
EXPOSE 3001

CMD ["node", "src/index.js"]
