# VizPresentationModel — wire schema

**Status:** core implemented (2026-07-18).  
**Related:** [`INSPECT-V4-VS-V5.md`](./INSPECT-V4-VS-V5.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`TODO.md`](./TODO.md).

**Code:** shared types in [`src/viz/model.ts`](../src/viz/model.ts); projector in [`src/viz/project.ts`](../src/viz/project.ts); wire in [`src/viz/bridge/protocol.ts`](../src/viz/bridge/protocol.ts).

Deferred until TODO items land (projector emits empty slots today): history glyph richness, `byId` index.

---

## What problem this solves (typing, not capability)

### The hope

> Speak XState’s language in the iframe (full `logic` / official types). Emit **our** viz schema over `postMessage`. The popup never reinterprets states / transitions / actions / guards.

### What moving code to the iframe does **not** buy

- XState / `@statelyai/inspect` still does **not** call `toPresentationModel()` for you.
- Someone still writes a walk over their model and chooses a subset.
- You do **not** avoid understanding their concepts — you concentrate that understanding in **one adapter**.

### What it **does** buy (this is the real win)

Today the popup reinvents XState on **untyped / homemade** shapes:

| Today (popup / `src/ui`) | Cost |
|--------------------------|------|
| Local `StateNodeDefinition` mirror in `inspection.ts` | Diverges from `xstate` types silently |
| `node.on` / `node.transitions` duck-typing | Re-encode target shapes, delays, guards |
| `xstate.after.*` / `xstate.raise` / `xstate.cancel` filters | Re-encode injector conventions |
| `lifecycleBadges.ts`, `nodeDetails.ts` | XState folklore living in React |

That is “rewrite their basics” — not because the code runs in the popup, but because it walks an **XState-shaped JSON blob without importing `xstate`’s types**.

**Iframe (or any same-bundle host) adapter:**

```ts
import type {
  AnyStateMachine,
  StateNodeDefinition,
  TransitionDefinition,
  // …
} from 'xstate';

function projectMachine(logic: AnyStateMachine): VizMachine { /* … */ }
```

- The **only** module that imports XState structural types.
- When upstream renames fields or changes `TransitionDefinition.toJSON()`, **TypeScript breaks the adapter**, not twenty UI files.
- Prefer that failure mode over a hypothetical XState v6 where duck-typed popup code still typechecks against `unknown` / a homemade mirror, but `node.entry` (etc.) is missing at runtime and badges silently vanish.
- The popup depends only on `Viz*` types — no `on`, no `xstate.after`, no guard object shapes.

So: moving interpretation to the iframe is not about closer actor access. It is about **putting the XState→Viz boundary where official types are available**, and shipping a schema that no longer looks like XState.

```text
┌─ iframe (host package) ─────────────────────────────┐
│  AnyStateMachine / StateNodeDefinition (theirs)     │
│           │ project()                                │
│           ▼                                          │
│  VizMachine / VizFrame (ours)                        │
└──────────────────────┬──────────────────────────────┘
                       │ postMessage (JSON)
                       ▼
┌─ popup ─────────────────────────────────────────────┐
│  VizMachine / VizFrame only                          │
│  layout, badges, hover chrome, watches               │
│  zero imports from xstate structural APIs            │
└──────────────────────────────────────────────────────┘
```

Inline PoC can call `project()` in-process and skip the wire; same schema either way.

---

## Design principles

1. **One XState-facing module** — `projectMachine(logic)` / `projectFrame(snapshot, …)`. Nothing else imports `StateNodeDefinition` / `TransitionDefinition`.
2. **Wire = already chosen subset** — popup never filters `xstate.after` or injected raise/cancel; those decisions happened in `project()`.
3. **Names over functions** — actions/guards are `{ kind, name?, detail? }`, never callables.
4. **Ids are viz ids** — stable strings (`demo.running.engine`), `#` prefix already normalized.
5. **Derived analysis rides along** — e.g. `contextDeps` is part of the machine model, not recomputed from stripped JSON in the popup.
6. **Interaction stays in the popup** — zoom anchors, watch list, open tip; not part of the wire schema.
7. **Snapshots stay small** — structure once; runtime frames repeatedly.

---

## Wire protocol (messages)

Unchanged channeling spirit (`@viz.*`); payloads become presentation models.

```ts
/** Host → popup */
type VizDownstream =
  | { type: '@viz.machine'; payload: VizMachine }
  | { type: '@viz.frame'; payload: VizFrame }
  | { type: '@viz.log'; payload: VizLogEntry }       // optional / debug
  | { type: '@viz.closed' };

/** Popup → host */
type VizUpstream =
  | { type: '@viz.hello'; version: 1 }
  | { type: '@viz.bye' };
```

Rename `@viz.snapshot` → `@viz.frame` to signal “already projected,” not raw XState snapshot.

---

## Schema — structure (`VizMachine`)

Emitted once per actor session (and again if logic is replaced).

```ts
interface VizMachine {
  sessionId: string;
  /** Display name (machine id or fallback). */
  label: string;
  /** Machine root as a tree. */
  root: VizNode;
  /**
   * Optional flat index for O(1) highlight / watch resolve.
   * `root` alone is enough to render; `byId` avoids popup tree walks.
   */
  byId?: Record<string, VizNodeRef>;
  /** Static analyses computed against live logic on the host. */
  analysis: VizAnalysis;
}

/** Lightweight pointer if we don't duplicate full nodes in byId. */
type VizNodeRef = { id: string }; // or embed VizNode directly

interface VizNode {
  id: string;
  key: string;
  kind: VizNodeKind;
  /** Child layout hint — already decided from XState compound vs parallel. */
  layout: 'sequential' | 'parallel' | 'none';
  children: VizNode[];
  /** Which child ids are initial targets (for arrow glyph). */
  initialChildIds: string[];
  /** Compact badges — no raw entry/exit arrays. */
  badges: VizBadge[];
  /** Ordinary named events (not after/always/done — those are badges + lists). */
  events: VizEvent[];
  /** Longer copy for watch cards / hover — still viz vocabulary. */
  details: VizNodeDetails;
}

type VizNodeKind = 'atomic' | 'compound' | 'parallel' | 'final' | 'history';

interface VizBadge {
  kind: VizBadgeKind;
  /** Short label on the node chrome. */
  label: string;
  /** Lines for hover tip. */
  lines: string[];
  /** Node ids to highlight while this badge is hovered. */
  highlightIds: string[];
}

/**
 * Non-`on` (and lifecycle) markers. Projector maps XState concepts → these.
 * Popup only switches on VizBadgeKind.
 */
type VizBadgeKind =
  | 'entry'
  | 'exit'
  | 'after'
  | 'always'
  | 'invoke'
  | 'history';

interface VizEvent {
  /** Event type string as shown in the UI (`TICK`, not internal keys). */
  type: string;
  /** Ordered transition candidates (guard cascade). */
  transitions: VizTransition[];
  /** Union of all transition targets — for cheap hover highlight. */
  highlightIds: string[];
  /** Wildcard / partial annotation for hover only. */
  pattern?: 'exact' | 'wildcard' | 'partial';
}

interface VizTransition {
  /** Target node ids (empty = internal / no target). */
  targetIds: string[];
  guard?: VizSymbol;
  actions: VizSymbol[];
  reenter?: boolean;
  /** Delay label for after-transitions if surfaced under events (usually badge). */
  delayLabel?: string;
}

/** Named executable without the function. */
interface VizSymbol {
  kind: 'action' | 'guard' | 'actor' | 'delay';
  name: string;
  /** Optional params summary / assign key list, already stringified. */
  detail?: string;
}

interface VizNodeDetails {
  path: string;
  tags: string[];
  entry: VizSymbol[];
  exit: VizSymbol[];
  after: VizTransition[];
  always: VizTransition[];
  invokes: VizInvoke[];
  history?: 'shallow' | 'deep';
}

interface VizInvoke {
  id: string;
  src: string;
  inputSummary?: string;
  onDone: VizTransition[];
  onError: VizTransition[];
  highlightIds: string[];
}

interface VizAnalysis {
  /** Already shipped today as contextDeps — keep under analysis. */
  contextDeps: ContextDepGraph; // existing portable shape
  // future: nextEvents providers, etc. as portable facts
}
```

### What the projector absorbs (so the popup doesn’t)

| XState-ism (today in UI) | Becomes |
|--------------------------|---------|
| `type: 'parallel' \| 'compound' \| …` | `kind` + `layout` |
| `on['xstate.after.…']` / `delay` on transitions | `badges[{ kind: 'after' }]` + `details.after` |
| Injected `xstate.raise` / `xstate.cancel` in entry/exit | **Dropped** in projector; never appear in `details.entry` |
| `TransitionDefinition.target` as nodes or `#ids` | `targetIds: string[]` |
| `always` / invoke done/error | badges + `details.*` |
| Guard/action objects / strings / functions | `VizSymbol` |
| Context assign/read walk | `analysis.contextDeps` |

---

## Schema — runtime (`VizFrame`)

Emitted on each interesting snapshot (and on replay).

```ts
interface VizFrame {
  sessionId: string;
  /** Precomputed from StateValue — popup does not reimplement activePaths. */
  activeIds: string[];
  /** Scrubbed context for the dump panel. */
  context: unknown;
  status: 'active' | 'done' | 'error' | 'stopped';
  output?: unknown;
  /** Event that produced this frame, if any. */
  eventType?: string;
  /**
   * Optional: keys whose values changed vs previous frame (for fade).
   * Computed on host so popup need not deep-diff.
   */
  contextChangedKeys?: string[];
}
```

Optional later (still host-projected):

```ts
interface VizFrameExtras {
  /** Events the active configuration can handle + providing node ids. */
  nextEvents?: Array<{ type: string; providerIds: string[] }>;
}
```

---

## Schema — registry (multi-actor)

Host may send multiple `@viz.machine` messages. Popup keeps `Record<sessionId, VizMachine>` and latest `VizFrame` per session. Selection / dropdown = popup interaction state.

```ts
interface VizActorListItem {
  sessionId: string;
  label: string;
  parentSessionId?: string;
  status?: VizFrame['status'];
}
```

(Either embed list in a `@viz.registry` message or derive from machines received.)

---

## Mapping from today’s code

| Current | Presentation model |
|---------|-------------------|
| `CapturedMachine.definition` (XState-shaped) | `VizMachine.root` (+ badges/events already cooked) |
| `CapturedMachine.contextDeps` | `VizMachine.analysis.contextDeps` |
| `activePaths(value)` in React | `VizFrame.activeIds` from projector |
| `nodeLifecycleFlags` / `formatAfterTransitions` / `getOnTransitionTargetIds` | inside `projectMachine` |
| `StateTree` reading `node.on` | `StateTree` reading `node.events` / `node.badges` |
| `toPortable(definition)` | `toPortable(vizMachine)` — still needed, but input is already viz-shaped |

---

## Package split (iframe vs popup bundles)

```text
@viz/host          // iframe: createVisualizerHost, inspect, projectMachine, bridge
  depends on: xstate (types + runtime logic access)

@viz/protocol      // shared: VizMachine, VizFrame, message types only
  depends on: nothing (or tiny)

@viz/ui            // popup: React renderer
  depends on: @viz/protocol
  does NOT depend on: xstate
```

PoC host page may depend on both for inline viz; Salesforce iframe ships `@viz/host` only.

---

## Incremental adoption

No big bang required:

1. **Introduce `Viz*` types + `projectMachine`/`projectFrame`** next to today’s capture; still also ship raw definition for a release if needed.
2. **Point `StateTree` at `VizNode`** for one path (badges/events); delete `xstate.after` filters from UI.
3. **Stop sending raw `definition` / `config`** on the wire once UI is fully on `VizMachine`.
4. **Keep analysis on host** as new TODO items land (always/invoke badges, next events) — they extend `projectMachine`, not popup parsers.

---

## Non-goals of this schema

- Rehydrating a runnable `StateMachine` in the popup  
- Bidirectional control (send events into the iframe actor)  
- Pixel layout / zoom / watches on the wire  
- Mirroring every XState concept (meta, full action taxonomy, microstep stream)

---

## Open choices (decide when implementing)

1. **`byId` full nodes vs ids only** — memory vs highlight convenience.  
2. **Whether `details` is always populated or lazy** — watch-card richness vs payload size.  
3. **Log stream** — keep raw-ish `@viz.log` for debug, or drop until needed.  
4. **Version field** on `VizMachine` for forward-compatible wire evolution.

---

## Bottom line

| Question | Answer |
|----------|--------|
| Does iframe placement unlock Stately “free” understanding? | **No.** |
| Does it let us use **their TypeScript types** for the only code that must understand them? | **Yes.** |
| What do we emit? | **Our** `VizMachine` / `VizFrame` — not a portable XState definition. |
| What do we stop doing? | Teaching the popup `on`, `xstate.after`, target `#` ids, injected raise/cancel, etc. |
