---
phase: 05
slug: mantener-la-pantalla-activa
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-01
---

# Phase 05 — UI Design Contract

> Contrato visual mínimo para comunicar la degradación de Screen Wake Lock. No
> agrega una superficie nueva ni cambia el mapa o el flujo de navegación.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | `react-icons/ri` (existing `RiErrorWarningLine`) |
| Font | `var(--font-body)` / Quicksand, existing RouteModal tokens |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline icon/text gap when needed |
| sm | 8px | Warning padding and compact status spacing |
| md | 16px | Existing RouteModal content spacing |
| lg | 24px | Existing section spacing |
| xl | 32px | Existing layout gaps |
| 2xl | 48px | Existing major section breaks |
| 3xl | 64px | Existing page-level spacing |

Exceptions: none for the new Wake Lock status; reuse the existing `8px 10px` status padding when preserving the established component contract.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 13.5px | 400 | 1.4 |
| Label | 12.5px | 600 | 1.4 |
| Heading | 16px | 700 | 1.2 |
| Display | 22px | 700 | 1.2 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--color-surface)` / `#ffffff` | Existing route panel |
| Secondary (30%) | `var(--color-surface-alt)` / `#ebedff` | Existing status surfaces |
| Accent (10%) | `var(--color-accent)` / `#E8B400` | Existing route progress only; not the Wake Lock warning |
| Destructive | `var(--color-danger)` / `#ba1a1a` | Existing destructive errors only |

Accent reserved for: route CTA and progress indicators already defined by RouteModal; the Wake Lock limitation uses the existing warning treatment, not the brand accent.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Existing `Iniciar Ruta`; unchanged |
| Empty state heading | Not applicable to this phase |
| Empty state body | Not applicable to this phase |
| Error state | `No se puede mantener la pantalla activa. La navegación continúa; mantén el dispositivo despierto si lo necesitas.` |
| Destructive confirmation | Not applicable to this phase |

The warning is informative and non-blocking. It must not claim that the screen is locked when the browser has rejected or released the sentinel.

---

## UI Considerations

> State coverage is limited to the existing RouteModal tracking surface. Copy
> lives in the Copywriting Contract above; this section records the states that
> the planner must preserve.

Applicable state considerations resolved: 3 covered, 0 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| populated | RouteModal tracking panel | ✅ covered | Successful Wake Lock acquisition does not add a new banner or alter the existing navigation content. |
| error | Wake Lock status inside RouteModal tracking panel | ✅ covered | Unsupported, denied, rejected, or system-released Wake Lock renders the documented non-blocking warning copy while navigation remains usable. |
| overflow | Wake Lock warning text on mobile RouteModal | ✅ covered | The warning reuses `route-gps-status` layout, wraps within the panel, and does not introduce horizontal overflow or a new modal. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Existing project CSS and `react-icons/ri` | `route-gps-status`, `route-gps-status--warn`, `RiErrorWarningLine` | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-09-01
