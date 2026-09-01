# Requirements: Turismo Itagüí — Navegación Móvil ArcGIS

**Defined:** 2026-09-01
**Core Value:** Que la navegación en tiempo real sea confiable y responsiva — la flecha, la cámara y el progreso deben reflejar la posición y el rumbo reales del visitante sin retraso perceptible ni orientaciones incorrectas, manteniendo la geometría de ArcGIS como fuente de verdad.

## v1 Requirements

### Diagnóstico (DIAG)

- [ ] **DIAG-01**: Medir por separado, solo en desarrollo y sin coordenadas, las 6 latencias internas (GPS→marcador, orientación→flecha, GPS→cámara, desvío→solicitud, solicitud→respuesta ArcGIS, respuesta→ruta renderizada) en al menos un Android real, y en iPhone si hay dispositivo disponible
- [ ] **DIAG-02**: Auditar qué de los síntomas reportados ya quedó resuelto por el ciclo previo ya mergeado (`codex/map-navigation-reliability`, PR #5) antes de instrumentar o re-diagnosticar desde cero

### Flecha, Rumbo y Cámara (NAV)

- [ ] **NAV-01**: Modelo explícito con estados independientes — posición GPS, rumbo de movimiento, rumbo de brújula, rotación de la flecha, bearing del mapa, seguimiento de cámara activo/pausado
- [ ] **NAV-02**: La flecha se orienta correctamente aunque la cámara esté pausada por un gesto del usuario o no se haya pulsado "Centrar en mí"
- [ ] **NAV-03**: Salto circular 359°→0° sin oscilaciones visibles al cruzar norte; sin listeners duplicados ni fugas al montar/desmontar
- [ ] **NAV-04**: Latencia interna rumbo válido→renderizado de flecha p95 < 250 ms; posición aceptada→actualización de cámara p95 < 500 ms

### Desvíos y Recálculo (RECALC)

- [ ] **RECALC-01**: Detección de desvío basada en distancia a la ruta, precisión GPS, velocidad, persistencia temporal, dirección de desplazamiento e histéresis
- [ ] **RECALC-02**: Un salto GPS aislado no dispara recálculo; un desvío confirmado no espera un retardo artificial adicional; se cancelan/ignoran respuestas de recálculo obsoletas; se mantienen límites de coste y protección contra bucles

### Fidelidad de Curvas y Rotondas (GEOM)

- [ ] **GEOM-01**: Captura de una ruta problemática real (rotonda/curva de Itagüí) y comparación de las 5 etapas del pipeline (ArcGIS crudo, OSRM crudo si intervino, normalizado backend, GeoJSON a MapLibre, resultado visual) antes de tocar el renderizado
- [ ] **GEOM-02**: Las rotondas/curvas conservan la geometría real de la calzada — sin cortar esquinas, separadores ni edificios; el map matching sigue usando la geometría original como fuente de verdad

### Pantalla Activa (WAKE)

- [ ] **WAKE-01**: Screen Wake Lock durante navegación activa — adquisición al iniciar, liberación al llegar/cancelar/error/desmontar, reintento al volver de segundo plano (`visibilityState`), degradación segura sin soporte del navegador

### Tráfico ArcGIS (TRAFFIC)

- [ ] **TRAFFIC-01**: Investigar e incorporar, si es viable con evidencia, rutas sensibles al tráfico (`TravelTime`, `startTime=now`) solo para modo automóvil, con degradación clara sin cobertura/permiso
- [ ] **TRAFFIC-02**: Investigar la capa visual de tráfico de ArcGIS (Traffic Map Service) detrás de feature flag — cobertura en Itagüí/Colombia, autenticación, costo, compatibilidad con MapLibre; si exige migrar al ArcGIS Maps SDK, requiere ADR + aprobación humana antes de implementar

### Endurecimiento y UAT (HARDEN)

- [ ] **HARDEN-01**: Suite de pruebas de rumbo, suavizado circular, histéresis, geometría, ciclo de vida de Wake Lock y contrato backend `startTime=now`; build, lint y suite completa en verde
- [ ] **HARDEN-02**: UAT físico registrado en Android Chrome y iPhone Safari (a pie y en auto: rotonda, calles paralelas, ruta que se cruza, pérdida de GPS, regreso desde segundo plano), sin guardar coordenadas de las pruebas

## v2 Requirements

Diferido a futuro. No mapeado al roadmap actual.

### Extensiones de Tráfico

- **TRAFFIC-03**: Tráfico en vivo para modo peatonal, si ArcGIS lo soporta y hay evidencia de valor
- **TRAFFIC-04**: Restricciones específicas por vehículo (altura, peso, materiales peligrosos) vía `travelMode` — el mecanismo ya existe en el backend, sin uso actual

## Out of Scope

| Feature | Reason |
|---------|--------|
| Migración completa al ArcGIS Maps SDK for JavaScript | Requiere ADR, comparación técnica y aprobación humana explícita — no se asume en este milestone |
| Reemplazo de MapLibre GL por otra librería de mapas | Descartado salvo decisión arquitectónica separada y aprobada |
| Reducir umbrales de recálculo (3 lecturas / 15 s) sin análisis previo | El plan exige medir la causa raíz antes de tocar constantes de diseño intencional |
| Suavizado de geometría que corte esquinas, separadores, edificios o rotondas | La geometría cruda de ArcGIS sigue siendo la fuente de verdad para map matching y progreso |
| Registro de coordenadas personales, recorridos completos o tokens | Requisito de privacidad explícito en todo el milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIAG-01 | Phase 0 | Pending |
| DIAG-02 | Phase 0 | Pending |
| NAV-01 | Phase 1 | Pending |
| NAV-02 | Phase 1 | Pending |
| NAV-03 | Phase 1 | Pending |
| NAV-04 | Phase 1 | Pending |
| RECALC-01 | Phase 2 | Pending |
| RECALC-02 | Phase 2 | Pending |
| GEOM-01 | Phase 3 | Pending |
| GEOM-02 | Phase 3 | Pending |
| WAKE-01 | Phase 4 | Pending |
| TRAFFIC-01 | Phase 5 | Pending |
| TRAFFIC-02 | Phase 5 | Pending |
| HARDEN-01 | Phase 6 | Pending |
| HARDEN-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-09-01 after initial definition*
