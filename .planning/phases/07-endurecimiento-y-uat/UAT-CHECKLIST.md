# UAT físico — Fase 7 (HARDEN-02)

**Privacidad:** no anotar coordenadas, direcciones exactas, capturas de mapa con ubicación, recorridos ni tokens. Solo escenario, dispositivo, resultado (OK / FALLO / BLOQUEADO / PENDIENTE) y notas cualitativas.

**Entorno esperado:** HTTPS de staging. Android Chrome e iPhone Safari. A pie y en auto.

**Estado:** plantilla lista; **ningún escenario se marca como ejecutado en esta sesión** (el ejecutor no tuvo los dispositivos físicos en mano). Completar en campo.

Leyenda de resultado: `PENDIENTE` = no corrido; `BLOQUEADO` = no se pudo por dependencia (p. ej. Wake Lock / tráfico de Fases 5–6 aún no implementados).

## Android Chrome — a pie

| Escenario | Resultado | Notas (sin ubicación) |
|-----------|-----------|------------------------|
| Rotonda / curva cerrada | PENDIENTE | ¿La polilínea sigue la calzada? ¿La flecha no corta el interior? |
| Calles paralelas | PENDIENTE | ¿El progreso se queda en la calle correcta? |
| Ruta que se cruza a sí misma | PENDIENTE | ¿El avance no salta al tramo futuro cercano? |
| Pérdida de GPS | PENDIENTE | ¿UI de GPS obsoleto / no disponible, sin fingir seguimiento? |
| Regreso desde segundo plano | PENDIENTE | ¿La navegación retoma? Wake Lock: BLOQUEADO hasta WAKE-01 |

## Android Chrome — en auto

| Escenario | Resultado | Notas (sin ubicación) |
|-----------|-----------|------------------------|
| Rotonda / curva cerrada | PENDIENTE | |
| Calles paralelas | PENDIENTE | |
| Ruta que se cruza a sí misma | PENDIENTE | |
| Pérdida de GPS | PENDIENTE | |
| Regreso desde segundo plano | PENDIENTE | Tráfico `startTime=now`: BLOQUEADO hasta TRAFFIC-01 |

## iPhone Safari — a pie

| Escenario | Resultado | Notas (sin ubicación) |
|-----------|-----------|------------------------|
| Rotonda / curva cerrada | PENDIENTE | Permiso de brújula: ¿gesto explícito? |
| Calles paralelas | PENDIENTE | |
| Ruta que se cruza a sí misma | PENDIENTE | |
| Pérdida de GPS | PENDIENTE | |
| Regreso desde segundo plano | PENDIENTE | Wake Lock: BLOQUEADO hasta WAKE-01 |

## iPhone Safari — en auto

| Escenario | Resultado | Notas (sin ubicación) |
|-----------|-----------|------------------------|
| Rotonda / curva cerrada | PENDIENTE | |
| Calles paralelas | PENDIENTE | |
| Ruta que se cruza a sí misma | PENDIENTE | |
| Pérdida de GPS | PENDIENTE | |
| Regreso desde segundo plano | PENDIENTE | |

## Observaciones de campo (cualitativas)

- Fecha / operador: _
- Build o commit bajo prueba: _
- ¿HTTPS staging accesible?: _
- Hallazgos (sin coords): _

---
*Creado: 2026-09-01 — plantilla HARDEN-02. Sin ejecuciones físicas registradas.*
