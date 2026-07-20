# viz

npm workspaces monorepo for XState v5 inspection:

| Package / app | Role | Published? |
| --- | --- | --- |
| [`@r-a-i-t-h/viz-protocol`](./packages/protocol) | Shared `Viz*` model + `@viz.*` wire protocol (no XState) | npm |
| [`@r-a-i-t-h/viz-host`](./packages/host) | Host library: `inspect` → project → popup bridge (depends on protocol; peer `xstate`) | npm |
| [`@r-a-i-t-h/viz`](./apps/visualizer) | Standalone inspector UI → deploy `apps/visualizer/dist/` | no (static host) |
| [`@r-a-i-t-h/viz-demo`](./apps/demo) | PoC machine host + embed shell → `apps/demo/dist/` | no |

Real embeds install **`@r-a-i-t-h/viz-host`** (which depends on `@r-a-i-t-h/viz-protocol`) and point `visualizerUrl` at a **deployed** visualizer build. The inspector is not an npm component library.

## API (what real hosts use)

```ts
import { createActor } from 'xstate';
import { createVisualizerHost } from '@r-a-i-t-h/viz-host';

const viz = createVisualizerHost({
  visualizerUrl: 'https://your-viz-host/',
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
| http://localhost:5174/ | Visualizer page (popup target) |
| http://localhost:5173/embed.html | Outer page with a hidden iframe host (`?visible=1` to show it) |

Override the demo’s popup target with `VITE_VISUALIZER_URL` at build/dev time if needed.

## Layout

```
packages/protocol/   # @r-a-i-t-h/viz-protocol — Viz* + wire (npm)
packages/host/       # @r-a-i-t-h/viz-host — createVisualizerHost, project, HostBridge (npm)
apps/visualizer/     # @r-a-i-t-h/viz — popup UI → deploy apps/visualizer/dist/
apps/demo/           # @r-a-i-t-h/viz-demo — PoC host + embed shell
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Build packages, start demo (:5173) + visualizer (:5174) |
| `npm run build` | Build packages + both apps (`apps/*/dist/`) |
| `npm run build:packages` | Emit `dist/` for `@r-a-i-t-h/viz-protocol` and `@r-a-i-t-h/viz-host` |
| `npm run build:visualizer` / `build:demo` | Build one app |
| `npm run preview` | Preview production builds (demo :4173, visualizer :4174) |
| `npm run lint` | Run oxlint |

## Publishing

Publish **protocol then host** to npm (scoped public packages under `@r-a-i-t-h`). Deploy the visualizer separately and pass its URL as `visualizerUrl`.

```bash
npm run build:packages
npm publish -w @r-a-i-t-h/viz-protocol --access public
npm publish -w @r-a-i-t-h/viz-host --access public
```

## Project docs

- [`AGENTS.md`](./AGENTS.md) — guidance for AI agents working in this repo
- [`docs/HOST-INTEGRATION.md`](./docs/HOST-INTEGRATION.md) — host-side popup requirements for existing apps
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — running log of findings and decisions
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — host / interaction / renderer layers
- [`docs/VIZ-PRESENTATION-MODEL.md`](./docs/VIZ-PRESENTATION-MODEL.md) — shared Viz* wire model
- [`docs/TODO.md`](./docs/TODO.md) — remaining XState model surface for the visualizer
