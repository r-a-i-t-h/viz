# XState inspect: v4 (`@xstate/inspect`) → v5 (`xstate` + `@statelyai/inspect`)

Findings for anyone building an own-rolled visualizer against XState. Newest research: 2026-07-18.

**Related:** capture strategy in [`DECISIONS.md`](./DECISIONS.md) (“Where the machine config actually lives in v5 inspection”); product scope in [`TODO.md`](./TODO.md); host/renderer split in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Verdict

Inspection moved from a DevTools-style service bus (`@xstate/inspect` + `devTools: true`) into a first-class actor observer in XState v5.

Neither `@xstate/inspect` nor `@statelyai/inspect` is a **graph-traversal** library. The TypeScript model for navigating machine structure and current state still lives in **XState core** (`StateMachine`, `StateNodeDefinition`, `MachineSnapshot` / `StateValue`).

What changed is:

1. **How you attach** an inspector.
2. **What the inspect event stream carries** (especially: structure is no longer on the event by default).
3. **What `@statelyai/inspect` adds** — a serializable wire format / adapters for Stately Inspector, not a richer in-process model API.

---

## Architectural change

| | v4 world | v5 world |
|---|---|---|
| Package | `@xstate/inspect` | Inspect is **built into `xstate`**; `@statelyai/inspect` is a **transport / UI adapter** |
| Attachment | Global `inspect()` + `interpret(machine, { devTools: true })` | `createActor(machine, { inspect })` **or** later `actor.system.inspect(observer)` (returns a subscription) |
| Custom viz entry | `createWindowReceiver()` → `service.register` / `service.state` / … | Raw `InspectionEvent` observer, *or* `@statelyai/inspect`’s `StatelyInspectionEvent` over postMessage / WebSocket |
| Scope | Mostly machine *services* | Full **actor system** (machine, promise, callback, observable, transition, …) |

```text
v4:  interpret + DevTools registry  →  @xstate/inspect  →  receiver events (machine + state)
v5:  createActor({ inspect })       →  InspectionEvent (lean)
                                    →  optional @statelyai/inspect  →  Stately* wire events
                                    →  and/or own host that reads actorRef.logic
```

### Late attachment (`actor.system.inspect`)

`createActor(machine, { inspect })` only wires the observer when creating a **root** actor (it calls `system.inspect` internally). You can attach the same way after construction:

```ts
const actor = createActor(machine);
const sub = actor.system.inspect((inspectionEvent) => {
  /* … */
});
actor.start();
// sub.unsubscribe();
```

Inspection is **system-wide** and does **not** replay past events. For a custom viz that keys structure off `@xstate.actor` (as `@viz/host` does), attach **before** `start()` or you will see later snapshots/events without a machine graph. See [`HOST-INTEGRATION.md`](./HOST-INTEGRATION.md#attaching-inspect-after-createactor).

---

## The TypeScript model to navigate

### Structure (machine make-up)

Still on the live `StateMachine`. In v5 that instance is `actorRef.logic` for a machine actor:

| Path | Meaning |
|------|---------|
| `logic.config` | Raw authored config |
| `logic.definition` / `logic.toJSON()` | Normalized `StateMachineDefinition` (= root `StateNodeDefinition`) — **best for viz** |
| `logic.root` / `logic.states` / `logic.getStateNodeById(id)` | Live `StateNode` tree |

Official `StateNodeDefinition` shape (from `xstate` types):

```ts
interface StateNodeDefinition<TContext, TEvent> {
  id: string;
  key: string;
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial: InitialTransitionDefinition | undefined;
  history: boolean | 'shallow' | 'deep' | undefined;
  states: StatesDefinition;            // recursive
  on: TransitionDefinitionMap;         // event → TransitionDefinition[]
  transitions: TransitionDefinition[];
  entry: UnknownAction[];
  exit: UnknownAction[];
  invoke: InvokeDefinition[];
  tags: string[];
  meta: any;
  order: number;
  description?: string;
  // …
}
```

That normalized tree is the ideal viz substrate: node kinds (incl. parallel vs compound) and transitions are already resolved — no need to interpret config shorthand.

**Live** `StateNode` / `TransitionDefinition` still hold object refs (`target: StateNode[]`, `source`, guards/actions as functions). Excellent in-process; useless across `postMessage` without sanitizing to names/ids/params.

This repo **projects** `logic.definition` on the host into a shared `VizMachine` (`@viz/host` / `@viz/protocol`) and overlays `VizFrame.activePaths` from snapshots — see [`VIZ-PRESENTATION-MODEL.md`](./VIZ-PRESENTATION-MODEL.md).

### Current state (runtime)

| v4 | v5 |
|---|---|
| `State` | `MachineSnapshot` (generic actors: `Snapshot`) |
| `.value`, `.context` | same |
| `.configuration` (active `StateNode`s) | `._nodes` |
| — | `.status` (`active` \| `done` \| `error` \| `stopped`), `.output`, `.children` |
| `.matches()` / etc. | `.matches()`, `.can()`, `.hasTag()`, … |

`StateValue` is unchanged in spirit: a string for atomic/leaf selection, or a nested object for compound/parallel regions.

Active overlay without live `_nodes` (e.g. after serialization): flatten `snapshot.value` into paths in the **projector** (`activePaths` → `VizFrame.activePaths`).

---

## What the inspect *events* give you

### v4 — `@xstate/inspect` receiver

Custom visualizers were designed around `ParsedReceiverEvent`-style payloads:

```ts
{ type: 'service.register'; machine; state; sessionId; id?; parent?; … }
{ type: 'service.state'; state; sessionId }
{ type: 'service.event'; event; sessionId }
{ type: 'service.stop'; sessionId }
```

**`service.register` already carried the machine** (live `StateMachine` same-window, or stringified for remote) plus an initial `state`. Structure + current state arrived together — the main thing a visualizer needs on first paint.

`createWindowReceiver()` existed specifically so third parties could build their own inspector UI.

### v5 — raw XState `InspectionEvent`

Defined in `xstate` (`inspection.d.ts`). Deliberately lean — **no embedded machine graph**:

| Event | Carries |
|-------|---------|
| `@xstate.actor` | `actorRef` (+ `rootId`) only |
| `@xstate.snapshot` | `snapshot` + `event` |
| `@xstate.event` | `event` + `sourceRef` |
| `@xstate.transition` | `snapshot` + `event` |
| `@xstate.microstep` | `snapshot` + `event` + `_transitions` |
| `@xstate.action` | `{ type, params }` |

Every event has a consistent `actorRef`. Structure is **not** on the event. You reach through:

```text
event.actorRef.logic  →  StateMachine  →  .definition / .config / .root
```

Confirmation that this is the intended path: `@statelyai/inspect` itself reads `actorRef.logic.config` when handling `@xstate.actor` and puts a stringified copy on its own wire event (see below).

### v5 — `@statelyai/inspect` wire format

The package wraps XState inspection into serializable `StatelyInspectionEvent`s for browser / WebSocket adapters. On actor registration it adds:

```ts
type StatelyActorEvent = {
  type: '@xstate.actor';
  definition: string | undefined;  // JSON.stringify(actorRef.logic.config)
  snapshot: InspectedSnapshot;     // { status?, value?, context?, output? }
  sessionId: string;
  parentId?: string;
  name: string;
  // + rootId, createdAt, id, _version, …
};
```

**Critical nuance:** Stately stringifies **`logic.config`** (authored), **not** the normalized `.definition`. A remote visualizer either:

- re-parses that string and walks config shorthand, or
- (preferred for structure) captures `.definition` **in-process on the host** before shipping — which is what this project does (`captureMachine` → bridge protocol).

`@statelyai/inspect` also exposes manual `inspector.actor()` / `.event()` / `.snapshot()` for non-XState state managers; those are not a substitute for `StateNodeDefinition` traversal.

---

## Own-rolled visualizer: old vs new challenges

### Old world (v4) — easier first paint; same serialization wall

**What worked well**

- Subscribe to `createWindowReceiver` and treat `service.register.machine` as the graph.
- Overlay `service.state.state.value` (or walk `state.configuration`).
- Same-process: keep the live `StateMachine` / `StateNode` graph and use rich APIs.

**Challenges**

- Over the wire, functions still vanished; you got a JSON-ish machine blob.
- Tied to the DevTools / `interpret` registration path.
- Weaker visibility into non-machine actors and into microsteps / eventless cascades.

### New world (v5) — clearer runtime stream; you own structure capture

**Recommended solutions**

1. **In-process (best for custom viz):** raw `inspect` → on `@xstate.actor` capture `actorRef.logic.definition` keyed by `sessionId` → on `@xstate.snapshot` overlay `snapshot.value` / `context` / `status`.
2. **Remote / popup:** capture & sanitize on the host, then `postMessage` (same pattern as Stately’s `BrowserAdapter`). Prefer shipping normalized definition, not only Stately’s stringified config.
3. **Optional:** use `@statelyai/inspect` only if you want Stately’s UI / protocol — not if you need a local traversal model.

**Harder than v4**

| Challenge | Detail |
|-----------|--------|
| Discovery | Machine structure is *not* on the event — easy to miss `actorRef.logic` |
| Late inspect | `system.inspect` after `start()` misses `@xstate.actor`; no replay |
| No traversal helpers | `@statelyai/inspect` does not walk graphs; you walk `StateNodeDefinition` yourself |
| Actor diversity | Many `actorRef`s are not machines → no `.definition` |
| `setup()` implementations | Never round-trip over the wire; UI should show names / types / params |
| Config vs definition | Stately’s `definition: string` is raw config; viz authors usually want `.definition` |
| Active overlay | Map `StateValue` → paths, or use in-process `snapshot._nodes`; wire payloads only have `value` |

**Gains vs v4**

- Granular `@xstate.microstep` / `@xstate.action` (eventless / always cascades, action stream).
- Consistent `actorRef` + parent/child `sessionId` for actor-system diagrams.
- Explicit attach point (`inspect` option **or** `actor.system.inspect`) instead of global DevTools magic.

---

## Practical split (what to store where)

```text
Structure (once per session)
  → StateMachineDefinition / StateNodeDefinition
    from actorRef.logic.definition          (same-process)
    or host-captured normalized tree        (remote / postMessage)
    avoid relying solely on Stately's stringified config unless you re-normalize

Runtime (stream)
  → MachineSnapshot.value / .context / .status / .children
    from @xstate.snapshot

Optional depth (in-process only, or specialized events)
  → live StateNode / TransitionDefinition
  → @xstate.microstep._transitions
  → setup() registries for named actions / guards / actors / delays
```

---

## How this repo applies it

- Host API (`@viz/host`): raw `inspect` observer via `createVisualizerHost()`.
- On `@xstate.actor`: `captureMachine()` reads `actorRef.logic.definition` (+ `config`, context dep-graph).
- On `@xstate.snapshot`: store `value` / context; UI overlays active paths onto the stored definition tree.
- Popup / embed: host captures first, then ships portable JSON over `postMessage` — live `actorRef` / functions never cross the boundary.
- Deliberately **not** depending on `@statelyai/inspect` traversal (there is none); the package remains a reference for wire patterns only.

See also `docs/TODO.md`: new features extend the **projector** (`project.ts`), not Stately helpers or popup XState parsers.

---

## Quick reference — attach patterns

**v4**

```ts
import { inspect } from '@xstate/inspect';
import { interpret } from 'xstate';

inspect({ iframe: false });
interpret(machine, { devTools: true }).start();
```

Receiver side:

```ts
import { createWindowReceiver } from '@xstate/inspect';

createWindowReceiver().subscribe((event) => {
  if (event.type === 'service.register') {
    // event.machine — structure
    // event.state — current State
  }
});
```

**v5 — raw (own visualizer)**

```ts
import { createActor } from 'xstate';

const actor = createActor(machine, {
  inspect: (inspectionEvent) => {
    if (inspectionEvent.type === '@xstate.actor') {
      const logic = (inspectionEvent.actorRef as { logic?: { definition: unknown } }).logic;
      // capture logic?.definition
    }
    if (inspectionEvent.type === '@xstate.snapshot') {
      // overlay inspectionEvent.snapshot.value
    }
  },
});
```

**v5 — Stately Inspector UI**

```ts
import { createBrowserInspector } from '@statelyai/inspect';
import { createActor } from 'xstate';

const inspector = createBrowserInspector();
createActor(machine, { inspect: inspector.inspect }).start();
```

---

## Sources

- XState `InspectionEvent` types (`xstate` → `inspection.d.ts`)
- `StateMachine.definition` → `StateMachineDefinition` / `StateNodeDefinition` (`types.d.ts`)
- `MachineSnapshot` / `_nodes` (`State.d.ts`); migration note: `state.configuration` → `state._nodes`
- `@statelyai/inspect` `StatelyActorEvent.definition` (stringified `logic.config`)
- Stately docs: [Inspection](https://stately.ai/docs/inspection), [Inspector](https://stately.ai/docs/inspector), [Migration](https://stately.ai/docs/migration)
- Historical `@xstate/inspect` receiver design (`service.register` carrying `machine` + `state`)
