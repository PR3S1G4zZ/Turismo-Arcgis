<user_constraints>

- Esta sesión está limitada a la investigación y planificación de la Fase 5; no se deben ejecutar pruebas, builds, ejecución de fase, revisión de código ni cambios de producción. La única salida permitida es el artefacto de planificación de esta fase. [VERIFIED: AGENT_INSTRUCTIONS.md:3] [VERIFIED: AGENT_INSTRUCTIONS.md:6]
- La documentación debe quedar en español y el alcance funcional es únicamente WAKE-01: Screen Wake Lock para navegación real, liberación completa del ciclo, recuperación tras visibilidad y degradación segura. [VERIFIED: AGENT_INSTRUCTIONS.md:10] [VERIFIED: AGENT_INSTRUCTIONS.md:11]
- Son vinculantes las decisiones de no usar Wake Lock para vistas previas simuladas, centralizar el sentinel en un hook integrado desde `useNavegacion`, no crear reintentos periódicos y tolerar carreras de promesas, eventos y desmontaje. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:17] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:18] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:21] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:22]
- La falta de soporte, el rechazo, el permiso denegado y la liberación irrecuperable son condiciones no fatales; no deben interrumpir GPS, progreso, recálculo, voz o mapa. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:25]
- El aviso debe ser discreto, solo durante navegación real y dentro del seguimiento existente; no se permiten video oculto, audio artificial ni otro fallback multimedia. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:26] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:81]
- No se deben añadir ubicaciones de personas, recorridos reales ni credenciales a código, documentación o pruebas. [VERIFIED: AGENT_INSTRUCTIONS.md:15] [VERIFIED: .planning/PROJECT.md:73]

</user_constraints>

<phase_requirements>

- **WAKE-01:** adquirir Screen Wake Lock al iniciar una navegación real; liberar al llegar, cancelar, fallar o desmontar; reintentar cuando `document.visibilityState` vuelva a `visible`; degradar con seguridad cuando no haya soporte. [VERIFIED: .planning/REQUIREMENTS.md:32]
- Los criterios de aceptación añaden detección de liberaciones iniciadas por el sistema y un aviso discreto si la pantalla no puede mantenerse activa. [VERIFIED: .planning/ROADMAP.md:100] [VERIFIED: .planning/ROADMAP.md:103]
- La fase no debe cambiar proveedor de mapas, GPS, ruteo ni arquitectura base de navegación. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:7]

</phase_requirements>

## Summary

**Recomendación primaria:** implementar un `useWakeLock` aislado en `frontend/src/hooks/`, invocado una sola vez por `useNavegacion`, con un predicado de demanda real, una referencia al sentinel vigente, una guardia de solicitud pendiente y un identificador de generación para invalidar promesas tardías. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:18] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]

La demanda debe ser verdadera durante el cálculo inicial no simulado (`calculando`) y durante `navegando`; debe mantenerse verdadera durante un recálculo que conserve `navegando`, y volverse falsa en `previsualizando`, `llegado`, `error`, `inactivo` o desmontaje. [ASSUMED] [VERIFIED: frontend/src/hooks/useNavegacion.js:42] [VERIFIED: frontend/src/hooks/useNavegacion.js:46] [VERIFIED: frontend/src/hooks/useNavegacion.js:110] [VERIFIED: frontend/src/hooks/useNavegacion.js:132] [VERIFIED: frontend/src/hooks/useNavegacion.js:138] [VERIFIED: frontend/src/hooks/useNavegacion.js:172]

La API debe invocarse solo después de detectar `navigator.wakeLock`, solo si el documento es visible, y siempre con `request("screen")`; la promesa debe atraparse como una capacidad opcional, no como un error de navegación. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request]

La recuperación debe ser dirigida por eventos: el sentinel expone `release` para observar liberaciones automáticas o manuales, y `visibilitychange` a `visible` habilita una nueva solicitud si la demanda sigue activa. No se recomienda reintentar en bucle mientras la página permanece visible. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:21]

El estado del hook debe viajar por el objeto ya expuesto por `NavegacionProvider` hacia `NavegacionContext`; `RouteModal` solo renderiza el aviso y `InteractiveMap` no administra listeners ni sentinels. [ASSUMED] [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:8] [VERIFIED: frontend/src/contexto/NavegacionContext.js:4] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:18]

## Architectural Responsibility Map

| Responsabilidad | Dueño recomendado | Evidencia y límite |
|---|---|---|
| Determinar la demanda de Wake Lock | `useNavegacion` | El hook ya concentra los estados de navegación, sus transiciones y las acciones `iniciar`/`detener`. [VERIFIED: frontend/src/hooks/useNavegacion.js:42] [VERIFIED: frontend/src/hooks/useNavegacion.js:147] [VERIFIED: frontend/src/hooks/useNavegacion.js:172] |
| Administrar sentinel, listeners y promesas | `useWakeLock` aislado | La propiedad del sentinel está fijada al ciclo compartido; mapa y modal no deben solicitar ni liberar la API. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:18] |
| Exponer el contrato | retorno de `useNavegacion` mediante `NavegacionProvider`/`NavegacionContext` | El provider monta una instancia única del hook y entrega su objeto completo al contexto. [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:8] [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:10] [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:12] |
| Renderizar limitación no fatal | `RouteModal` | El modal ya consume el contexto, tiene una superficie de tracking y usa estados `route-gps-status`. [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:45] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:414] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:472] |
| Renderizar mapa/GPS/progreso | `InteractiveMap` y `RouteModal`, como consumidores | La arquitectura asigna el motor GPS y recálculo a `useNavegacion`, y mapa/panel a presentación; Wake Lock no debe introducir una segunda fuente de navegación. [VERIFIED: .planning/codebase/ARCHITECTURE.md:62] [VERIFIED: .planning/codebase/ARCHITECTURE.md:63] [VERIFIED: .planning/codebase/ARCHITECTURE.md:70] |
| Backend, mapa y geolocalización | fuera de alcance | El límite de fase prohíbe cambios de proveedor, GPS, ruteo y mapa. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:7] |

Puntos exactos de integración:

- `useNavegacion`: importar el hook nuevo, calcular una demanda derivada de `estado` y devolver el estado estable de Wake Lock junto con el resto del contrato. El cálculo real entra en `calculando` y termina en `navegando` o `error`; una vista previa entra directamente en `previsualizando`. [VERIFIED: frontend/src/hooks/useNavegacion.js:110] [VERIFIED: frontend/src/hooks/useNavegacion.js:116] [VERIFIED: frontend/src/hooks/useNavegacion.js:132] [VERIFIED: frontend/src/hooks/useNavegacion.js:138]
- `NavegacionProvider`/`NavegacionContext`: no necesitan un bus o store nuevo; el provider ya entrega la instancia única y el contexto actualmente es un contrato React mínimo. [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:8] [VERIFIED: frontend/src/contexto/NavegacionContext.js:4]
- `RouteModal`: ampliar la desestructuración del contexto y mostrar el mensaje solo en su paso `tracking` cuando la demanda real esté activa y el hook indique limitación. El `step` no debe ser la fuente de activación porque es estado local y se cambia antes de llamar a `iniciar`. [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:74] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:126] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:127] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:131]
- `RouteModal.css`: reutilizar `route-gps-status route-gps-status--warn`; ya existen layout, color de advertencia, separación, ajuste de icono y botón compacto. La UI-SPEC reserva el color de marca para progreso y exige que el aviso no afirme que el lock está activo. [VERIFIED: frontend/src/componentes/detalle/RouteModal.css:843] [VERIFIED: frontend/src/componentes/detalle/RouteModal.css:864] [VERIFIED: frontend/src/componentes/detalle/RouteModal.css:874] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:64] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:81]

## Standard Stack

- **React hooks:** el proyecto usa React 19.2.6 y ya implementa hooks con `useState`, `useEffect`, `useRef` y `useCallback`; no se requiere una dependencia de estado adicional. [VERIFIED: frontend/package.json:16] [VERIFIED: frontend/src/hooks/useNavegacion.js:12]
- **API nativa:** `navigator.wakeLock.request("screen")` devuelve una promesa con `WakeLockSentinel`; `release`, `released` y el evento `release` son la superficie necesaria. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event]
- **Pruebas:** Vitest 4.1.11, `@testing-library/react` 16.3.2 y jsdom 29.1.1 ya están declarados; no se debe inventar ni agregar un paquete para simular Wake Lock. [VERIFIED: frontend/package.json:26] [VERIFIED: frontend/package.json:34] [VERIFIED: frontend/package.json:36]
- **Entorno de pruebas:** Vitest ya ejecuta en `jsdom` y carga `src/test/setup.js`. [VERIFIED: frontend/vitest.config.js:7]
- **Estilo:** componentes React y CSS existente; `react-icons/ri` ya contiene `RiErrorWarningLine` para el aviso. [VERIFIED: frontend/package.json:18] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:11] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:24]

No hay motivo arquitectónico para un servicio backend: Wake Lock pertenece al documento del navegador y la API expone su entrada en `navigator`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [ASSUMED]

## Architecture Patterns

1. **Adaptador de capacidad opcional.** `useWakeLock` debe ocultar detección, solicitud, liberación y eventos detrás de un contrato pequeño; la navegación no debe conocer excepciones de plataforma. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request]
2. **Una demanda, un sentinel vigente.** Mantener el sentinel en `useRef`; antes de pedir, comprobar que no exista un sentinel no liberado y que no haya una solicitud pendiente. Un sentinel liberado no se puede reutilizar. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]
3. **Recuperación por eventos.** Registrar un solo listener de `document.visibilitychange` durante la vida del hook y un listener de `release` por sentinel; al quedar visible, pedir solo si sigue habiendo demanda y no hay un lock vigente. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event]
4. **Guardia contra asíncrono obsoleto.** Incrementar una generación al desactivar o desmontar y asociarla a cada solicitud; una resolución de otra generación debe liberar el sentinel recibido sin incorporarlo al estado. Esto impide reactivar el lock después de cancelar o terminar la navegación. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:22]
5. **Estado observable, no error de dominio.** Exponer un estado estable separado del `error` de ruta, con una señal booleana para el aviso; rechazo o liberación no deben llevar `estado` de navegación a `error`. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:25] [VERIFIED: frontend/src/hooks/useNavegacion.js:67]
6. **Contrato de demanda derivado de la máquina existente.** No activar por `activa`, porque `activa` incluye vista previa y llegada; usar únicamente la combinación real `calculando`/`navegando`. [ASSUMED] [VERIFIED: frontend/src/hooks/useNavegacion.js:294] [VERIFIED: frontend/src/hooks/useNavegacion.js:295] [VERIFIED: frontend/src/hooks/useNavegacion.js:296] [VERIFIED: frontend/src/hooks/useNavegacion.js:297]

### Transiciones recomendadas

| Evento | Acción del hook | Estado UI recomendado |
|---|---|---|
| Demanda pasa a activa y documento visible | Solicitud única; al resolver, registrar el sentinel y su `release`. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] | `solicitando` → `activo`. [ASSUMED] |
| Documento oculto | No solicitar; conservar la demanda lógica y esperar la recuperación de visibilidad, porque el agente de usuario libera locks al perder visibilidad. [ASSUMED] [CITED: https://w3c.github.io/screen-wake-lock/] | Sin aviso de navegación por este hecho aislado. [ASSUMED] |
| Documento vuelve a `visible` | Examinar `sentinel.released` y pedir un sentinel nuevo si la demanda sigue activa. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] | `activo` o `solicitando`; si falla, limitación no fatal. [ASSUMED] |
| Evento `release` mientras la demanda sigue activa | Marcar `liberado`/limitado, limpiar solo si el evento pertenece al sentinel vigente y no solicitar de inmediato. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event] | Mostrar el aviso discreto. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:96] |
| Demanda pasa a inactiva | Invalidar generación, desenganchar listener, limpiar referencias y llamar `release()` si el sentinel aún está utilizable; capturar el rechazo de cleanup. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] | `inactivo`; ocultar el aviso. [ASSUMED] |
| Solicitud rechazada | Capturar `NotAllowedError` u otra excepción y conservar navegación, GPS y mapa. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] | `noDisponible`/`denegado` y aviso, sin error de ruta. [ASSUMED] |

El error de un recálculo merece especial cuidado: `calcular` deja el estado en `navegando` cuando `esRecalculo` es verdadero, mientras que el error inicial sí lleva el estado a `error`. Por tanto, el lock debe conservarse durante un recálculo que no termine la sesión, y liberarse cuando la máquina realmente salga a `error`, `llegado`, `inactivo` o desmontaje. [VERIFIED: frontend/src/hooks/useNavegacion.js:115] [VERIFIED: frontend/src/hooks/useNavegacion.js:132] [VERIFIED: frontend/src/hooks/useNavegacion.js:138] [ASSUMED]

## Antipatrones

- Solicitar Wake Lock durante el render, durante cada lectura GPS o desde `RouteModal`; eso puede duplicar solicitudes y romper la propiedad única del recurso. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:18]
- Activar con `activa` o con `step === "tracking"`; ambos pueden representar una vista previa y el paso del modal se cambia antes de que el motor conozca el resultado. [ASSUMED] [VERIFIED: frontend/src/hooks/useNavegacion.js:294] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:74] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:126]
- Reutilizar un sentinel cuyo `released` es verdadero; la API exige solicitar uno nuevo. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]
- Reintentar con `setInterval`, backoff permanente o una cadena automática después de cada rechazo mientras el documento sigue visible; la decisión de fase exige recuperación por visibilidad sin bucle agresivo. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:21] [ASSUMED]
- Reintentar inmediatamente desde el callback `release`; eso puede producir una cascada de solicitudes cuando la liberación fue provocada por batería, ahorro de energía o política del dispositivo. [CITED: https://w3c.github.io/screen-wake-lock/] [ASSUMED]
- Considerar `NotAllowedError` un fallo de navegación o mostrar el texto como si la pantalla estuviera protegida; la solicitud también falla por visibilidad, actividad, Permissions Policy o capacidad del dispositivo. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:81]
- Detectar la API en una constante de módulo que se evalúe antes de instalar el mock; esto dificulta jsdom, SSR y tests que alternan soporte. La detección debe ocurrir dentro del ciclo del hook o detrás de una dependencia inyectable. [ASSUMED]
- Usar video oculto, audio o reproducción artificial como fallback. Ese camino está explícitamente fuera de alcance. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:26]

## Inventario de estado de ejecución

| Elemento | Tipo/semántica | Regla prescriptiva |
|---|---|---|
| `demandaReal` | booleano derivado de `estado === "calculando" || estado === "navegando"` | Excluye `previsualizando` y `llegado`; el estado existente de navegación ya distingue esos casos. [ASSUMED] [VERIFIED: frontend/src/hooks/useNavegacion.js:42] [VERIFIED: frontend/src/hooks/useNavegacion.js:294] [VERIFIED: frontend/src/hooks/useNavegacion.js:296] [VERIFIED: frontend/src/hooks/useNavegacion.js:297] |
| `sentinelRef` | referencia imperativa al único sentinel adoptado | Guardar solo el sentinel de la generación actual; un sentinel liberado se descarta. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]
| `solicitudPendienteRef` | booleano o promesa de la solicitud actual | Bloquea solicitudes concurrentes de renders o eventos de visibilidad. [ASSUMED]
| `generacionRef` | contador de ciclo | Cambiarlo al desactivar, desmontar y, si el diseño reinicia sesión, al iniciar una nueva demanda; la resolución tardía no debe mutar estado. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:22]
| `estadoWake` | `inactivo`, `solicitando`, `activo`, `noSoportado`, `noDisponible`, `liberado` o equivalente | Debe ser estable, no confundir limitación del dispositivo con error de ruta y permitir que la UI decida si avisa. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:25]
| `requiereAviso` | booleano derivado | Verdadero solo para navegación real activa con soporte ausente, solicitud rechazada o sentinel liberado; falso en preview y al terminar. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:26]
| listener de visibilidad | un listener de `document` por instancia del hook | Registrar en un efecto y retirar en cleanup; comprobar `document.visibilityState` porque el evento no lleva el nuevo estado. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event]
| listener de sentinel | un callback asociado al sentinel adoptado | Ignorar callbacks de sentinels antiguos mediante identidad o generación. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event]

La implementación puede nombrar los estados de otra forma; lo importante es distinguir ausencia de capacidad, solicitud rechazada y liberación posterior, y mantener el contrato no fatal aprobado. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:29] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:25]

## Errores frecuentes y mitigaciones

- **Promesa resuelta después de cancelar:** invalidar generación antes de limpiar; al resolver, liberar el sentinel recibido y no marcar `activo`. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:22]
- **Dos `visibilitychange` mientras una solicitud está pendiente:** mantener guardia de solicitud; ambas notificaciones deben converger en una sola llamada a `request`. [ASSUMED]
- **`release` de un sentinel viejo:** comparar identidad antes de limpiar el sentinel actual o cambiar el estado; un callback viejo no puede borrar un lock nuevo. [ASSUMED]
- **Ocultamiento automático:** la solicitud puede rechazarse si el documento está oculto y un lock existente puede liberarse al perder visibilidad; pedir solo tras una transición observada a `visible`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [CITED: https://w3c.github.io/screen-wake-lock/]
- **Batería baja o ahorro de energía:** el agente de usuario puede liberar el lock; mostrar una limitación no fatal y no prometer protección absoluta. [CITED: https://w3c.github.io/screen-wake-lock/] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:81]
- **Permisos/política:** `NotAllowedError` no identifica por sí solo una única causa; una consulta opcional a `navigator.permissions` puede enriquecer el diagnóstico solo si existe, pero la navegación debe funcionar sin ella. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API] [ASSUMED]
- **Desmontaje redundante:** `RouteModal` ya llama `detener()` en cleanup y en cierre definitivo; el hook también debe limpiar su recurso, pero las dos rutas deben ser idempotentes. [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:113] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:144] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:147] [ASSUMED]
- **Aviso demasiado fuerte:** utilizar `aria-live="polite"`, el icono existente y el texto aprobado; no usar confirmación, overlay ni CTA que bloquee el recorrido. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:78] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:81] [ASSUMED]

## Pseudocódigo útil

El siguiente contrato es guía de planificación, no código de producción; concentra las condiciones que el plan de implementación debe convertir en efectos y refs de React. [ASSUMED]

```text
demandaReal = estado es "calculando" o "navegando"

si no demandaReal:
    invalidar generación
    quitar listeners
    liberar sentinel vigente de forma tolerante a promesas
    estadoWake = "inactivo"

si demandaReal y documento visible:
    si API ausente: estadoWake = "noSoportado"
    si no hay solicitud pendiente y no hay sentinel vigente no liberado:
        capturar generación
        solicitar navigator.wakeLock.request("screen")
        si la generación sigue vigente, la demanda sigue activa y el sentinel no está liberado:
            guardar sentinel y escuchar "release"
        si no:
            liberar el sentinel tardío

al ocurrir "release" del sentinel vigente:
    descartar referencia
    estadoWake = "liberado"
    mostrar aviso si demandaReal
    no solicitar otra vez hasta visibilitychange a "visible"

al ocurrir visibilitychange:
    si document.visibilityState es "visible" y demandaReal:
        ejecutar la misma ruta de solicitud con guardia de concurrencia
```

El contrato de plataforma que justifica este flujo es que `request()` es basado en promesa, solo documentos visibles pueden adquirir el lock, `release` informa la liberación y `released` queda permanentemente verdadero una vez liberado. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]

## State-of-the-art

- MDN marca Screen Wake Lock como Baseline 2025 y advierte que puede no funcionar en dispositivos o navegadores antiguos; por ello la detección de capacidad y la prueba física siguen siendo obligatorias aunque los navegadores actuales lo soporten. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]
- La API es deliberadamente asesorativa: la especificación permite que el agente de usuario ignore o libere el lock por batería baja, ahorro de energía u otras condiciones del sistema. [CITED: https://w3c.github.io/screen-wake-lock/]
- La especificación W3C consultada es un Editor's Draft y declara que puede cambiar de forma incompatible; el plan debe limitarse a la superficie pública documentada por MDN y cubrirla con mocks realistas, sin implementar detalles internos del agente de usuario. [CITED: https://w3c.github.io/screen-wake-lock/]
- El patrón actual recomendado por la documentación oficial combina feature detection, solicitud asíncrona, referencia al sentinel, evento `release`, liberación explícita y re-adquisición ante `visibilitychange`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]
- No hay soporte para afirmar una garantía absoluta de pantalla encendida: incluso una solicitud resuelta puede ser revocada por la plataforma y debe comunicarse como capacidad disponible, no como promesa permanente. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released] [CITED: https://w3c.github.io/screen-wake-lock/]

## Supuestos y preguntas abiertas

### Supuestos de planificación

- Se asume que el documento principal se sirve por HTTPS en staging/producción; la geolocalización ya exige HTTPS o `localhost` y el Wake Lock también es de contexto seguro. [VERIFIED: .planning/PROJECT.md:73] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request]
- Se asume una única instancia viva de `NavegacionProvider`; el provider actual crea una sola instancia de `useNavegacion` para sus hijos. [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:8] [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:10]
- Se asume que un rechazo de recálculo que mantiene `estado === "navegando"` no termina la navegación; el lock debe seguir la máquina existente y no inventar una nueva transición. [VERIFIED: frontend/src/hooks/useNavegacion.js:138] [ASSUMED]
- Se asume que el aviso aprobado puede aparecer durante `calculando` real aunque todavía no haya ruta renderizada, porque la decisión vinculante considera activo el cálculo inicial no simulado. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:17] [ASSUMED]

### Preguntas que el plan debe cerrar sin ampliar alcance

- ¿El contrato público debe exponer un objeto (`wakeLock.estado`, `wakeLock.requiereAviso`) o campos planos? La decisión no cambia la propiedad del sentinel; se recomienda objeto para aislar futuras extensiones. [ASSUMED]
- ¿Se distinguirá `denegado` mediante `navigator.permissions.query({ name: "screen-wake-lock" })` cuando esté disponible, o se usará `noDisponible` para todo rechazo? Se recomienda no depender de Permissions API porque su disponibilidad puede variar; el texto de UI es común y no requiere una causa exacta. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API] [ASSUMED]
- ¿El aviso debe aparecer durante `calculando` real o solamente cuando ya está `navegando`? El contexto fija adquisición durante ambos; la resolución final debe conservar esa misma política para no dejar una ventana sin feedback. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:17] [ASSUMED]
- ¿Se requiere un control explícito para ocultar el aviso? La UI-SPEC no lo exige y el aviso es informativo; no añadir una acción hasta que exista una necesidad validada. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:81] [ASSUMED]

## Disponibilidad del entorno

- El frontend tiene scripts de test, build y lint en `package.json`, pero esta investigación no debe ejecutarlos por la restricción de la sesión. [VERIFIED: frontend/package.json:8] [VERIFIED: AGENT_INSTRUCTIONS.md:6]
- Vitest usa `jsdom`, y el setup ya define mocks generales de `matchMedia`, `ResizeObserver` y animación; el Wake Lock debe mockearse localmente por suite para no contaminar otros tests. [VERIFIED: frontend/vitest.config.js:7] [VERIFIED: frontend/src/test/setup.js:1] [VERIFIED: frontend/src/test/setup.js:12] [ASSUMED]
- Los tests de hooks existentes usan `renderHook`, `act`, `waitFor`, `vi.fn`, `Object.defineProperty` y restauración de timers; esos patrones son suficientes para simular `navigator.wakeLock` y `document.visibilityState`. [VERIFIED: frontend/src/hooks/useNavegacion.test.js:1] [VERIFIED: frontend/src/hooks/useGeolocation.test.js:1] [VERIFIED: frontend/src/hooks/useGeolocation.test.js:21] [VERIFIED: frontend/src/hooks/useGeolocation.test.js:111] [ASSUMED]
- El paquete no declara una librería Wake Lock ni un polyfill; la implementación debe usar la API nativa y feature detection. [VERIFIED: frontend/package.json:12] [VERIFIED: frontend/package.json:22] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]
- El entorno de aceptación del milestone contempla Android Chrome y, si está disponible, iPhone Safari por HTTPS; la compatibilidad final de cada dispositivo debe medirse en UAT y no inferirse solo desde jsdom. [VERIFIED: .planning/PROJECT.md:14] [VERIFIED: .planning/PROJECT.md:73] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]

### Estrategia de mocks Vitest/jsdom

- Definir un factory local de sentinel con `released`, `release`, `addEventListener` y `removeEventListener`; el helper de prueba debe cambiar `released` a verdadero y despachar un `Event("release")` para modelar liberación automática. [ASSUMED] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]
- Instalar `navigator.wakeLock` con `Object.defineProperty(..., { configurable: true })` antes de renderizar el hook y restaurarlo en `afterEach`; el test de ausencia debe quitarlo temporalmente. Este patrón coincide con el mock configurable de geolocation ya existente. [VERIFIED: frontend/src/hooks/useGeolocation.test.js:21] [ASSUMED]
- Sobrescribir `document.visibilityState` con getter configurable durante la prueba, cambiarlo entre `hidden` y `visible`, y despachar `visibilitychange`; el evento no debe depender de una propiedad `visible` inexistente. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event] [ASSUMED]
- Para carreras, usar una promesa diferida controlada por el test: desactivar o desmontar antes de resolver, resolver luego con un sentinel y verificar que no queda activo y que el sentinel tardío se libera. [ASSUMED]
- Verificar llamadas y cleanup con `expect(request).toHaveBeenCalledWith("screen")`, conteo de `addEventListener`/`removeEventListener` y `release`; usar `waitFor`/`act` para cruzar microtareas de las promesas. [VERIFIED: frontend/src/hooks/useNavegacion.test.js:1] [ASSUMED]

## Validation Architecture

La matriz siguiente mapea WAKE-01 a pruebas automáticas nuevas o ampliadas; no se ejecutaron durante esta fase de investigación. [VERIFIED: .planning/REQUIREMENTS.md:32] [VERIFIED: AGENT_INSTRUCTIONS.md:6]

| Cobertura WAKE-01 | Prueba propuesta | Evidencia de aprobación |
|---|---|---|
| Adquisición al cálculo inicial real | `useWakeLock.test.js`: demanda verdadera, documento visible, `request("screen")` resuelve un sentinel. | Una llamada con el tipo `screen`, estado `activo`, listener de `release` instalado. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] |
| Sin consumo en preview | `useNavegacion.test.js` o prueba de integración del hook: origen manual/ubicación simulada lleva a `previsualizando` sin activar demanda. | Cero llamadas a `request`; la ruta preview conserva su estado. [VERIFIED: frontend/src/hooks/useNavegacion.test.js:52] [VERIFIED: frontend/src/hooks/useNavegacion.js:116] |
| Persistencia durante recálculo | Prueba de hook: rerender con demanda aún verdadera o integración de recálculo que conserve `navegando`. | El mismo sentinel no se libera y no aparece una segunda solicitud mientras la demanda no cambie. [VERIFIED: frontend/src/hooks/useNavegacion.js:138] [ASSUMED] |
| Liberación al llegar | Prueba de integración de `useNavegacion` con transición a `llegado`, usando entradas sintéticas no personales. | `release()` se solicita una vez y el aviso se oculta; el estado de navegación sigue siendo el dueño de la transición. [VERIFIED: frontend/src/hooks/useNavegacion.js:213] [ASSUMED] |
| Liberación al cancelar | `useWakeLock.test.js`: rerender de demanda verdadera a falsa, equivalente a `detener()`. | `release()` llamado, no queda listener ni sentinel adoptado. [VERIFIED: frontend/src/hooks/useNavegacion.js:172] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] |
| Liberación al error | Integración con resolver rechazado durante el cálculo inicial. | El estado de navegación llega a `error`, la solicitud se libera/no se conserva y la excepción no se filtra a UI como Wake Lock. [VERIFIED: frontend/src/hooks/useNavegacion.js:138] [ASSUMED] |
| Liberación al desmontar | `unmount()` del `renderHook` con sentinel activo y con solicitud pendiente. | Se libera el sentinel activo; una promesa posterior no reactiva el lock y libera su sentinel tardío. [ASSUMED] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:22] |
| Recuperación desde segundo plano | Cambiar visibilidad a `hidden`, modelar `released`, luego a `visible` y despachar `visibilitychange`. | Se pide un sentinel nuevo solo una vez al volver visible. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] |
| Liberación iniciada por sistema | Disparar `release` en el sentinel vigente mientras la demanda es verdadera. | Estado `liberado`/limitado, aviso visible y ninguna segunda solicitud inmediata. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:21] |
| Reintento posterior al release | Después del caso anterior, despachar un nuevo ciclo `hidden` → `visible`. | Una solicitud nueva ocurre por la visibilidad; no hay polling. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:21] [ASSUMED] |
| Rechazo/permiso no fatal | Mock de `request` que rechaza con `NotAllowedError` y prueba con API ausente. | No se lanza excepción al consumidor, no se detiene la navegación y el contrato expone limitación para la UI. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:25] |
| Idempotencia y duplicados | Dos eventos de visibilidad durante promesa pendiente; release de sentinel antiguo; desmontaje repetido simulado. | Una solicitud, un sentinel vigente, listeners balanceados y ningún estado tardío obsoleto. [ASSUMED] |
| Aviso de RouteModal | Prueba de componente con `NavegacionContext` que entregue limitación activa y navegación real. | Renderiza `RiErrorWarningLine`, clase `route-gps-status--warn` y copy aprobado; no renderiza warning en preview ni al terminar. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:78] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:96] [VERIFIED: frontend/src/componentes/detalle/RouteModal.jsx:420] [VERIFIED: frontend/src/componentes/detalle/RouteModal.css:864] |
| Contexto sin competencia | Prueba de `NavegacionProvider`/hook que compruebe una única llamada de administración cuando existen consumidores de mapa y modal. | Ningún consumidor importa o llama Wake Lock directamente. [VERIFIED: frontend/src/contexto/NavegacionProvider.jsx:8] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:18] |

Los nuevos tests de esta fase no deben incluir ubicaciones reales, rutas personales o credenciales; los casos de navegación existentes quedan fuera de la creación de datos de Wake Lock. [VERIFIED: AGENT_INSTRUCTIONS.md:15] [VERIFIED: .planning/PROJECT.md:73] [ASSUMED]

## Security/Privacy considerations

- Wake Lock es una capacidad de alto impacto energético y está controlada por el contexto seguro y por Permissions Policy; el documento debe ser HTTPS y una política `screen-wake-lock` restrictiva puede causar rechazo. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [CITED: https://w3c.github.io/screen-wake-lock/]
- El valor predeterminado de Permissions Policy para `screen-wake-lock` es `self`; no se debe abrir la capacidad a terceros ni añadir un iframe para esta fase. [CITED: https://w3c.github.io/screen-wake-lock/]
- Mantener la pantalla activa puede aumentar consumo y agotar la batería; la demanda se limita al viaje real, se libera al terminar y no se activa para preview. [CITED: https://w3c.github.io/screen-wake-lock/] [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-CONTEXT.md:17]
- La interfaz debe reconocer la limitación sin revelar datos de ubicación ni escribir diagnósticos con información personal; el aviso solo comunica que el usuario debe mantener despierto el dispositivo si lo necesita. [VERIFIED: .planning/phases/05-mantener-la-pantalla-activa/05-UI-SPEC.md:78] [VERIFIED: AGENT_INSTRUCTIONS.md:15]
- No se requieren permisos de geolocalización nuevos ni llamadas de red para Wake Lock; el feature detection y el manejo local de promesas deben dejar intactos los controles de GPS y la ruta. [ASSUMED] [VERIFIED: frontend/src/hooks/useNavegacion.js:46] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]

## Sources

- [MDN — Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API): adquisición, sentinel, visibilidad, batería, feedback, seguridad y compatibilidad. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]
- [MDN — `WakeLock.request()`](https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request): promesa, tipo `screen`, contexto seguro y causas de `NotAllowedError`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request]
- [MDN — evento `WakeLockSentinel.release`](https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event): liberación automática/manual y observación del evento. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/release_event]
- [MDN — propiedad `WakeLockSentinel.released`](https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released): estado monotónico y necesidad de solicitar un sentinel nuevo. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]
- [MDN — `visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event): evento y lectura de `document.visibilityState`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event]
- [W3C — Screen Wake Lock API Editor's Draft](https://w3c.github.io/screen-wake-lock/): visibilidad, permisos, políticas, algoritmos de release, comportamiento asesorativo y batería. [CITED: https://w3c.github.io/screen-wake-lock/]
- [MDN — Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts): Screen Wake Lock como API restringida a contexto seguro. [CITED: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts]
- [MDN — Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API): consulta opcional de estados de permiso y restricciones acumuladas. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API]

## Metadata

- **Fase:** 5 — Mantener la pantalla activa. [VERIFIED: .planning/ROADMAP.md:100]
- **Requisito:** WAKE-01. [VERIFIED: .planning/REQUIREMENTS.md:32]
- **Artefacto:** `.planning/phases/05-mantener-la-pantalla-activa/05-RESEARCH.md`. [ASSUMED: ruta de salida solicitada]
- **Modo:** investigación para planificación; no se modificó código de producción y no se ejecutaron tests/build/lint. [VERIFIED: AGENT_INSTRUCTIONS.md:6]
- **Confianza:** alta para el ciclo de API y la integración propuesta; media para compatibilidad por dispositivo, que requiere UAT físico en HTTPS. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API] [VERIFIED: .planning/PROJECT.md:14]
- **Fecha de investigación:** 2026-09-01. [ASSUMED: fecha de sesión]

