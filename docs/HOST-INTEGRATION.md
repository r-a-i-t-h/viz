# Host-side requirements for popup visualizer

Real embeds only need **`@r-a-i-t-h/viz-host`** (which depends on **`@r-a-i-t-h/viz-protocol`**): create a host, pass `inspect` into actors, point at a hosted visualizer URL, and call `openPopup()` from a user gesture. React, CSS, and inline viz are PoC-only (`apps/demo` / `apps/visualizer`).

## What the host actually needs

```ts
import { createActor } from 'xstate';
import { createVisualizerHost } from '@r-a-i-t-h/viz-host';

const viz = createVisualizerHost({
  visualizerUrl: 'https://your-viz-host/',
  // optional: maxLogEntries (per session, default 100), sanitizeContext, sanitizeEvent
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
  → @r-a-i-t-h/viz-host (projectMachine / projectFrame)
       → VisualizerSnapshot (@r-a-i-t-h/viz-protocol)
            ├─ openPopup() → visualizer app via postMessage
            └─ subscribe()  → optional inline PoC only
```

Lifecycle:

1. `createVisualizerHost({ visualizerUrl })` — bridge listens for `@viz.hello`.
2. `createActor(machine, { inspect: viz.inspect })` + `actor.start()` — `@xstate.actor` / snapshot / event → project → store + bridge.
3. `viz.openPopup()` from a **user gesture** — `window.open` → popup posts hello → host replays machines/frames/logs → live stream.
4. Teardown — `actor.stop()` (and any other inspected actors), then `viz.dispose()`. On host refresh/navigation the bridge also sends `@viz.closed` so the popup closes automatically; call `openPopup()` again after reload.

## Checklist for an existing app

1. **Depend on `@r-a-i-t-h/viz-host`** — `npm install @r-a-i-t-h/viz-host` (pulls `@r-a-i-t-h/viz-protocol`). Peer: **xstate v5**.

2. **Point at a popup page** — a deployed visualizer build (from this repo’s `apps/visualizer/dist/` — `index.html` + `assets/`) that speaks `@viz.*`. Pass its absolute URL as `visualizerUrl`. It can live in any subdirectory (or another origin); keep the HTML and `assets/` folder together. Asset URLs are relative (`base: './'`), so domain-root hosting is not required. The inspector app (`@r-a-i-t-h/viz`) is **not** an npm dependency — only a hosted URL.

3. **Wire inspect on every root actor you care about** — pass the same `viz.inspect` into each `createActor(..., { inspect })`, or attach later via `actor.system.inspect` (see below). No separate `attachActor()`. Spawned/invoked machine children that emit `@xstate.actor` are picked up automatically once the **system** is inspected.

4. **Call `openPopup()` from a user gesture** — click/keydown. Especially important when the host runs in an iframe (popup blockers). Check the boolean return / `getPopupStatus()` for `'blocked'`. For local debugging, console `viz.openPopup()` often works if the origin allows popups.

5. **If the host is in a hidden iframe** (see [`apps/demo/embed.html`](../apps/demo/embed.html)) — sandbox needs `allow-scripts`, `allow-popups`, and usually `allow-popups-to-escape-sandbox`.

6. **Optional hygiene** — `sanitizeContext` / `sanitizeEvent` before frames/logs cross the wire; `dispose()` on shutdown; stop actors yourself (host dispose does not stop them).

## Attaching inspect after `createActor`

XState v5 does **not** require `inspect` only at construction. `createActor(machine, { inspect })` is sugar: on a root actor it registers the observer on `actor.system`. You can do the same later:

```ts
const viz = createVisualizerHost({ visualizerUrl: '…' });
const actor = createActor(machine); // no inspect option

// Before start — still receives @xstate.actor (machine structure)
const sub = actor.system.inspect(viz.inspect);
actor.start();

// later: sub.unsubscribe();
```

Useful when you cannot (or prefer not to) change every `createActor` call site — e.g. local debugging toggled from the console, or a thin wrapper around an existing factory.

### Timing that matters for `@r-a-i-t-h/viz-host`

The host builds the machine tree only from **`@xstate.actor`** events (`machineLogicFromEvent` → `projectMachine`). Snapshot/event streams alone do not register structure.

| When you call `system.inspect(viz.inspect)` | What you get |
| --- | --- |
| Before `actor.start()` | Full structure + live frames (same as construction-time `inspect`) |
| After `actor.start()` | Later `@xstate.snapshot` / `@xstate.event` only — **no** machine graph (registration already fired) |
| On a child actor’s `system` | Same system as the root — inspect is system-wide either way |

Prefer construction-time `inspect` or `system.inspect` **before** `start()`. There is no built-in replay of past inspection events.

## What you do NOT need on the host

| Skip | Why |
|------|-----|
| React / `apps/visualizer` | Renderer only; popup page owns UI |
| `visualizer.css` / inline `showInline` | PoC conveniences |
| `subscribe()` | Only if you mirror status or render inline |
| `@statelyai/inspect` | Unused; raw XState `inspect` only |
| Direct `@r-a-i-t-h/viz-protocol` import | Optional — `@r-a-i-t-h/viz-host` re-exports Viz* types |

## Package boundary

| Package | In the target app? |
|---------|-------------------|
| `@r-a-i-t-h/viz-protocol` | Transitive (shared Viz* + wire); on npm |
| `@r-a-i-t-h/viz-host` | Direct dependency; on npm |
| `@r-a-i-t-h/viz` / `apps/visualizer` | No — deploy `dist/` separately; only `visualizerUrl` |

## Realistic caveats today

- **Inspector is not on npm** — publish/deploy `apps/visualizer/dist/` and pass that URL as `visualizerUrl`.
- **One-way inspection** — no send-event-back-to-actor from the viz.
- **Secrets** — sanitize hooks are opt-in; default posts projected context over `postMessage`.

## Related

- Host / interaction / renderer layers: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Shared Viz* wire model: [`VIZ-PRESENTATION-MODEL.md`](./VIZ-PRESENTATION-MODEL.md)
- Why raw `inspect` (not Stately adapter): [`INSPECT-V4-VS-V5.md`](./INSPECT-V4-VS-V5.md)
