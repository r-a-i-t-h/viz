# viz

A Vite + React + TypeScript playground for exploring [XState](https://www.npmjs.com/package/xstate) inspection and a **framework-agnostic visualizer API** that can open a popup over `window.postMessage`.

In real deployments the machine host is typically a hidden iframe that **does not ship visualizer UI** — it only calls `viz.openPopup()` from a user gesture. React rendering in this repo is a PoC convenience.

## Stack

- [Vite](https://vite.dev/) — dev server and bundler
- [React 19](https://react.dev/) — optional PoC UI only (`src/ui/`)
- [XState v5](https://stately.ai/docs/xstate) — state machines and actors
- [@statelyai/inspect](https://stately.ai/docs/inspector) — reference / related tooling

## API (what real hosts use)

```ts
import { createActor } from 'xstate';
import { createVisualizerHost } from './viz';

const viz = createVisualizerHost({
  visualizerUrl: new URL('visualizer.html', location.href).href,
});

const actor = createActor(machine, { inspect: viz.inspect });
actor.start();

// From a user gesture (button, parent message → click, console in PoC):
viz.openPopup();

// Optional in-page surface (subscribers decide whether to render):
viz.showInline();
viz.hideInline();
viz.toggleInline();

viz.subscribe((snapshot) => { /* … */ });
viz.dispose();
```

No React and no visualizer CSS are required to use this API. Optional UI lives under `src/ui/` and imports `visualizer.css` only when mounted.

In the PoC host page the same API is exposed as `window.viz` for console use.

## Getting started

```bash
npm install
npm run dev
```

| URL | Role |
| --- | --- |
| http://localhost:5173/ | PoC host — machine + API. Buttons call `viz.*`; console works too. |
| http://localhost:5173/visualizer.html | Popup visualizer page. |
| http://localhost:5173/embed.html | Outer page with a hidden iframe host (`?visible=1` to show it). |

## Layout

```
src/viz/          # framework-agnostic API (createVisualizerHost, bridge, inspection)
src/ui/           # optional React renderers + visualizer.css
src/machine.ts    # demo machine for the PoC
```

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
- [`docs/TODO.md`](./docs/TODO.md) — remaining XState model surface for the visualizer
