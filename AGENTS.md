# Agent guidance

## What this repo is

An npm-workspaces monorepo for XState v5 inspection:

- **`@r-a-i-t-h/viz-protocol`** — shared `Viz*` model + `@viz.*` wire types (no XState, no React); published to npm
- **`@r-a-i-t-h/viz-host`** — `createVisualizerHost`, projection, host bridge (peer: xstate); published to npm
- **`@r-a-i-t-h/viz`** (`apps/visualizer`) — standalone inspector UI; deploy `dist/`, do not publish to npm
- **`@r-a-i-t-h/viz-demo`** (`apps/demo`) — PoC machine host that calls `openPopup()` / inline viz; private

Real hosts typically only depend on `@r-a-i-t-h/viz-host`, call `openPopup()`, and point `visualizerUrl` at a deployed inspector.

## Conventions

- TypeScript everywhere; keep strictness as configured.
- XState v5 APIs only (`createMachine`, `createActor`, `setup`) — do not use v4 patterns like `Machine()` or `interpret()`.
- XState structural types are consumed only in **`@r-a-i-t-h/viz-host`** (`project.ts`); UI speaks `Viz*` from **`@r-a-i-t-h/viz-protocol`**.
- Do not import React/CSS from `@r-a-i-t-h/viz-host` or `@r-a-i-t-h/viz-protocol`.
- Launching the popup or toggling inline viz must remain **API methods** (`viz.openPopup()`, `viz.showInline()`, …), not React-only affordances.

## Workflow

- Record notable findings and decisions in `docs/DECISIONS.md` as you go — one dated entry per finding/decision, with brief context and rationale.
- Host popup embed guide: `docs/HOST-INTEGRATION.md`.
- Host / interaction / renderer split: `docs/ARCHITECTURE.md`.
- Viz presentation model: `docs/VIZ-PRESENTATION-MODEL.md`.
- Track remaining XState model coverage in `docs/TODO.md`; check items off (and add demo coverage) when implemented.
- Verify changes with `npm run build` and `npm run lint` before committing.
- Keep commits small and focused.
- After changing protocol or host sources, `npm run build:packages` (also run by `dev` / `build`).
- App builds are separate: visualizer → `apps/visualizer/dist/`, demo+embed → `apps/demo/dist/`. Deploy only the visualizer artifact for real hosts.
