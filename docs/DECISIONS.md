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

## 2026-07-16 — Lifecycle badges on hierarchical state nodes

**Context:** Hierarchical layout already conveys structure; entry / exit / after are important but easy to miss without arrow-heavy diagrams.

**Decision:** Overlay small circular icon badges at the top-right of each state node (straddling the top border) for authored `entry`, `exit`, and `after`. Filter out XState’s injected `xstate.raise` / `xstate.cancel` actions so `after` does not falsely imply entry/exit badges. Detect `after` via `xstate.after.*` event keys / delayed transitions.

**Rationale:** Keeps the hierarchical view while giving an immediate “this node has lifecycle/timing behaviour” signal, matching the previous visualizer’s convention.

## 2026-07-17 — Two-level click zoom with neighborhood

**Context:** The full machine overview is dense; users need a way to inspect a local region without a continuous zoom widget.

**Decision:** Two scales only — `small` (default for the whole tree) and `large`. Clicking a node toggles focus on that path; the focused node plus ancestors/descendants within 2 hops render large. Clicking the focused node again returns everything to small.

**Rationale:** Discrete zoom matches the hierarchical mental model and keeps interaction simple (click under cursor). Limiting to the parent/child lineage (±2) enlarges a useful patch without blowing up unrelated parallel regions.

## 2026-07-17 — Hover details for entry/exit/after and on

**Context:** Icons and the compact `on:` summary hide the concrete actions/transitions.

**Decision:** CSS hover (and focus-within) popups list authored entry/exit actions, delayed `after` transitions, and `on` transitions as bullet lines (event → target · guard · actions). Filter injected after raise/cancel from entry/exit lists.

**Rationale:** Keeps the tree dense while making details one hover away; no portal/JS tooltip library needed for the PoC.

## 2026-07-16 — Drop type labels; mark initial and final visually

**Context:** Labels like ATOMIC / COMPOUND / PARALLEL waste space and duplicate what hierarchy already shows (children ⇒ compound; vertical vs horizontal ⇒ sequential vs parallel).

**Decision:** Remove type text badges. Mark the parent’s initial child with a classic filled-dot + arrow on the left edge. Represent `final` states with the UML double-circle icon beside the name.

**Rationale:** Structure is inferred from layout; initial/final need explicit glyphs because they are not layout properties.

## 2026-07-16 — Hierarchy determines state layout direction

**Context:** A hierarchical view communicates machine structure more directly than drawing every transition as crossing arrows.

**Decision:** Preserve state document order and render compound/sequential children top-to-bottom. Render the direct regions of a parallel state left-to-right as non-wrapping columns. Nested nodes independently apply the same rule according to their own type.

**Rationale:** Vertical order reads as sequence, while horizontal adjacency gives immediate visual context that parallel regions are concurrently active.

## 2026-07-16 — Visualizer is an API; React/CSS are optional

**Context:** Real usage will not host the visualizer in-page — only the popup. React buttons and viz CSS must not be required by the machine host.

**Decision:**
- Core surface is `createVisualizerHost()` in `src/viz/` (no React, no CSS): `inspect`, `openPopup()`, `showInline()` / `hideInline()` / `toggleInline()`, `subscribe()`, `dispose()`.
- Optional React renderers + `visualizer.css` live under `src/ui/` and are imported only by PoC / popup pages.
- PoC host exposes the same API as `window.viz` so launches work from the console without UI.
- PoC buttons are thin wrappers around API calls, not the source of truth.

**Rationale:** Matches the hidden-iframe deployment: ship a tiny inspect + postMessage bridge with the machine; load visualizer UI only in the popup (or a local debug page).

## 2026-07-16 — Popup went "connected" but stopped receiving updates

**Context:** Host and popup both showed connected, but only the host UI updated.

**Finding:** React StrictMode remounts the popup effect: cleanup sent `@viz.bye` (host nulled `this.popup` and went idle), then the remount sent `@viz.hello` (host set status back to `connected` and called `replay()`). Because `this.popup` was still null, every `post()` was a no-op. Status lied; the pipe was dead.

**Decision:**
1. On `@viz.hello`, always re-bind `this.popup` from `event.source`.
2. Only honour `@viz.bye` when `event.source === this.popup`.
3. Send `@viz.bye` on `pagehide` (real close), not on React effect cleanup.

## 2026-07-16 — Inline and popup visualizers are independent

**Context:** Closing the popup was restoring (or implying) an in-page visualizer. In the real embed the host is often hidden, and the two surfaces are discrete choices.

**Decision:** Start with **no** visualizer. Provide separate controls — “Show/Hide inline visualizer” and “Open popup visualizer”. Either, both, or neither may be active. Closing the popup does not open the inline view.

**Rationale:** Matches the deployment model (hidden iframe host + optional debugger UI) and avoids surprising auto-open behavior.

## 2026-07-16 — Popup visualizer over `postMessage` (iframe-compatible)

**Context:** The real machine will run in a hidden iframe embedded in another site, with limited permissions. We need the visualizer in a separate popup window, receiving events from the host.

**Decision:** Use `window.postMessage` with `targetOrigin: "*"` between the host (iframe) and a popup opened via `window.open` from a **user gesture**. Custom protocol (`@viz.hello` / `@viz.machine` / `@viz.snapshot` / `@viz.log`) with sticky replay of machine + latest snapshot when the popup connects. Pages: `/` (host), `/visualizer.html` (popup), `/embed.html` (demo outer page with hidden iframe).

**Rationale:** Most compatible option under constrained permissions:
- Works cross-origin (iframe origin ≠ popup origin).
- No BroadcastChannel / SharedWorker / storage — those fail or are same-origin–limited in sandboxed / multi-origin embeds.
- Matches the approach `@statelyai/inspect` already uses (`BrowserAdapter` + `@statelyai.connected`).
- Payload must be portable JSON (functions stripped) because live `actorRef` / `logic` cannot cross the message boundary — structure is captured on the host first, then shipped.

**Embed constraints to remember:** sandboxed iframes need `allow-scripts`, `allow-popups`, and usually `allow-popups-to-escape-sandbox`. Popup open must be a click (blockers are harsher inside iframes).

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
