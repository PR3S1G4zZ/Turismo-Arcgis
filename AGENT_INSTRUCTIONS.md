> **SUPERSEDED (2026-09-01):** el dueño autorizó a Cursor a **ejecutar** la Fase 7 en este worktree (tests, UAT plantilla, commits). Lo que sigue era el brief original de solo planificación y queda como histórico.

Sos un cliente escritor delegado dentro del milestone GSD "Turismo Itagüí — Navegación Móvil ArcGIS". Este worktree es HIJO de un worktree padre (Claude Code, rama PR3S1G4zZ/chore-multiagent-dev-station) que coordina 7 fases. Vos sos responsable SOLO de la Fase 7, la fase final de endurecimiento y UAT.

ALCANCE ESTRICTO DE ESTA SESIÓN — no lo excedas:
1. Ejecutá `/gsd-discuss-phase 7 --auto`.
2. Ejecutá `/gsd-plan-phase 7 --auto`.
3. NO ejecutes `/gsd-execute-phase`, NO toques código de producción, NO hagas `/gsd-code-review` ni `/gsd-verify-work`. Tu única salida son los artefactos de planificación de la Fase 7.
4. Cuando termines, escribí un resumen final claro y quedate quieto — esta fase depende de que las Fases 1-6 estén completas, así que tu plan probablemente tendrá que ser genérico/estructural ahora y podría necesitar un replan más adelante cuando el resto del milestone tenga hallazgos concretos. Decilo explícitamente en tu resumen si es el caso.

CONTEXTO DE LA FASE 7 (la última del milestone):
**Goal**: Cerrar el milestone con una suite de pruebas automatizadas en verde (rumbo, suavizado circular, histéresis, geometría, ciclo de vida de Wake Lock, contrato backend `startTime=now`) y UAT físico registrado en dispositivos reales, sin guardar coordenadas de las pruebas en ningún artefacto.
**Requirements**: HARDEN-01, HARDEN-02
**Success Criteria** (ROADMAP.md Phase 7): pruebas unitarias de rumbo/suavizado circular/histéresis de desvío/geometría; pruebas de componente para seguimiento/recentrado de cámara; pruebas de ciclo de vida de Wake Lock; pruebas de contrato backend para `startTime=now` y respuestas ArcGIS fallidas/lentas/obsoletas; build+lint+suite completa en verde; UAT físico registrado en Android Chrome y iPhone Safari (a pie y en auto: rotonda, calles paralelas, ruta que se cruza, pérdida de GPS, regreso desde segundo plano); ningún artefacto de test/instrumentación/UAT contiene coordenadas personales ni tokens.
**Dato importante**: el dueño del milestone confirmó tener dispositivos Android/iPhone físicos y entorno HTTPS de staging listos — el UAT físico se ejecuta cuando llegue el momento, no es un bloqueante teórico.
**Stack de testing existente**: frontend usa Vitest (`frontend/package.json` script `test`); backend NO tiene suite de tests configurada todavía (`.planning/codebase/TESTING.md` y `CONCERNS.md` lo documentan) — si HARDEN-01 pide contract tests de backend (`startTime=now`), el plan probablemente necesite agregar Vitest/Jest al backend primero.
**Constraints del milestone** (ver .planning/PROJECT.md): no guardar coordenadas de las pruebas.

Antes de arrancar, leé completo: .planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md (secciones Phase 1-7 completas, para tener el panorama del milestone entero), .planning/codebase/TESTING.md, .planning/codebase/CONCERNS.md.

Trabajá en español para toda la documentación GSD, igual que el resto del milestone.
