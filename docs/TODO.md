# Visualizer TODO — rest of the XState model

What the hierarchical visualizer already covers, and what remains. Items are grouped by XState concept. Prefer surfacing structure in the tree (badges, glyphs, hover) before adding side panels.

Capture still happens via raw `inspect` + `actorRef.logic.definition` — not `@statelyai/inspect` traversal helpers. New features should extend that local interrogation layer (`src/viz/inspection.ts`, `src/ui/lifecycleBadges.ts`, `src/ui/nodeDetails.ts`, `src/ui/StateTree.tsx`).

## Already covered (baseline)

- [x] Compound / sequential layout (top-down)
- [x] Parallel regions (left-to-right)
- [x] Atomic / final glyphs; initial arrow
- [x] Entry / exit / after badges + hover lists
- [x] `on` events: target highlight; hover when guards or actions exist
- [x] Active-state overlay from snapshot `value`
- [x] Multi-machine actor registry + selection dropdown
- [x] Raw JSON dump of current `value` and `context`
- [x] Two-level click zoom with configurable hop radius
- [x] Independent inline / popup surfaces over `postMessage`

## Transitions & conditions

- [ ] **Guards as first-class UI** — beyond `if <type>` in hover: dedicated badge / inline chip; compound guards (`and` / `or` / `not`); params when present
- [ ] **Eventless (`always`) transitions** — show and distinguish from named `on` events
- [ ] **Wildcard / partial event matching** — `*`, `foo.*`, etc.
- [ ] **`reenter` / internal vs external** — clearer than a trailing hover token
- [ ] **Forbidden / empty targets** — explicit “(internal)” vs missing target
- [ ] **Transition order / cond cascade** — multiple transitions per event; which would fire

## Actions

- [ ] **Richer action taxonomy** — `assign`, `raise`, `sendTo`, `forwardTo`, `cancel`, `enqueueActions`, `log`, `stopChild`, custom named actions
- [ ] **Action params / assign paths** — what context keys an `assign` touches (when serializable)
- [ ] **Builtin vs authored** — keep filtering injected `xstate.*` noise; surface intentional builtins

## Actors, invoke & spawn (ex-“services”)

- [ ] **`invoke` on state nodes** — badge + hover: src id, id, input mapping, onDone / onError targets
- [ ] **`spawn` / actor creators in context** — link spawned sessionIds to the actor dropdown
- [ ] **Parent / child actor tree** — hierarchy of sessions, not only a flat select
- [ ] **Non-machine actors** — promise / callback / observable / transition actors in the registry (even without a state tree)
- [ ] **Actor status** — active / done / error; stop events (`@xstate.actor` lifecycle completeness)

## Input / output

- [ ] **Machine / actor `input`** — show initial input on registration (and per invoke)
- [ ] **Final `output`** — when snapshot status is `done`, surface output beside / instead of only context
- [ ] **Invoke input/output wiring** — how parent maps child output into events / assigns

## Context & data

- [ ] **Context schema / shape** — beyond raw JSON: highlight keys touched by recent `assign`s
- [ ] **Per-state context relevance** — optional focus on context used by active node guards/actions
- [ ] **Sanitize hooks** — host API options akin to Stately’s `sanitizeContext` / `sanitizeEvent` before popup relay

## State-node features still thin or missing

- [ ] **History states** (`shallow` / `deep`) — dedicated glyph; restore target when known
- [ ] **Tags** — show `tags` on nodes (definition already has the field)
- [ ] **`meta` / `description`** — hover or detail pane for documentation metadata
- [ ] **Delayed transitions beyond after badge** — named delays from `setup().delays`
- [ ] **`entry`/`exit` action detail** — same richness as transition actions once taxonomy exists

## Runtime / inspection depth

- [ ] **Microsteps & transitions** — optionally consume `@xstate.microstep` / `@xstate.transition` (not only snapshots)
- [ ] **Next events / enabled transitions** — derive from definition + current state (v4 had this on `State`)
- [ ] **Event log filtering** — by session, type, domain event name
- [ ] **Bidirectional control** — send events from the visualizer back to the host actor (v4 inspect had this; v5 bridge does not)

## Demo machine gaps

Extend `src/machine.ts` (or add sibling demos) so each new viz affordance has something to render:

- [ ] Guarded transitions (simple + compound)
- [ ] `always` / eventless
- [ ] `invoke` (promise and/or child machine) with input/output
- [ ] `spawn` child
- [ ] History state
- [ ] Tags / meta
- [ ] Machine input + final output
- [ ] `assign` that mutates several context keys

## Notes

- Prefer definition-driven structure (from `logic.definition`) over re-parsing stringified Stately `definition` blobs.
- Executable implementations from `setup()` will never round-trip over `postMessage`; UI should display **names / types / params**, not attempt to rehydrate functions.
- When adding a capability, record the capture strategy (which inspection event / which `logic` field) in [`DECISIONS.md`](./DECISIONS.md).
