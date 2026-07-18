# Host-side requirements for popup visualizer

Real embeds only need the framework-agnostic host API in `src/viz/`: create a host, pass `inspect` into actors, serve a `visualizer.html` page, and call `openPopup()` from a user gesture. React, CSS, and inline viz are PoC-only.

## What the host actually needs

A real app does **not** mount React visualizer UI. It only depends on [`src/viz/`](../src/viz/) and XState v5:

```ts
import { createActor } from 'xstate';
import { createVisualizerHost } from './viz'; // today: copy/vendor this module; not published

const viz = createVisualizerHost({
  visualizerUrl: new URL('visualizer.html', location.href).href,
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

That is the full product surface for hosts ([`README.md`](../README.md), [`createVisualizerHost.ts`](../src/viz/createVisualizerHost.ts)).

```text
XState inspect
  → createVisualizerHost (projectMachine / projectFrame)
       → VisualizerSnapshot
            ├─ openPopup() → visualizer.html via postMessage
            └─ subscribe()  → optional inline PoC only
```

Lifecycle:

1. `createVisualizerHost({ visualizerUrl })` — bridge listens for `@viz.hello`.
2. `createActor(machine, { inspect: viz.inspect })` + `actor.start()` — `@xstate.actor` / snapshot / event → project → store + bridge.
3. `viz.openPopup()` from a **user gesture** — `window.open` → popup posts hello → host replays machines/frames/logs → live stream.
4. Teardown — `actor.stop()` (and any other inspected actors), then `viz.dispose()`.

## Checklist for an existing app

1. **Ship / import the host API** — everything under `src/viz/` (no React). Peer dependency: **xstate v5**. There is no npm package yet (`private: true`); vendor the module or path-import it until a package split lands.

2. **Serve a popup page** — something equivalent to [`visualizer.html`](../visualizer.html) that loads the popup receiver + UI (`connectPopupReceiver` + React PoC today). The host only needs a reachable URL; pass it as `visualizerUrl`. Cross-origin popup pages are fine (protocol uses `postMessage` with `*`).

3. **Wire inspect on every actor you care about** — pass the same `viz.inspect` into each `createActor(..., { inspect })`. No separate `attachActor()`. Spawned/invoked machine children that emit `@xstate.actor` are picked up automatically.

4. **Call `openPopup()` from a user gesture** — click/keydown. Especially important when the host runs in an iframe (popup blockers). Check the boolean return / `getPopupStatus()` for `'blocked'`.

5. **If the host is in a hidden iframe** (intended real shape; see [`embed.html`](../embed.html)) — sandbox needs `allow-scripts`, `allow-popups`, and usually `allow-popups-to-escape-sandbox`. Outer page triggers open via a gesture that reaches into the iframe (no parent→iframe bridge is built yet; PoC buttons live inside the host page).

6. **Optional hygiene** — `sanitizeContext` / `sanitizeEvent` before frames/logs cross the wire; `dispose()` on shutdown; stop actors yourself (host dispose does not stop them).

## What you do NOT need on the host

| Skip | Why |
|------|-----|
| React / [`src/ui/`](../src/ui/) | Renderer only; popup page owns UI |
| `visualizer.css` / inline `showInline` | PoC conveniences |
| `subscribe()` | Only if you mirror status or render inline |
| `@statelyai/inspect` | Unused; raw XState `inspect` only |

## Realistic caveats today

- **Not a published package** — you copy/vendor `src/viz` (and still need to host the popup HTML/UI from this repo or a rebuild of it).
- **Popup UI is still this repo’s React app** — host API is headless; the visualizer window is not.
- **One-way inspection** — no send-event-back-to-actor from the viz.
- **Secrets** — sanitize hooks are opt-in; default posts projected context over `postMessage`.

## Minimal “existing app” shape

```text
Your app (or hidden iframe)
  createVisualizerHost + createActor({ inspect })
  button / shortcut → viz.openPopup()

visualizer.html (same or other origin)
  connectPopupReceiver → render Viz* snapshot
```

Canonical reference wiring: [`src/ui/HostApp.tsx`](../src/ui/HostApp.tsx) (ignore the React shell and inline path; keep only host create + inspect + `openPopup`). Deployment sketch: [`embed.html`](../embed.html).

## Related

- Host / interaction / renderer layers: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Shared Viz* wire model: [`VIZ-PRESENTATION-MODEL.md`](./VIZ-PRESENTATION-MODEL.md)
- Why raw `inspect` (not Stately adapter): [`INSPECT-V4-VS-V5.md`](./INSPECT-V4-VS-V5.md)
