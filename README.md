# viz

npm workspaces monorepo for XState v5 inspection:

| Package / app | Role |
| --- | --- |
| [`@viz/protocol`](./packages/protocol) | Shared `Viz*` model + `@viz.*` wire protocol (no XState) |
| [`@viz/host`](./packages/host) | Host library: `inspect` → project → popup bridge (depends on protocol; peer `xstate`) |
| [`apps/visualizer`](./apps/visualizer) | Independently hostable visualizer UI (`viz.html`) |
| [`apps/demo`](./apps/demo) | PoC machine host (`index.html` / `embed.html`) |

Real embeds install **`@viz/host`** (which depends on `@viz/protocol`) and point `visualizerUrl` at a deployed visualizer. React under the visualizer app is not required on the machine host.

## API (what real hosts use)

```ts
import { createActor } from 'xstate';
import { createVisualizerHost } from '@viz/host';

const viz = createVisualizerHost({
  visualizerUrl: 'https://your-viz-host/viz.html',
});

const actor = createActor(machine, { inspect: viz.inspect });
actor.start();

// From a user gesture:
viz.openPopup();

viz.dispose();
```

**Embedding guide:** [`docs/HOST-INTEGRATION.md`](./docs/HOST-INTEGRATION.md).

## Getting started

```bash
npm install
npm run dev
```

| URL | Role |
| --- | --- |
| http://localhost:5173/ | Demo host — machine + API |
| http://localhost:5173/viz.html | Visualizer page (popup target) |
| http://localhost:5173/embed.html | Outer page with a hidden iframe host (`?visible=1` to show it) |

## Layout

```
packages/protocol/   # @viz/protocol — Viz* + wire
packages/host/       # @viz/host — createVisualizerHost, project, HostBridge
apps/visualizer/     # popup/inline React UI (protocol only)
apps/demo/           # PoC host page + demo machines
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Build packages, start Vite |
| `npm run build` | Build packages + apps |
| `npm run build:packages` | Emit `dist/` for `@viz/protocol` and `@viz/host` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run oxlint |

## Project docs

- [`AGENTS.md`](./AGENTS.md) — guidance for AI agents working in this repo
- [`docs/HOST-INTEGRATION.md`](./docs/HOST-INTEGRATION.md) — host-side popup requirements for existing apps
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — running log of findings and decisions
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — host / interaction / renderer layers
- [`docs/VIZ-PRESENTATION-MODEL.md`](./docs/VIZ-PRESENTATION-MODEL.md) — shared Viz* wire model
- [`docs/TODO.md`](./docs/TODO.md) — remaining XState model surface for the visualizer
