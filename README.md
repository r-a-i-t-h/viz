# viz

A Vite + React + TypeScript playground for exploring [XState](https://www.npmjs.com/package/xstate) state machines and visualizing them with [@statelyai/inspect](https://www.npmjs.com/package/@statelyai/inspect).

## Stack

- [Vite](https://vite.dev/) — dev server and bundler
- [React 19](https://react.dev/) + TypeScript
- [XState v5](https://stately.ai/docs/xstate) — state machines and actors
- [@statelyai/inspect](https://stately.ai/docs/inspector) — live inspection of running machines in the Stately Inspector

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to http://localhost:5173).

## Scripts

| Script            | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the dev server               |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview the production build       |
| `npm run lint`    | Run oxlint                         |

## Project docs

- [`AGENTS.md`](./AGENTS.md) — guidance for AI agents working in this repo
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — running log of findings and decisions
