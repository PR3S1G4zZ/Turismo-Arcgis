# Phase 5: Mantener la pantalla activa - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregar un hook o servicio aislado de Screen Wake Lock que mantenga la pantalla encendida únicamente durante una navegación real activa, libere el recurso al terminar cualquier ciclo de navegación y sobreviva correctamente a los cambios de visibilidad y a las liberaciones iniciadas por el sistema. En navegadores sin soporte, con permiso denegado o con una solicitud fallida, la navegación existente debe continuar funcionando y la interfaz puede informar la limitación de forma discreta. Esta fase no cambia el proveedor de mapas, el GPS, el ruteo ni la arquitectura de navegación, y no incorpora fallbacks basados en video oculto.

</domain>

<decisions>
## Implementation Decisions

### Activación y límites del ciclo de vida
- **D-01:** El Wake Lock se solicita para el ciclo de navegación real: durante el cálculo inicial que no sea una vista previa simulada y mientras el estado sea `navegando`; se conserva durante recálculos y se libera cuando la navegación llega, se cancela, falla o se desmonta. Las vistas previas con ubicación simulada no deben consumir batería por esta función. â€” **Reversibility:** reversible â€” el límite depende del estado ya existente de `useNavegacion` y puede ajustarse sin cambiar contratos externos.
- **D-02:** La propiedad del sentinel debe pertenecer al ciclo de navegación compartido, mediante un hook aislado integrado desde `useNavegacion`; `InteractiveMap` y `RouteModal` solo consumen el estado expuesto y no administran listeners ni solicitudes Wake Lock.

### Reintento tras segundo plano y liberación del sistema
- **D-03:** El contrato de recuperación combina `visibilitychange` y el evento `release` del sentinel: al volver a `document.visibilityState === 'visible'`, el hook reintenta si la navegación sigue activa; una liberación del sistema se registra en el estado observable, sin bucles de solicitudes periódicas o reintentos agresivos mientras la página permanece visible.
- **D-04:** El ciclo debe ser idempotente y tolerar carreras entre desmontaje, cambio de visibilidad, liberación y promesas pendientes: nunca se deben acumular sentinels ni listeners, y una respuesta tardía no debe reactivar un lock después de que la navegación haya terminado.

### Degradación segura y aviso discreto
- **D-05:** La ausencia de `navigator.wakeLock`, el rechazo de `request('screen')`, un permiso denegado y una liberación irrecuperable son condiciones no fatales: no lanzan errores visibles ni detienen GPS, progreso, recálculo, voz o mapa. El hook expone un estado estable suficiente para que el contexto de navegación lo comunique.
- **D-06:** Cuando no sea posible mantener la pantalla activa, el aviso se muestra de forma discreta dentro de la interfaz de seguimiento existente, reutilizando su patrón de estado/advertencia y solo cuando la navegación real está activa. No se bloquea el inicio ni se usa video oculto, reproducción de audio u otro truco alternativo.

### the agent's Discretion
- Los nombres concretos del hook, del objeto de estado y de las funciones internas, siempre que el nuevo archivo quede aislado en `frontend/src/hooks/` y el contrato consumido por navegación sea explícito.
- La clasificación exacta de estados (`unsupported`, `denied`, `released`, `error` o equivalente), el texto final en español y el icono/atributos de accesibilidad, siempre que distingan limitación no fatal de error de navegación.
- La estrategia de pruebas de mocks para `navigator.wakeLock`, `WakeLockSentinel`, `visibilitychange` y `release`, respetando los patrones de Vitest/jsdom del proyecto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Instrucciones y contexto del milestone
- `AGENT_INSTRUCTIONS.md` â€” alcance estricto de la Fase 5 y archivos de contexto obligatorios.
- `.planning/PROJECT.md` â€” valor central, restricciones de batería/privacidad y decisiones de arquitectura.
- `.planning/REQUIREMENTS.md` â€” requisito WAKE-01 y límites comunes del milestone.
- `.planning/ROADMAP.md` Â§Phase 5 â€” objetivo y cuatro criterios de éxito de Wake Lock.
- `.planning/phases/01-diagn-stico-e-instrumentaci-n/01-CONTEXT.md` â€” decisiones y patrones ya establecidos por la fase diagnóstica.

### Arquitectura y patrones existentes
- `.planning/codebase/STACK.md` â€” React 19, Vite, Vitest y jsdom disponibles para el hook y sus pruebas.
- `.planning/codebase/ARCHITECTURE.md` â€” responsabilidades de `NavegacionProvider`, `useNavegacion`, `RouteModal` y límites de MapLibre.
- `.planning/codebase/INTEGRATIONS.md` â€” inventario de APIs externas; no introduce una integración backend para Wake Lock.
- `frontend/src/hooks/useNavegacion.js` â€” máquina de estados real, ciclo de cancelación/llegada/error y punto de integración único.
- `frontend/src/contexto/NavegacionProvider.jsx` â€” proveedor global que mantiene una sola navegación viva.
- `frontend/src/contexto/NavegacionContext.js` â€” contrato del contexto consumido por componentes.
- `frontend/src/App.jsx` â€” composición del provider y persistencia global de `RouteModal`/`InteractiveMap`.
- `frontend/src/componentes/detalle/RouteModal.jsx` â€” interfaz actual para estados de seguimiento y mensajes no intrusivos.
- `frontend/src/componentes/detalle/RouteModal.css` â€” clases visuales existentes `route-gps-status--warn`/`--wait` para el aviso discreto.
- `frontend/src/hooks/useNavegacion.test.js` â€” patrón Vitest/Testing Library para probar el hook sin GPS real.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useNavegacion` ya concentra el estado `inactivo | calculando | previsualizando | navegando | llegado | error`, las acciones `iniciar`/`detener` y el cleanup de voz; es el dueño natural del ciclo que debe activar y liberar Wake Lock.
- `NavegacionProvider` monta una única instancia de `useNavegacion` por aplicación, evitando que mapa y modal compitan por el sentinel.
- `RouteModal` ya presenta estados de GPS, recálculo, llegada y error mediante `route-gps-status` y `maniobra-card`; puede alojar el aviso sin crear un sistema global nuevo.
- Vitest con `jsdom` y Testing Library ya está configurado para simular APIs del navegador en pruebas de hooks y componentes.

### Established Patterns
- Los hooks usan `useRef` para recursos imperativos y callbacks estables, y limpian listeners/timers en efectos; Wake Lock debe seguir ese patrón.
- La navegación trata voz y GPS como extras degradables: captura fallos del navegador y mantiene el flujo principal; Wake Lock debe adoptar la misma política no fatal.
- La aplicación separa lógica de navegación de representación: `InteractiveMap` y `RouteModal` consumen el contexto, mientras `useNavegacion` mantiene el estado y los efectos del dominio.
- La alta precisión GPS solo se usa durante `calculando`/`navegando` por impacto en batería; la política de Wake Lock debe evitar mantener la pantalla durante `previsualizando`.

### Integration Points
- `useNavegacion` â†’ nuevo `useWakeLock`: activar con el ciclo real, conservar durante recálculo y liberar por transición de estado o desmontaje.
- `useNavegacion` â†’ `NavegacionContext` â†’ `RouteModal`: exponer el estado no fatal necesario para el aviso discreto.
- `RouteModal.css`: reutilizar o ampliar mínimamente el patrón de advertencia, sin introducir una pantalla de bloqueo ni un modal adicional.

</code_context>

<specifics>
## Specific Ideas

- La llamada de plataforma obligatoria es `navigator.wakeLock.request("screen")`.
- El retorno desde segundo plano debe basarse en `document.visibilityState === "visible"` y la implementación debe detectar el evento `release` iniciado por el sistema.
- El milestone prohíbe registrar coordenadas personales y el alcance de esta fase prohíbe explícitamente trucos de video oculto sin aprobación.

</specifics>

<deferred>
## Deferred Ideas

None â€” discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Mantener la pantalla activa*
*Context gathered: 2026-09-01*
