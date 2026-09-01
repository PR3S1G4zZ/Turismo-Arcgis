# Phase 5: Mantener la pantalla activa - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 5-Mantener la pantalla activa
**Areas discussed:** Activación y límites del ciclo de vida, Reintento tras segundo plano y liberación del sistema, Degradación segura y aviso discreto
**Mode:** `--auto`; all gray areas selected and recommended options auto-selected.

---

## Activación y límites del ciclo de vida

| Option | Description | Selected |
|--------|-------------|----------|
| Ciclo de navegación real | Activar durante el cálculo/seguimiento real; excluir vista previa; liberar al terminar | ✓ |
| Toda interacción con el mapa | Mantener la pantalla activa durante cualquier uso del mapa | |
| Solo después de recibir la primera ruta | Retrasar la adquisición hasta que la ruta inicial exista | |

| Option | Description | Selected |
|--------|-------------|----------|
| `useWakeLock` integrado al motor de navegación | El ciclo compartido de `useNavegacion` es dueño del sentinel | ✓ |
| `RouteModal` controla el sentinel | La UI de seguimiento administra el recurso | |
| `InteractiveMap` controla el sentinel | El mapa administra el recurso | |

**Auto-selected choices:** Ciclo de navegación real; `useWakeLock` integrado al motor de navegación.
**Notes:** La decisión preserva batería en vistas previas y evita que dos consumidores administren el mismo recurso.

---

## Reintento tras segundo plano y liberación del sistema

| Option | Description | Selected |
|--------|-------------|----------|
| Reintento controlado por `visibilitychange` + `release` | Reintentar al volver a `visible`, detectar liberaciones y evitar bucles | ✓ |
| Reintento periódico | Solicitar repetidamente mientras la navegación esté activa | |
| No reintentar automáticamente | Requerir una acción manual del usuario | |

**Auto-selected choice:** Reintento controlado por `visibilitychange` + `release`.
**Notes:** La recuperación debe ser idempotente, limpiar listeners y protegerse contra promesas tardías.

---

## Degradación segura y aviso discreto

| Option | Description | Selected |
|--------|-------------|----------|
| Estado observable + aviso discreto | Continuar la navegación y comunicar la limitación en el seguimiento | ✓ |
| Degradación completamente silenciosa | Continuar sin informar al usuario | |
| Bloquear el inicio | No comenzar sin Wake Lock | |

| Option | Description | Selected |
|--------|-------------|----------|
| Continuar sin fallback visual | No usar mecanismos alternativos de reproducción | ✓ |
| Video oculto | Intentar mantener activa la pantalla mediante video | |
| Otro mecanismo de reproducción | Sustituir Wake Lock con audio/video | |

**Auto-selected choices:** Estado observable + aviso discreto; continuar sin fallback visual.
**Notes:** Ausencia de soporte, permiso denegado, rechazo y liberación irrecuperable son fallos no fatales. Se reutiliza el patrón de advertencia existente del `RouteModal`.

---

## the agent's Discretion

- Nombres concretos del hook y del estado público.
- Clasificación exacta de estados, redacción del aviso y atributos de accesibilidad.
- Mocks y casos concretos de Vitest/jsdom para sentinel, visibilidad, liberación y carreras.

## Deferred Ideas

None.
