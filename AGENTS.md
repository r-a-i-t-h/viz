# Agent guidance

## What this repo is

A Vite + React + TypeScript playground for XState v5 inspection and a **framework-agnostic visualizer host API** (`src/viz`). The host **projects** live machine logic into a shared `Viz*` model for popup/inline UIs. React under `src/ui/` is an optional PoC renderer — real hosts typically only call `openPopup()`.

## Conventions

- TypeScript everywhere; keep strictness as configured in `tsconfig.app.json`.
- XState v5 APIs only (`createMachine`, `createActor`, `setup`) — do not use v4 patterns like `Machine()` or `interpret()`.
- Core API lives in `src/viz/` — no React, no CSS. XState structural types are consumed only in the **projector** (`project.ts`); UI speaks `Viz*` (`model.ts`).
- Optional visualizer UI/CSS lives in `src/ui/` — do not import it from headless host code.
- Launching the popup or toggling inline viz must remain **API methods** (`viz.openPopup()`, `viz.showInline()`, …), not React-only affordances. PoC buttons are thin wrappers around those calls (also available as `window.viz` in the host page).

## Workflow

- Record notable findings and decisions in `docs/DECISIONS.md` as you go — one dated entry per finding/decision, with brief context and rationale.
- Host popup embed guide: `docs/HOST-INTEGRATION.md`.
- Host / interaction / renderer split: `docs/ARCHITECTURE.md`.
- Viz presentation model: `docs/VIZ-PRESENTATION-MODEL.md`.
- Track remaining XState model coverage in `docs/TODO.md`; check items off (and add demo coverage) when implemented.
- Verify changes compile with `npm run build` and lint with `npm run lint` before committing.
- Keep commits small and focused.
