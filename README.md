# viz

A Vite + React + TypeScript playground for exploring [XState](https://www.npmjs.com/package/xstate) state machines and visualizing them with [@statelyai/inspect](https://www.npmjs.com/package/@statelyai/inspect).

The visualizer can run in a **popup window**, receiving portable inspection payloads from a machine host via `window.postMessage` — the same transport that works when the host is a hidden iframe on another site.

## Stack

- [Vite](https://vite.dev/) — dev server and bundler
- [React 19](https://react.dev/) + TypeScript
- [XState v5](https://stately.ai/docs/xstate) — state machines and actors
- [@statelyai/inspect](https://stately.ai/docs/inspector) — inspection event serialization helpers

## Getting started

```bash
npm install
npm run dev
```

Then:

| URL | Role |
| --- | --- |
| http://localhost:5173/ | Machine host (starts with no viz). Use **Show inline visualizer** and/or **Open popup visualizer**. |
| http://localhost:5173/visualizer.html | Popup visualizer (opened by the host). |
| http://localhost:5173/embed.html | Outer page with a **hidden iframe** hosting the machine (add `?visible=1` to show it). |

## Architecture

```
[ outer site / embed.html ]
        │  <iframe sandbox="allow-scripts allow-popups …">
        ▼
[ machine host / ] ── window.open ──► [ visualizer.html ]
        │                                    ▲
        └──── postMessage (@viz.*) ──────────┘
```

1. Host captures `actorRef.logic.definition` on `@xstate.actor`, then streams snapshots.
2. Host opens the popup from a **user gesture** (required under popup blockers / iframes).
3. Popup posts `@viz.hello`; host replays machine + latest snapshot, then live-updates.

See [`docs/DECISIONS.md`](./docs/DECISIONS.md) for why `postMessage` was chosen over alternatives.

## Scripts

| Script            | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start the dev server                |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview the production build        |
| `npm run lint`    | Run oxlint                          |

## Project docs

- [`AGENTS.md`](./AGENTS.md) — guidance for AI agents working in this repo
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — running log of findings and decisions
