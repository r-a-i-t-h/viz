# Findings & decisions

A running log of things we learn and choices we make in this project. Newest entries first.

Format for each entry:

```
## YYYY-MM-DD — Short title

**Context:** why this came up
**Finding/Decision:** what we learned or chose
**Rationale:** why (and alternatives considered, if any)
```

---

## 2026-07-16 — Intention: revive the state machine visualizer for XState v5

**Context:** We previously built a visualizer against XState v4 and the old `@xstate/inspect`. XState v5 + the new `@statelyai/inspect` take a different approach and we need to re-establish the foundation. The core blocker: inspection events surface the *current state*, but a visualizer needs the *entire machine make-up* (all states, nesting, parallel regions, transitions). We could see all the events flow, but couldn't find the machine config on an actor event.

**Goal:**
- Build a sample machine exercising composite (nested) and parallel states.
- Hook in the inspect library and confirm we can respond to inspection events.
- Determine whether the machine config travels with an inspection event, and if not, find a way to obtain it for visualization.

## 2026-07-16 — Where the machine config actually lives in v5 inspection

**Context:** Investigating whether inspection events carry enough to draw the whole machine, not just the active state.

**Finding:** The raw XState `InspectionEvent` union (`src/inspection.d.ts`) is deliberately lean:
- `@xstate.snapshot` / `@xstate.transition` / `@xstate.microstep` carry `snapshot` (`.value`, `.context`, `.status`) + `event` — i.e. current state only.
- `@xstate.event` carries the event + `sourceRef`.
- `@xstate.actor` carries **only** `type` + `actorRef`.

None of them embed the machine structure directly. **But** every inspection event carries an `actorRef`, and for a machine actor `actorRef.logic` *is* the `StateMachine` instance. From there:
- `actorRef.logic.config` — the raw config object as authored.
- `actorRef.logic.definition` — a **normalized** `StateNodeDefinition` tree: `{ id, key, type: 'atomic'|'compound'|'parallel'|'final'|'history', initial, states, on, transitions, entry, exit, ... }`. This is the ideal shape for a visualizer because node types (incl. parallel/compound) and all transitions are pre-resolved.
- `actorRef.logic.toJSON()` — same as `.definition`.
- Plus `actorRef.logic.getStateNodeById(id)`, `.root`, `.states`.

Confirmation that this is the intended path: `@statelyai/inspect` itself reads `actorRef.logic.config` on the `@xstate.actor` event and serializes it into the `definition: string` field of its own `StatelyActorEvent` (see `createInspector` in `dist/index.mjs`). So the library's own actor event *does* carry the (stringified) config — the raw XState event does not, but the source is `actorRef.logic`.

**Decision:** For our visualizer, subscribe with a raw `inspect` observer on `createActor({ inspect })`. On the first `@xstate.actor` event, capture `actorRef.logic.definition` (normalized) keyed by `sessionId` — that is the full make-up. On subsequent `@xstate.snapshot` events, read `snapshot.value` and overlay it onto the stored definition to highlight active states. This cleanly separates "structure" (captured once) from "current state" (streamed).

**Rationale:** `.definition` is normalized and already distinguishes parallel vs compound nodes and lists transitions, so we don't have to interpret raw config shorthand. Using the raw `inspect` observer (rather than only the Stately adapter) keeps the full live `actorRef.logic` in hand for deeper interrogation later.

---

## 2026-07-16 — Initial scaffold

**Context:** Starting a playground to explore XState machine visualization.
**Decision:** Scaffolded with Vite (`react-ts` template), added `xstate` v5 and `@statelyai/inspect`.
**Rationale:** Vite gives a fast dev loop; XState v5 is the current major; `@statelyai/inspect` connects running actors to the Stately Inspector for live visualization.
