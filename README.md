# Turismo Itagüí

Portal turístico del Municipio de Itagüí (Antioquia, Colombia): catálogo de
sitios de interés, calendario de eventos, PQRS ciudadano, panel de
administración y **navegación en tiempo real por calles reales** hasta cada
sitio, apoyada en el servicio de rutas de **ArcGIS**.

---

## Arquitectura

```
frontend/   React 19 + Vite + MapLibre/react-map-gl — catálogo, mapa y navegación
backend/    Node.js + Express + MySQL — API REST y proxy de ruteo
BD/         Script SQL del esquema, para desplegar/inspeccionar la BD a mano
docker-compose.yml   Contenedor de MySQL (+ Adminer) para desarrollo/despliegue
```

El frontend nunca habla directo con ArcGIS ni con la base de datos: todo pasa
por la API del backend.

---

## Navegación en tiempo real con ArcGIS

Desde la ficha de un sitio, el visitante pulsa **Iniciar Ruta**, elige *a pie*
o *en auto*, y obtiene una guía real por las calles de Itagüí — trazado real,
indicaciones giro a giro, avance en vivo y recálculo automático si se desvía.

### Qué resuelve ArcGIS exactamente

El backend consume el servicio hospedado **World Route** de Esri
(`route-api.arcgis.com/.../NAServer/Route_World`, operación `/solve`), que:

- Calcula el camino más corto **respetando el sentido de las calles** (no
  traza en contravía) y **prohibiendo giros ilegales** — está confirmado en la
  documentación oficial de Esri que el servicio hospedado *"must obey
  one-way roads, avoid illegal turns, and so on"*.
- Internamente usa una variante modificada del **algoritmo de Dijkstra** (no
  A\*, no Contraction Hierarchies), acelerada opcionalmente con un modo
  jerárquico que prioriza vías principales. Esri lo documenta así en
  ["Algorithms used by Network Analyst"](https://doc.esri.com/en/arcgis-pro/latest/help/analysis/networks/algorithms-used-by-network-analyst.html).
- Soporta **restricciones específicas por vehículo** (altura, peso, peso por
  eje, materiales peligrosos, rutas preferidas de camión) mediante el
  parámetro `travelMode` — hoy el proyecto solo usa los modos *Walking Time*
  y *Driving Time*, pero el mecanismo está disponible si algún día se necesita
  rutear vehículos de carga.
- Para Suramérica (incluida Colombia) los datos viales los provee **TomTom**,
  con Colombia en el nivel de cobertura más alto (*Predictive Traffic*, con
  atributos de logística disponibles).
- Si no hay credencial de ArcGIS configurada, o el servicio falla, el backend
  cae automáticamente a un **respaldo con OSRM** (servidor público de
  demostración) para que la navegación nunca se caiga en desarrollo.

### Cómo está integrado en este proyecto

```
Navegador (React + MapLibre)     Backend (Express)          ArcGIS
────────────────────────────     ──────────────────          ──────
useNavegacion()                  POST /api/rutas/resolver    /solve
  watchPosition (GPS real) ──┐     ├─ guarda la credencial
                             ├──►  ├─ cachea travelModes ───►
  proyecta la posición GPS  │      ├─ rate-limit por IP
  sobre la polilínea real   │      ├─ directionsLanguage=es
                             │      └─ respaldo OSRM si falla
  ¿desviado > 45 m? ─────────┘ (espera 15 s entre recálculos)
```

- **La credencial de ArcGIS nunca llega al navegador**: vive solo en
  `backend/.env` (`ARCGIS_CLIENT_ID`/`ARCGIS_CLIENT_SECRET` u
  `ARCGIS_API_KEY`); el frontend solo conoce `/api/rutas/resolver`.
- **Seguimiento en tiempo real construido a medida**: Esri no ofrece
  seguimiento de ruta (recálculo automático, detección de desvío) en su SDK
  de JavaScript para web — solo en sus SDK nativos (iOS/Android/.NET). Aquí se
  implementa sobre `navigator.geolocation.watchPosition` (GPS real y
  continuo) + proyección geométrica punto-segmento de la posición sobre la
  polilínea ya resuelta (`frontend/src/utilidades/geoRuta.js`), sin depender
  de ningún SDK de mapas de Esri.
- **Recálculo dinámico por desviación**, no por distancia fija: si el usuario
  se aleja más de 45 m de la ruta trazada durante 3 lecturas GPS consecutivas
  (para filtrar ruido del GPS urbano), y pasaron al menos 15 s desde el último
  cálculo (cada recálculo es una petición facturable), el backend vuelve a
  resolver la ruta desde la posición actual.
- **Indicaciones giro a giro en español**, con voz (Web Speech API),
  distancia/tiempo restante y detección de llegada.
- El mapa usa **MapLibre GL mediante `react-map-gl`**. Prefiere el estilo
  vectorial de ArcGIS cuando hay token de basemap y puede caer al estilo de
  CARTO si ese basemap falla; no usa el SDK de mapas de ArcGIS.

### Confiabilidad GPS y cámara

- Una fijación habilita seguimiento solo si es real, tiene precisión declarada
  de **50 m o mejor**, timestamp estrictamente creciente y antigüedad de hasta
  **5 s** durante navegación live. `watchPosition` live usa alta precisión,
  `maximumAge: 1000` y `timeout: 5000`.
- La posición GPS aceptada llega sin demora artificial a progreso, llegada,
  recálculo y cámara. La interpolación queda limitada al marcador visual.
- Si se pierde señal después de una fijación confiable, se conserva esa última
  coordenada únicamente para mostrarla y se suspenden progreso, llegada, voz y
  recálculo. El centro simulado de Itagüí solo se usa antes de la primera
  fijación confiable.
- Una ruta iniciada desde origen manual o simulado es **vista previa estática**:
  se dibuja, pero no afirma seguimiento en vivo ni habilita ETA, progreso,
  llegada, voz o recálculo. Para pasar a live se inicia una nueva ruta con GPS
  confiable.
- La cámara encuadra la vista previa. En live usa *course-up* sobre la posición
  GPS aceptada; al salir vuelve a norte y sin inclinación. Los gestos pausan el
  seguimiento y exponen el control para recentrar.

Detalle completo de la implementación, parámetros del servicio, umbrales de
recálculo y guía de diagnóstico en
[`frontend/DOCUMENTACION_RUTAS.md`](frontend/DOCUMENTACION_RUTAS.md).

### Configurar la credencial de ArcGIS

En `backend/.env`, basta con **una** de las dos opciones (ver
`backend/.env.example` para el detalle):

```env
# Opción A (recomendada) — OAuth 2.0 de aplicación
ARCGIS_CLIENT_ID=...
ARCGIS_CLIENT_SECRET=...
ARCGIS_REFERER=http://localhost:3001

# Opción B — API key directa
ARCGIS_API_KEY=...
```

Sin ninguna credencial, el ruteo cae automáticamente al respaldo OSRM (válido
para desarrollo, no para producción).

---

## Tecnologías

**Frontend**: React 19, Vite, React Router, MapLibre GL + `react-map-gl`,
Recharts, React Icons. Leaflet sigue como dependencia heredada, pero el mapa
de navegación se implementa con MapLibre.

**Backend**: Node.js + Express, MySQL (`mysql2`), JWT (`jsonwebtoken`),
`bcryptjs`, `helmet`, `express-rate-limit`, `multer` (subida de imágenes),
`node-ical` (proxy de Google Calendar).

**Infraestructura**: MySQL en contenedor Docker para desarrollo/despliegue
(`docker-compose.yml`).

---

## Puesta en marcha

### 1. Base de datos (Docker)

```bash
cp .env.example .env        # ajusta las contraseñas
docker compose up -d mysql  # levanta MySQL en :3307 (ver .env.example)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env         # ajusta MySQL, JWT, ArcGIS
npm run init-db              # crea el esquema y el super-admin inicial
npm run dev                  # http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env         # VITE_API_URL, por defecto http://localhost:3001
npm run dev                  # http://localhost:5173
```

Diagnóstico rápido de qué proveedor de ruteo está activo:

```bash
curl http://localhost:3001/api/rutas/estado   # { "proveedor": "arcgis" | "osrm" }
```

---

## Funcionalidades del portal

- Catálogo de sitios turísticos con filtros por categoría y zona, y
  sugerencias por comuna simulando la ubicación del visitante.
- Ficha de sitio con galería, datos de contacto y **navegación en tiempo
  real** (sección anterior).
- Calendario de eventos municipales: manual, importación Excel y proxy de
  Google Calendar (`.ics`).
- Formulario público de PQRS e inclusión de nuevos sitios.
- Panel de administración (JWT, roles `superadmin`/`admin`): gestión de
  sitios, anuncios, eventos, PQRS, usuarios y estadísticas.

---

## Licencia

Copyright (C) 2026, Alcaldía de Itagüí, Antioquia, Colombia. Todos los
derechos reservados.

Queda estrictamente prohibida la reproducción, distribución, modificación o
comercialización total o parcial de este código fuente sin la autorización
expresa y por escrito del titular del copyright.
