# Agent guidance

## What this repo is

A Vite + React + TypeScript playground for experimenting with XState v5 state machines and the Stately Inspector (`@statelyai/inspect`).

## Conventions

- TypeScript everywhere; keep strictness as configured in `tsconfig.app.json`.
- XState v5 APIs only (`createMachine`, `createActor`, `setup`) — do not use v4 patterns like `Machine()` or `interpret()`.
- App source lives in `src/`.

## Workflow

- Record notable findings and decisions in `docs/DECISIONS.md` as you go — one dated entry per finding/decision, with brief context and rationale.
- Verify changes compile with `npm run build` and lint with `npm run lint` before committing.
- Keep commits small and focused.
