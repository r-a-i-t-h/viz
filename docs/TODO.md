# Visualizer TODO

## Product scope

Priorities, in order:

1. **Visualizer first** — surface the most relevant, high-value information: nesting and parallel structure, active-state (“you are here”) markers, and light badges for states that can move for reasons beyond ordinary `on` handling.
2. **Live debugging second** — add context and understanding via watches, hover + highlight, and related aids.
3. **Not a code substitute** — do **not** try to replace reading the declarative machine config (once your eye skips the JSON noise, the source is already readable). Not a gazetteer of every XState concept.

**Prefer:** structure in the tree; badges for non-`on` transition sources; hover + highlight for relationships and debugging.

**Avoid:** first-class chrome for every guard/action/meta detail; drawing all transition linkages by default; turning the UI into a step debugger or remote control surface.

Capture: raw `inspect` on the host → **projection** (`projectMachine` / `projectFrame` in `@r-a-i-t-h/viz-host`) → shared `Viz*` model (`@r-a-i-t-h/viz-protocol`) over `postMessage`. New structure/badge features extend the **projector** (typed against XState), not popup duck-typing. See [`VIZ-PRESENTATION-MODEL.md`](./VIZ-PRESENTATION-MODEL.md).

---

## Already covered (baseline)

- [x] Host-side projection to `VizMachine` / `VizFrame` (popup consumes Viz* only)
- [x] Compound / sequential layout (top-down)
- [x] Parallel regions (left-to-right)
- [x] Atomic / final glyphs; initial arrow
- [x] Entry / exit / after badges + hover lists
- [x] `on` events: target highlight; hover when guards or actions exist
- [x] Active-state overlay from projected `VizFrame.activePaths`
- [x] Multi-machine actor registry + selection dropdown
- [x] Raw JSON dump of current `value` and `context`
- [x] Two-level click zoom with configurable hop radius
- [x] Watch column: Alt-click nodes; fixed-size cards with details + reorder
- [x] Independent inline / popup surfaces over `postMessage`
- [x] Wide parallel stress machine (12 regions) for scroll/overflow decisions

---

## Priority 1 — Context dependency graph (pre-analysis)

When a machine definition is first seen, run a static analysis over **actions, guards, and invokes** (named and inline where inspectable) and build a **dep-graph against context keys**: which keys are assigned, read (guards/actions), and wired through invoke input/output.

This unlocks hover + highlight without overloading the tree:

- [x] **Pre-analysis pass** — on new machine / definition change: walk `logic.definition` (+ setup registries when available); record assign targets, guard reads, action reads, invoke `input` mappings
- [x] **Hover a context key** — highlight states/actions/guards that assign or consume it
- [x] **Hover an assign / guard / action** — highlight the context keys it touches
- [x] **Partial coverage OK** — opaque inline functions without serializable paths stay unmarked; prefer names/types/params over rehydrating functions
- [x] **Demo** — `assign` that mutates several context keys; guarded transitions that read context

Record the capture strategy in [`DECISIONS.md`](./DECISIONS.md) when implementing.

---

## Structure markers (non-`on` transition sources)

Badges should make it obvious that a state may transition for reasons beyond named `on` handlers. Implement by extending **`projectMachine`** (emit `VizBadge` / `details.*`), not by teaching the popup XState shapes.

- [x] **`always` (eventless)** — distinct badge; hover list + target highlight (same pattern as `after`)
- [x] **`invoke` + `onDone` / `onError`** — badge on the state (invoke present); **`onDone` especially** as a clear non-`on` exit path; hover: src id, id, input summary, done/error targets + highlight
- [x] **History states** (`shallow` / `deep`) — dedicated glyph; restore target on hover when known
- [ ] **Named delays** — extend existing `after` hover with `setup().delays` names when present (badge already signals delayed exit)
- [x] **Demos** — `always`; `invoke` (promise) with done/error (`gate` + `fetching`); history (`running.signal.hist` + RESTORE); spawn (`worker` on START)

Already in this class: entry / exit / after badges.

---

## Hover + highlight debugging

- [x] **Next events (enabled / handled set)** — list events the active configuration can handle, including those inherited via ancestor bubbling (easy to miss when reading leaf-only `on`). Hover an event → highlight providing state(s); multiple providers possible when guards split handling across nodes
- [x] **Transition order / cond cascade** — on hover for an event: ordered candidates (“1. guard → … 2. else → …”), not graph layout
- [x] **Context change fade** — highlight context keys that just changed; fade intensity over subsequent events so recency is visible (legacy viz behavior)
- [x] **`spawn` ↔ sessionId** — link spawned actors in context to the actor registry (highlight / select)
- [ ] **Wildcard / partial events** — annotate in hover only (`*`, `foo.*`)
- [ ] **`reenter` / internal vs empty target** — clarify in hover tokens only

---

## Actors (light)

Structure and “you are here” across sessions — not a full actor debugger.

- [x] **Actor status** — active / done / error on registry entries
- [ ] **Non-machine actors** — promise / callback / observable / transition actors in the registry (even without a state tree)
- [x] **Parent / child actor tree** — shallow hierarchy once invoke/spawn badges exist (prefer over only a flat select)
- [x] **Final `output`** — when snapshot status is `done`, surface beside / instead of only context in the dump
- [x] **Machine / actor `input`** — show at registration (and in invoke hover); not graph chrome
- [x] **Demo** — `spawn` child

---

## Host hygiene

Silent host-side options; no tree chrome.

- [x] **Sanitize hooks** — host API options akin to Stately’s `sanitizeContext` / `sanitizeEvent` before popup/`postMessage` relay (scrub PII/secrets from dumps)
- [ ] **Builtin vs authored actions** — keep filtering injected `xstate.*` noise; surface intentional builtins in hover lists

---

## Explicitly out of scope (for now)

Do not schedule these unless product scope changes:

- First-class guard badges / compound-guard chips on the tree (hover + dep-graph is enough)
- Rich action-taxonomy UI beyond names/types in hover (taxonomy feeds analysis only)
- Tags / `meta` / `description` as node decoration (optional watch-card/hover later if needed)
- Microstep / `@xstate.transition` stream as a primary UI (step debugger)
- Event-log filtering product surface
- Bidirectional control (send events from viz back to the host actor)
- Drawing all transition edges by default (target highlight on hover remains the ceiling)

---

## Notes

- Prefer definition-driven structure in the **projector** (from `logic.definition`) over re-parsing stringified Stately `definition` blobs.
- Executable implementations from `setup()` will never round-trip over `postMessage`; UI should display **names / types / params**, not attempt to rehydrate functions.
- When adding a capability, record the capture strategy (which inspection event / which `logic` field / which `Viz*` field) in [`DECISIONS.md`](./DECISIONS.md).
