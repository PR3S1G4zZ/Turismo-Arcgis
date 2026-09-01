import { describe, it } from 'vitest';

describe('Wake Lock (WAKE-01 — aún no hay implementación en frontend/src)', () => {
  // Grep del worktree: no hay navigator.wakeLock ni hook de bloqueo de pantalla.
  // HARDEN-01 pide ciclo de vida; D-01 de 07-CONTEXT.md prohíbe fingir el módulo.
  it.todo('solicita navigator.wakeLock.request("screen") al entrar en navegación activa');
  it.todo('libera el bloqueo al llegar, cancelar, error o desmontar');
  it.todo('reintenta cuando document.visibilityState vuelve a visible');
  it.todo('degrada sin error visible si la API no existe o el permiso se deniega');
});
