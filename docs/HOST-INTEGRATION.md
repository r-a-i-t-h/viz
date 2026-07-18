# Host-side requirements for popup visualizer

Real embeds only need **`@viz/host`** (which depends on **`@viz/protocol`**): create a host, pass `inspect` into actors, point at a hosted visualizer URL, and call `openPopup()` from a user gesture. React, CSS, and inline viz are PoC-only (`apps/demo` / `apps/visualizer`).

## What the host actually needs

```ts
import { createActor } from 'xstate';
import { createVisualizerHost } from '@viz/host';

const viz = createVisualizerHost({
  visualizerUrl: 'https://your-viz-host/viz.html',
  // optional: maxLogEntries, sanitizeContext, sanitizeEvent
});

const actor = createActor(machine, { inspect: viz.inspect });
actor.start();

// Must be a user gesture (click handler, etc.)
viz.openPopup(); // returns false if blocked

// teardown
actor.stop();
viz.dispose();
```

```text
XState inspect
  → @viz/host (projectMachine / projectFrame)
       → VisualizerSnapshot (@viz/protocol)
            ├─ openPopup() → visualizer app via postMessage
            └─ subscribe()  → optional inline PoC only
```

Lifecycle:

1. `createVisualizerHost({ visualizerUrl })` — bridge listens for `@viz.hello`.
2. `createActor(machine, { inspect: viz.inspect })` + `actor.start()` — `@xstate.actor` / snapshot / event → project → store + bridge.
3. `viz.openPopup()` from a **user gesture** — `window.open` → popup posts hello → host replays machines/frames/logs → live stream.
4. Teardown — `actor.stop()` (and any other inspected actors), then `viz.dispose()`.

## Checklist for an existing app

1. **Depend on `@viz/host`** — pulls `@viz/protocol` as a dependency. Peer: **xstate v5**. Packages are private workspaces today; consume via workspace / `npm link` / path until published.

2. **Point at a popup page** — a deployed visualizer build (from this repo’s `viz.html` + `assets/`) that speaks `@viz.*`. Pass its absolute URL as `visualizerUrl`. It can live in any subdirectory (or another origin); keep the HTML and `assets/` folder together. Asset URLs are relative (`base: './'`), so domain-root hosting is not required.

3. **Wire inspect on every actor you care about** — pass the same `viz.inspect` into each `createActor(..., { inspect })`. No separate `attachActor()`. Spawned/invoked machine children that emit `@xstate.actor` are picked up automatically.

4. **Call `openPopup()` from a user gesture** — click/keydown. Especially important when the host runs in an iframe (popup blockers). Check the boolean return / `getPopupStatus()` for `'blocked'`.

5. **If the host is in a hidden iframe** (see root [`embed.html`](../embed.html)) — sandbox needs `allow-scripts`, `allow-popups`, and usually `allow-popups-to-escape-sandbox`.

6. **Optional hygiene** — `sanitizeContext` / `sanitizeEvent` before frames/logs cross the wire; `dispose()` on shutdown; stop actors yourself (host dispose does not stop them).

## What you do NOT need on the host

| Skip | Why |
|------|-----|
| React / `apps/visualizer` | Renderer only; popup page owns UI |
| `visualizer.css` / inline `showInline` | PoC conveniences |
| `subscribe()` | Only if you mirror status or render inline |
| `@statelyai/inspect` | Unused; raw XState `inspect` only |
| Direct `@viz/protocol` import | Optional — `@viz/host` re-exports Viz* types |

## Package boundary

| Package | In the target app? |
|---------|-------------------|
| `@viz/protocol` | Transitive (shared Viz* + wire) |
| `@viz/host` | Direct dependency |
| `apps/visualizer` | No — host separately; only `visualizerUrl` |

## Realistic caveats today

- **Not published to npm yet** — private workspaces; use `npm run build:packages` then link/path-install `@viz/host`.
- **One-way inspection** — no send-event-back-to-actor from the viz.
- **Secrets** — sanitize hooks are opt-in; default posts projected context over `postMessage`.

## Related

- Host / interaction / renderer layers: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Shared Viz* wire model: [`VIZ-PRESENTATION-MODEL.md`](./VIZ-PRESENTATION-MODEL.md)
- Why raw `inspect` (not Stately adapter): [`INSPECT-V4-VS-V5.md`](./INSPECT-V4-VS-V5.md)
