## 2026-07-23 — Pause freezes the visualizer view (not the actor)

**Context:** While debugging, live inspect traffic rotates the event log and advances the tree before the user can inspect an interesting moment. Pause is cross-machine (all actors in the view), UI-only.

**Decision:** **Pause** / **Resume** beside Appearance. Pause freezes the full displayed snapshot (every machine’s frames + log) and inserts a `--- PAUSED` log marker. While paused, live host updates are ignored. **Resume** re-engages: adopt live frames/machines, but **do not** import interim log rows (`seq <= watermark` at resume). Host/actors keep running; no host API or protocol change.

**Rationale:** Neutral-gear disengage is a visualizer concern; skipping catch-up keeps the paused moment’s history intact with an explicit gap marker.

---

## 2026-07-23 — Persist layout + watches in localStorage

**Context:** Column widths / collapse and watch lists reset on every visualizer reload; theme already persisted.

**Decision:** Store `viz.layout` (watch/side open + widths) and `viz.watches` (paths keyed by machine **name/`label`**, best-effort) in `localStorage`. Do **not** persist selected actor or history pin. Duplicate labels (or unnamed machines falling back to `sessionId`) can share or lose watches — user can unwatch spurious entries.

**Rationale:** Layout prefs are stable; name-keyed watches usually survive host restart when machine ids are stable, which is more useful than precise per-session isolation.

---

## 2026-07-23 — Log all inspect kinds; default per-session cap 100

**Context:** Keeping `@xstate.event` / `@xstate.action` / `@xstate.snapshot` (etc.) fills the per-machine ring quickly at 20. Action rows also showed no type/payload because summarization only read `event` / snapshot `value`.

**Decision:** Keep logging all inspection kinds. Summarize `@xstate.action` as `eventType = action.type`, `value = action.params`; `@xstate.event` keeps `eventType` and stores the scrubbed event object as `value`. Raise `DEFAULT_MAX_LOG_ENTRIES_PER_SESSION` to **100** (still per `sessionId`).

**Rationale:** Actions/events are useful for debugging; a higher per-machine cap absorbs the extra rows without bringing back global eviction across actors.

---

## 2026-07-23 — Per-machine event-log retention (default 20)

**Context:** A single global log cap let chatty actors (spawners, blinkers) evict history for quieter machines while scrubbing — useless while live events keep arriving.

**Decision:** Cap at **20 entries per `sessionId`** by default (`DEFAULT_MAX_LOG_ENTRIES_PER_SESSION` / `maxLogEntries`). Host snapshot log, popup receiver, and deferred reconnect buffers all trim per session. Interleaved “all machines” view still merges retained rows; parent/child timelines can drift relative to each other — accepted.

**Rationale:** Protects interesting machines’ history without growing unbounded; matches the existing per-machine filter/history mental model.

---

## 2026-07-23 — Snapshot log history scrubbing (view-only)

**Context:** Want to click past `@xstate.snapshot` event-log rows and re-see state/context/active overlay. Not actor rewind; child actors keep independent timelines; visualizer reload may drop history.

**Decision:** Attach the projected `VizFrame` on snapshot `VizLogEntry`s (`frame?`). UI pins that frame for tree / State / Context / next-events until “back to live”. Only snapshot rows are revisitable. Host deferred popup replay strips `frame` (latest live frame still replays); live `@viz.log` keeps frames for the open session.

**Rationale:** Reuses existing projection; no protocol control channel; memory bounded by log cap; reconnect stays cheap.

---

## 2026-07-23 — Event log “filter to current machine”

**Context:** The host keeps one shared `log: VizLogEntry[]` across all inspected actors. Each entry already carries `sessionId` (from `actorRef.sessionId`). The Event log tab showed the full interleaved timeline, which is confusing when multiple machines receive different events.

**Decision:** Keep the shared host log; add a UI checkbox **Filter to current machine** (default on) that shows only entries whose `sessionId` matches the selected actor. Unchecked restores the full host timeline.

**Rationale:** `sessionId` is exactly the actor key used for machines/frames selection — no protocol change needed. Richer event-log product filtering stays out of scope.

---

## 2026-07-22 — Shift+wheel → horizontal pan (mouse-only remap)

**Context:** Vertical mouse wheels commonly use Shift to scroll horizontally. Trackpads already emit `deltaX`/`deltaY` for two-finger pan.

**Decision:** On the pan path only, if `shiftKey && deltaX === 0 && deltaY !== 0`, treat `deltaY` as horizontal. Do not remap when `deltaX` is already non-zero (native trackpad axes, or browsers that already swapped Shift+wheel into `deltaX`). Zoom path (Ctrl/Cmd / drag mode / pinch) ignores Shift.

**Rationale:** Gives mouse users the expected affordance without inventing a device detector. Trackpad diagonal/horizontal scrolls stay intact; accidental Shift + purely vertical trackpad scroll is the only mild remap edge case.

---

## 2026-07-22 — Drag-mode wheel zooms without Ctrl/Cmd

**Context:** Space / right-button pan mode did not change wheel handling. Unmodified `wheel` always panned, so a mouse wheel needed Ctrl/Cmd to zoom even while already in drag mode. Ideal map UX: wheel zooms in drag mode; the modifier is only for flipping trackpad two-finger scroll to zoom when *not* dragging.

**Finding (input Venn):** Browsers do **not** expose distinct “mouse wheel” vs “trackpad scroll” vs “pinch” APIs on the common path. Almost everything is one `WheelEvent`:
- Mouse wheel notches and trackpad two-finger scroll → plain `wheel` (often `deltaMode` pixel vs line, but not reliable across OS/browser).
- Chromium/Firefox trackpad pinch → `wheel` with **`ctrlKey: true` synthesized** (user is not holding Ctrl).
- Intentional Ctrl/Cmd+scroll → same `ctrlKey`/`metaKey` + `wheel`.
- Safari trackpad pinch → separate non-standard `gesturestart` / `gesturechange` (scale).
- Touch pinch is not handled as a first-class path here beyond whatever the browser maps into the above.

So the “device” split is a **modifier + Safari gesture heuristic**, not a clean Venn diagram. We cannot zoom-only-for-mouse and pan-only-for-trackpad without guessing.

**Decision:** While Space is held or a Space/right-button drag is active, plain `wheel` zooms (same path as Ctrl/Cmd+wheel). Outside drag mode, keep plain wheel → pan and Ctrl/Cmd|pinch → zoom. Drag itself remains the pan gesture in drag mode.

**Rationale:** Gives mouse users unmodified zoom once they enter pan mode, without inventing a fragile mouse-vs-trackpad detector. Tradeoff: Space + two-finger trackpad scroll also zooms; pan then via the drag.

---

## 2026-07-20 — Publish host/protocol under `@r-a-i-t-h`; deploy visualizer separately

**Context:** Packages were private `@viz/*` workspaces. Goal is real npm publish so workplace Artifactory (proxying npmjs) can install them. `@raith` on JSR does not imply an npm scope; Artifactory does not reliably proxy JSR.

**Decision:** Rename publishable packages to `@r-a-i-t-h/viz-protocol` and `@r-a-i-t-h/viz-host` (public npm). Keep the inspector as private workspace `@r-a-i-t-h/viz` and deploy `apps/visualizer/dist/` as the `visualizerUrl` — not an installable component library. Demo stays private as `@r-a-i-t-h/viz-demo`. Wire message type strings (`@viz.*`) stay unchanged.

**Rationale:** Hosts only need the host library on npm; the UI is a standalone inspector URL. Publishing to registry.npmjs.org (not JSR-only) matches Artifactory’s usual npm upstream.

## 2026-07-20 — Kill document elastic overscroll in the popup

**Context:** Trackpad pan/zoom on the graph still rubber-banded the popup window (macOS elastic overscroll) even when the page had nowhere to scroll.

**Decision:** Lock the visualizer document (`html`/`body`/`#root` and `.viz--popup`) with `overflow: hidden` + `overscroll-behavior: none`. Side panels use `overscroll-behavior: contain`; the tree viewport uses `none` and stops wheel propagation.

**Rationale:** The popup is a fixed tool surface, not a document; bounce is pure noise while navigating the graph.

---

## 2026-07-20 — Graph viewport pan + pure scale zoom

**Context:** The tree used native `overflow: auto` for two-finger scroll, but there was no pinch / Ctrl|Cmd+scroll scale. Click neighborhood zoom (`node--zoom-large` / `node--zoom-small`) is for attention, not map-style magnification.

**Decision:** Wrap the state tree in `TreeViewport`: wheel pan (trackpad two-finger scroll), Ctrl/Cmd+wheel and Safari `gesture*` pinch apply a CSS `translate` + `scale` on `.viz__tree-canvas` (`viewportTransform.ts`). Overflow on `.viz__tree-scroll` is `hidden` so the wrapper owns the wheel. Reset transform when the selected actor session changes. Keep neighborhood zoom unchanged.

**Rationale:** Local debugging needs free pan/scale over dense graphs without conflating “look at this region” with “magnify the canvas.”

---

## 2026-07-19 — Late inspect via `actor.system.inspect`

**Context:** For local debugging it is useful to know whether `inspect` is construction-only or can be attached to an already-created actor (e.g. without touching every `createActor` call site).

**Finding:** XState v5 registers `createActor(machine, { inspect })` on the **actor system** (root only). The same observer can be attached later with `actor.system.inspect(viz.inspect)`, which returns a subscription. `@r-a-i-t-h/viz-host` still only projects structure from `@xstate.actor`; attaching **after** `start()` misses that event, so the popup gets snapshots/logs without a machine tree. Attach before `start()` (or pass `inspect` at construction) for a usable viz.

**Decision:** Document both paths and the timing caveat in [`HOST-INTEGRATION.md`](./HOST-INTEGRATION.md); note `system.inspect` in [`INSPECT-V4-VS-V5.md`](./INSPECT-V4-VS-V5.md).

**Rationale:** Late attach is a real XState capability and valuable for opt-in local debugging; the `@xstate.actor` dependency is easy to miss without an explicit warning.

---

## 2026-07-19 — Disable text selection in visualizer UI

**Context:** Click/drag across the graph, panels, and chrome was selecting labels and other text, which fought hover and resize interactions.

**Decision:** Set `user-select: none` on `.viz`; keep `user-select: text` on inputs, textareas, and `.viz__code` so values can still be copied.

**Rationale:** The visualizer is primarily interactive, not a document surface; selective re-enable preserves copy for the few places it matters.

---

## 2026-07-19 — Demo BAIL event for guarded bubble + dual targets

**Context:** Needed a live example of next-event hover with two amber providers and two red targets (deep guarded handler + ancestor fallback).

**Decision:** Add `BAIL` on `running.engine.active` (`guard: isReady` → `paused`) and on `running` (→ `idle`). Send button in the demo host. After `START`, hover `BAIL` in next events.

**Rationale:** `NUDGE` only covered multi-provider action-only; this exercises the source/target colour split with a real cond bubble.

---

## 2026-07-19 — Transition hover: amber source, red target

**Context:** Next-event hover painted providers and destinations the same amber. Context deps already used red=write/change and amber=read/relevant.

**Decision:** Split transition highlights into **source** (handler / consuming state, amber) and **target** (destination, red). Graph `on:` / badge / watch hovers keep target-only (red). Next events set both. Context assign/consume colors unchanged (already match the metaphor).

**Rationale:** One consistent rule — amber = relevant locus, red = change — across transitions and context deps.

---

## 2026-07-19 — Next-event hover is graph highlight only

**Context:** Next-event rows used `HoverTip` for the cond cascade. A close-timer race cleared graph highlights while the tip could stay open; the cascade tip also duplicated what hovering `on:` on the graph already shows, and was hard to read as a side-panel affordance.

**Decision:** Next-event hover only highlights providers/targets on the graph (native `title` keeps a compact cascade summary). Fix `HoverTip.open` to always re-assert `onActiveChange(true)` so close-timer races cannot leave highlights cleared while the tip remains. Cond-cascade detail stays on graph event tips.

**Rationale:** The unique value of the next-events list is “what can fire from here + where does it live”; ordered cond detail belongs next to the declaring `on:` on the tree.

---

## 2026-07-19 — Next events are plain rows with sort modes

**Context:** Next-event chips wrapped poorly for long event names; list order was Map insertion from a shallow DFS (roughly ancestors-first, not an intentional sort).

**Decision:** Render each next event as a context-style plain row. Sort controls: **shallow** (min provider depth ascending — ancestors top), **deep** (min provider depth descending — ancestors bottom), **name**. Depth comes from the live machine tree in the renderer.

**Rationale:** Long event types need a full row; graph depth is the meaningful order for bubbling handlers.

---

## 2026-07-19 — Right column is tabbed (State / Context / Event log)

**Context:** The end-side inspector stacked six fold sections (current state, status/output, next events, context, context deps, event log). Status/output mostly duplicated the tree status badge; the raw context-deps JSON dump was low value as a default surface.

**Decision:** Replace the stacked folds with tabs — **State** (foldable current value as plain text + foldable next events; spawn `input` / done `output` only when present), **Context** (inspector; deps graph via “Show context deps” / “Copy deps”, hidden by default), **Event log**. Drop the standalone Status/output fold and bordered code chrome around current state — keep fold headers so large values can collapse.

**Rationale:** One job per tab; keep the dense dumps discoverable without owning the default viewport; folds remain so next events stay reachable when state value is huge.

---

## 2026-07-19 — Visualizer light mode via Appearance theme toggle

**Context:** The visualizer UI was dark-only with hardcoded hex colors. Appearance already grouped zoom range and badge visibility as renderer-local prefs.

**Decision:** Introduce CSS custom properties on `:root` and `.viz` (cool slate dark defaults + matching light overrides under `data-theme="light"`), add a Dark/Light segmented control in Appearance, persist the choice in `localStorage` (`viz.theme`), and sync `document.documentElement` `data-theme` whenever the theme changes so body-portaled hover tips inherit tokens. Page `color-scheme` / chrome sync stays popup-only (`syncDocumentTheme`) so inline embeds do not restyle the host page background.

**Rationale:** Keeps theming in the renderer (not protocol/host), reuses the Appearance extension point, and avoids host-page chrome flicker when the demo shows an inline viz. Tokens must live on `:root` because `HoverTip` portals to `document.body` outside `.viz`.

---


**Context:** After splitting builds, outDirs were briefly `dist/visualizer/` and `dist/demo/` at the repo root — a collect-at-root shape that fought the workspace mental model (`packages/*/dist`).

**Decision:** Each app emits to its own `dist/` (`apps/visualizer/dist/`, `apps/demo/dist/`), matching Vite’s default and the packages.

**Rationale:** One pattern for every workspace package/app; less cognitive friction when finding deploy artifacts.

---

## 2026-07-19 — Separate demo and visualizer build artifacts

**Context:** Root Vite was a single MPA writing `index.html`, `viz.html`, and `embed.html` into one shared `dist/`, even though the visualizer is meant to be independently hostable.

**Decision:** Each app owns its Vite config and emits to its own `dist/` — `apps/visualizer/dist/` (standalone popup page) and `apps/demo/dist/` (PoC host + embed). Local `npm run dev` runs two servers (:5173 demo, :5174 visualizer); demo points at the visualizer via `VITE_VISUALIZER_URL` (defaults to the local visualizer origin).

**Rationale:** Matches “ship only the visualizer” for real embeds; demo/embed stay PoC-only and no longer couple deploy artifacts.

---

## 2026-07-19 — Visualizer build is subdirectory-safe

**Context:** Independently hosted visualizer may be served under a path prefix (not domain root). Absolute `/assets/…` URLs broke that.

**Decision:** Vite `base: './'` so built visualizer HTML references assets relatively. Deploy the HTML alongside its `assets/` folder anywhere (or on another origin); pass that absolute page URL as `visualizerUrl`.

**Rationale:** Matches “visualizer hosted completely independently” without requiring a fixed deploy path.

---

## 2026-07-19 — Monorepo package split

**Context:** Host and visualizer should share only Viz*/wire types; the visualizer will be hosted independently; consuming apps need a linkable host library.

**Decision:** npm workspaces with `@r-a-i-t-h/viz-protocol` (Viz* + `@viz.*` + `connectPopupReceiver`), `@r-a-i-t-h/viz-host` (inspect/project/HostBridge; depends on protocol; peer xstate), `apps/visualizer` (React UI, protocol only), and `apps/demo` (PoC host). Each app builds to its own `dist/` (`apps/*/dist/`). Packages emit `dist/` via `npm run build:packages`.

**Rationale:** Enforces the host↔viz boundary in package deps; demo stays for local development; real apps take `@r-a-i-t-h/viz-host` (+ transitive protocol) and a separate visualizer URL.

---

## 2026-07-18 — Host popup integration guide

**Context:** Real deployments use a (often hidden) host that only opens the popup visualizer; the PoC React shell obscures what an existing app must wire.

**Decision:** Document host-only requirements in [`HOST-INTEGRATION.md`](./HOST-INTEGRATION.md): `createVisualizerHost` + `inspect` on actors + reachable `visualizerUrl` + `openPopup()` from a user gesture. Link from README, AGENTS, and ARCHITECTURE. React/CSS/inline/`subscribe` remain PoC-only; note vendor-until-published and iframe sandbox caveats.

**Rationale:** The host API is the product surface; embedders need a single checklist without reading HostApp or the presentation-model package sketch.

---

## 2026-07-18 — Actors, cascade, history, sanitize

**Context:** Highest-value remaining features after v4-equivalent coverage: multi-actor legibility, dump completeness, cond cascade, history glyph, host sanitize.

**Finding/Decision:**
- Capture `actorRef._parent?.sessionId` and `options.input` on `@xstate.actor`; store on `VizMachine.parentSessionId` / `input`. Actor select is a shallow indented forest with per-frame status.
- Before portable frames, walk live context (+ `snapshot.children` id→sessionId) and replace ActorRefs with `{ __viz: 'actorRef', sessionId, id }` so spawn links survive JSON; Context panel click selects that session.
- `VizFrame.status` / `output` and machine `input` surface in a Status/output dump panel.
- `collectNextEvents` emits ordered `candidates` + `highlightIds` (providers ∪ targets); Next events hover shows numbered cond cascade.
- History nodes emit a `history` badge + H glyph; hover highlights explicit target or owning parent.
- Host options `sanitizeContext` / `sanitizeEvent` (Stately-shaped): context sanitize runs after actor-ref enrichment; event sanitize applies before log `eventType`.

**Rationale:** Multi-actor shape is the biggest usefulness jump; dump/cascade/history are cheap completeness; sanitize is embedding hygiene without tree chrome.

---


## 2026-07-18 — Always / invoke badges from live StateNodes

**Context:** Structure markers for eventless `always` and invoke `onDone`/`onError` were still empty in the projector; demos needed visible coverage.

**Finding:** XState v5’s serializable `logic.definition` omits `always` entirely. Live `logic.root` / `logic.states` expose `.always` with resolved targets. Invoke metadata is on both; done/error land in `definition.on` as `xstate.done.actor.*` / `xstate.error.actor.*`.

**Decision:** Walk definition for structure/events, enrich from the parallel live StateNode for `always` + `invoke`. Exclude done/error actor events from ordinary `events` and surface them under an `invoke` badge (label `onDone` when done transitions exist). Hover highlights done/error/always targets like `after`.

**Rationale:** Popup stays on Viz* only; capture fails at projector build time if XState reshapes live nodes.

---

## 2026-07-18 — Context key ages + next-events list

**Context:** Legacy viz showed how many events ago each context key changed; also needed the set of events the active configuration can handle (including ancestor bubbling).

**Decision:** Host tracks shallow top-level context diffs across snapshots and emits `VizFrame.contextKeyAges` (0 = changed this frame). Projector also emits `nextEvents` with `providerIds` from active paths (ancestors already in `activePaths`, plus root). Context panel shows the age counter with a short fade; Next events panel hover highlights providing states via the existing target-highlight surface.

**Rationale:** Ages must be host-side so popup replay stays consistent; next-events are portable facts on the frame, not React-only derivation.

---

## 2026-07-18 — Reverse dep-graph hover: entity → context keys

**Context:** Priority 1 already highlights states when hovering a context key; the other direction was still open.

**Decision:** Hovering an action/guard (entry/exit tip rows, event tip `if`/`do` rows, watch-card symbols) looks up `contextDeps` edges from that entity and highlights Context panel keys: **red** assign (`writes`), **amber** consume (`reads`); assign wins on overlap. Tip open = union of listed entities; hovering a tip row narrows to that entity. Interactive tip popups use `pointer-events` + a short close delay so the cursor can cross the gap into the portaled list.

**Rationale:** Same assign/consume colors as the forward direction, no new tree chrome; entity ids stay `action:…` / `guard:…` matching the analyzer.

---

## 2026-07-18 — Context key tooltip shows assign/consume counts

**Context:** Linked context-key hover title said “Hover to highlight…” which is redundant (the tooltip only appears on hover) and doesn’t help when highlighted states are scrolled out of view. Unlinked keys mentioned “dep-graph”, an implementation detail.

**Decision:** Every context-key title shows `N assign · M consume` from `stateIdsForContextKey` (same sets used for graph highlight), including `0 assign · 0 consume` when nothing matches.

**Rationale:** Counts clue the user that matches exist even when some highlighted nodes aren’t visible; zero counts replace educational/implementation wording without new UI chrome.

---

## 2026-07-18 — Host-side projection to shared Viz model

**Context:** Avoid popup duck-typing of portable XState JSON (`on`, `xstate.after`, homemade `StateNodeDefinition`) so a future XState reshape fails at **build time in the projector**, not as silent missing badges.

**Decision:** Implemented. Terminology: **inspection** = XState inspect stream; **projection** = `projectMachine` / `projectFrame` over live `logic`; **viz model** = shared `Viz*` types. Host stores/sends `VizMachine` / `VizFrame` (`@viz.machine` / `@viz.frame`). UI consumes only `VizNode` badges/events/details. Removed `inspection.ts` mirror, `nodeDetails.ts`, `lifecycleBadges.ts`.

**Rationale:** One XState-facing module; iframe and popup share TS types for create/consume of the viz model over `postMessage`.

---

## 2026-07-18 — Sketch VizPresentationModel (typed host → portable viz)

**Context:** Clarifying whether moving interpretation into the iframe helps us use XState’s types so the popup need not reinvent states/transitions/actions/guards; and sketching the wire schema for Salesforce hidden-iframe → popup.

**Finding/Decision:** Documented in [`VIZ-PRESENTATION-MODEL.md`](./VIZ-PRESENTATION-MODEL.md). Benefit is **not** free understanding from `@statelyai/inspect` — it is concentrating XState structural types in one `projectMachine`/`projectFrame` adapter and shipping `VizMachine`/`VizFrame` so the popup never duck-types `on` / `xstate.after` / transition shapes. Today’s UI (`lifecycleBadges`, `nodeDetails`, local `StateNodeDefinition` mirror) is exactly that reinvention on untyped portable definition JSON.

**Rationale:** Same subset selection either way; the win is a typed boundary and a viz-native wire vocabulary. Prefer **build errors in the iframe projector** when XState renames/reshapes fields (e.g. a hypothetical v6) over **silent runtime gaps** in the popup where duck-typed paths like `node.entry` become undefined and badges simply disappear.

---

## 2026-07-18 — Documented inspect v4 → v5 for own-rolled visualizers

**Context:** Clarifying how `@xstate/inspect` (v4) differs from built-in XState v5 inspect + `@statelyai/inspect`, and which TypeScript model a custom visualizer should navigate.

**Finding/Decision:** Wrote a detailed reference at [`INSPECT-V4-VS-V5.md`](./INSPECT-V4-VS-V5.md). Core takeaway: neither package provides graph-traversal helpers; structure comes from `actorRef.logic.definition` (`StateNodeDefinition`); runtime from `MachineSnapshot` / `StateValue`. Raw v5 `InspectionEvent`s do not embed the machine graph; `@statelyai/inspect` stringifies authored `logic.config` for transport, not the normalized definition.

**Rationale:** Captures the research once so future model-coverage work (see `TODO.md`) does not rediscover the capture strategy.

---

## 2026-07-18 — Context key hover highlights assign vs consume states

**Context:** Dep-graph is on `CapturedMachine`; Priority 1 wants hover a context key → related states.

**Decision:** Context panel lists top-level keys; hovering a key highlights graph/watch nodes from `contextDeps` edges: **red** (`node--context-assign`) for `writes`, **amber** (`node--context-consume`) for `reads`. If a state both assigns and consumes, assign wins. Keys with no edges remain visible but do not light the tree.

**Rationale:** Matches the requested assign/consume colors without new chrome; reuses the same node highlight surface as transition targets.

---

## 2026-07-18 — Context dep-graph from live logic + config

**Context:** Priority 1 needs a static graph of which actions/guards/invokes read or write context keys, and `toPortable` strips the functions that carry that info.

**Decision:** Run `analyzeContextDeps(logic)` inside `captureMachine` on the live host machine and ship a JSON `contextDeps` artifact on `CapturedMachine`. **Writes:** keys of `xstate.assign` `.assignment` (named actions resolved via `logic.implementations.actions`). **Reads:** best-effort `Function#toString` for `context.foo` / `context['foo']` on guards, action bodies, assign value fns, and invoke `input`. Walk `definition` for structure; when definition stores a stripped `{ type: 'xstate.assign' }`, fall back to the parallel authored `config` action. Prefer `definition.on` over duplicate `transitions` / `invoke.onDone` so edges are not doubled. Opaque entities (no recoverable keys) stay in the node list with `coverage: 'opaque'`.

**Rationale:** Assignment maps and inline fns only exist before serialization. Partial `toString` coverage matches product scope (unmarked is OK). Config fallback is required because XState drops `.assignment` from some definition action slots (e.g. entry) while keeping it on `on` / config.

---

## 2026-07-18 — Product scope: map + hover debug, not gazetteer

**Context:** Reviewing `docs/TODO.md` against intended use: overview of structure, active markers, watch-based debugging — not a full XState inspector or a substitute for reading the machine config.

**Decision:** Product priorities are (1) visualize the most relevant high-value structure, (2) add live debugging context via hover/watches, (3) never replace reading the declarative config. Scope the UI as a structural map with light badges for non-`on` transition sources (`after`, `always`, `invoke`/`onDone`/`onError`, history) and hover+highlight for relationships. First implementation priority is a static context dependency graph (actions, guards, invokes → context keys) when a machine is first seen. Revive legacy behaviors where they fit: context-change fade over events; “next events” including ancestor bubbling with hover showing providing state(s). Explicitly out of scope for now: first-class guard chrome, microstep UI, event-log product filtering, send-from-viz control, drawing all transition edges. Keep host-side sanitize hooks as hygiene (scrub context/events before popup relay), not UI.

**Rationale:** Nesting/parallel and “you are here” matter more than linkages. Badges should flag states that can leave without a normal `on` handler. Dep-graph analysis unlocks rich debug hover without overloading the tree. Sanitize is silent host API (PII/secrets over `postMessage`), not gazetteer chrome.

---

## 2026-07-17 — Layers: host API vs interaction model vs renderer

**Context:** Clarifying whether zoom/highlight/watch belong inside React views or a separable model, and whether a “headless visualizer” would help bolt on other renderers later.

**Decision:** Document the split in `docs/ARCHITECTURE.md`. Prefer **host API** (`src/viz`) for inspect/snapshot/launch; **interaction model** for zoom/highlight/watches/selection (today: React state in `VisualizerView`); **renderer** for `src/ui`. Do not extract a headless interaction model until a second consumer needs the same behavior.

**Rationale:** The host is already headless; interaction is already an explicit lifted view-model with pure helpers. Formal extraction is cheap later and speculative now. “Visualizer API” / “headless visualizer” alone blur host vs session.

---

## 2026-07-17 — After transitions highlight targets

**Context:** Hovering an `on` event highlights its target nodes; delayed `after` transitions only showed text and left the graph unchanged.

**Decision:** Collect after-transition targets the same way as `on` (from `xstate.after.*` keys, falling back to delayed `transitions`). Hovering the after badge or the watch-card after block highlights those targets.

**Rationale:** After is just a delayed transition; spatial target feedback should match ordinary events.

---

## 2026-07-17 — Popup panels fill the viewport

**Context:** With the slim popup header, the side/tree panels still used the older `70vh` visualizer height and could stop short of the window bottom when content was small.

**Decision:** Popup layout now stretches the embedded visualizer as a column to the available viewport height; the panel row flexes to fill the remaining space and popup columns/tree drop their old max-height cap.

**Rationale:** A full-height inspection surface feels more like an IDE pane and keeps collapse/resize rails visually stable even when there is little content.

---

## 2026-07-17 — Popup header is title + status + actor

**Context:** The popup stacked a large “Visualizer” heading, connection pill, explanatory blurb, and a second VisualizerView header with actor/appearance controls.

**Decision:** One header row: “XState viz”, connection status pill, actor select (when needed), Appearance on the trailing edge. Drop the lead copy and redundant waiting/closed paragraphs — the pill carries that state.

**Rationale:** Maximizes graph space; connection and actor selection are the only chrome that must stay visible at a glance.

---

## 2026-07-17 — Resizable side columns with << / >> chevrons

**Context:** Watch and current-state collapse used wordy buttons that jumped between the header and panel headings, and column widths were fixed.

**Decision:** Both side columns always stay in the layout (zero-width rail when collapsed). A round triangle toggle on the shared inner divider collapses/expands; dragging the divider (not the button) resizes width (clamped). Flex layout replaces the old CSS-grid column templates.

**Rationale:** IDE-style edge controls keep collapse and resize in one place; a solid arrowhead reads clearer than `<<` / `>>` text.

---

**Context:** Graph zoom is good for structure, but watching a few states for active/inactive changes and config details is awkward when those nodes shrink with the overview zoom.

**Decision:** Alt-click (Alt-Enter) toggles a node into a collapsible left “Watched” column. Watch cards use a fixed readable size (no zoom), omit child nodes, show active styling, and expand collapsible path/id/type/tags/entry/exit/after/`on` details. Each card has a circular up/down/close control cluster (badge-style). Watches are ordered lists keyed by actor session; Shift/Cmd/Ctrl remain exclusive zoom.

**Rationale:** Alt was the free modifier after zoom claimed Shift/Cmd/Ctrl. A dedicated column keeps focus nodes readable while the graph stays overview-first. Up/down before drag-and-drop keeps reordering obvious and accessible.

---

## 2026-07-17 — Zoom styles scoped per node; label is “range”

**Context:** Changing zoom range updated node padding/margins, but keys/events stayed large because selectors like `.node--zoom-large .node__key` matched nested small nodes under a large ancestor.

**Decision:** Scope zoom chrome with the child combinator (`>`). Size `.node__key` / `.node__events` in `em` against each node’s own zoom `font-size`. Rename the Appearance control from “Zoom hops” to “Zoom range”.

**Rationale:** Each node’s zoom class is authoritative for its own chrome; nested large/small neighbors no longer fight. “Range” matches the ±N control without the graph-theory jargon.

---

## 2026-07-17 — Graph-level scroll; parallel regions size to content

**Context:** Parallel regions used `overflow-x: auto` and `1fr` columns, so a wide parent (e.g. `wideParallel`) clipped to the panel and scrolled its children internally.

**Decision:** Parallel child columns use `max-content` with no internal overflow. A single `.viz__tree-scroll` viewport around the state tree scrolls the whole graph when it exceeds the panel.

**Rationale:** Scrolling the graph as one surface matches how you read the machine; per-node scrollports hide sibling regions and fight zoom/hover.

---

## 2026-07-17 — Wide parallel stress machine for scroll decisions

**Context:** Parallel regions lay out left-to-right without wrapping; with only two regions in `demo`, overflow/scroll behavior is hard to judge.

**Decision:** Add `wideParallelMachine` as a third top-level actor: a compound root with 10 sequential siblings (each a nested a→b→c compound) plus a middle `band` parallel region of 12 columns. Selectable via the actor dropdown.

**Rationale:** Stretching both axes lets us confirm the single `.viz__tree-scroll` viewport pans the whole graph — not per-node overflow — before locking layout CSS.

---

## 2026-07-17 — Appearance settings group visual preferences

**Context:** Zoom hops occupied permanent header space, and additional visual preferences need a discoverable home.

**Decision:** Move zoom hops into a collapsible Appearance panel and add a default-on “Show badges?” option controlling the entry, exit, and after lifecycle badges.

**Rationale:** A single compact panel keeps the header clear and gives future appearance controls an obvious extension point. Badge visibility is renderer-local and does not change captured machine data.

---

## 2026-07-17 — Cumulative zoom anchors by default

**Context:** Exclusive click-to-zoom discarded other enlarged nodes, making it awkward to compare several distant parts of a complex machine. A first cut made plain clicks enlarge only the clicked node, which lost the ±hop neighborhood entirely.

**Decision:** Zoom state is a set of anchor paths; a node renders large when it is within ±zoomRadius hops of any anchor. Plain click toggles an anchor without touching the others; Shift/Cmd/Ctrl-click replaces the whole set with the clicked node (the old exclusive behavior); Escape clears all anchors. Enter/Space honor the same modifiers.

**Rationale:** Anchors keep the neighborhood semantics uniform for both interaction styles — cumulative zoom is just "more than one anchor" — while preserving quick isolation and a one-key reset.

---

## 2026-07-17 — Full-width layout; collapsible current-state panel

**Context:** The 1100px host/popup max-width and a 50/50 panel split starved complex machine trees of horizontal space.

**Decision:** Drop the overall max-width on host and popup shells. Machine structure takes remaining width (`minmax(0, 1fr)`); current state / context / event log sit in a narrower sidebar (`minmax(16rem, 22rem)`) that can be collapsed entirely (header “Show current state” to restore).

**Rationale:** Tree inspection is the primary job; JSON/log are secondary and can yield the viewport on demand without changing the host API.

---

## 2026-07-17 — TODO list for the rest of the XState model

**Context:** The hierarchical visualizer covers structure, lifecycle badges, `on` hover, active value overlay, and multi-actor selection — but most of the XState model (guards as UI, invoke/spawn, input/output, history, tags, richer actions, bidirectional control, etc.) is still thin or absent. `@statelyai/inspect` does not provide traversal helpers, so each feature needs local interrogation work.

**Decision:** Add `docs/TODO.md` as the living checklist of remaining model surface (plus demo-machine gaps), linked from the README and `AGENTS.md`. Check items off there as they land; record capture strategy in this log when non-obvious.

**Rationale:** Keeps “what’s next” out of the decision log while giving agents and humans a single place to extend coverage without rediscovering gaps.

## 2026-07-17 — Multi-actor capture with a selection dropdown

**Context:** The host previously kept one `machine` / one `stateValue`, so a second actor (e.g. a spawned child or a second `createActor` sharing `viz.inspect`) silently overwrote the first.

**Decision:** `VisualizerHost` now keys everything by `sessionId`: every `@xstate.actor` event with machine logic adds to a `machines` map, and `@xstate.snapshot` events update a per-session `actorStates` map. `VisualizerSnapshot` exposes `machines: CapturedMachine[]` (registration order) plus `actorStates: Record<sessionId, {value, context}>`. `HostBridge` replays *all* machines and latest per-session snapshots on popup (re)connect. The React view shows an actor dropdown when more than one machine is present; selection is a UI concern, not host state. A self-cycling `blinkerMachine` was added to the PoC so the dropdown is always exercisable.

**Rationale:** Actor registration already flows through the single `inspect` observer — the host just had to stop discarding it. Keeping selection out of the host API means two surfaces (inline + popup) can view different actors simultaneously.

## 2026-07-17 — `on` events reveal targets and conditional behaviour

**Context:** A compact event name does not show where it goes, while always showing transition details would make the hierarchy noisy.

**Decision:** Render each `on` event as its own hover/focus target. While active, highlight all of that event’s target state nodes. Show a bullet popup only when at least one transition for the event has a guard or actions; simple unguarded/actionless transitions highlight targets without a popup.

**Rationale:** Target highlighting gives immediate spatial context. Conditional/action details remain available precisely where needed without restating simple transitions.

## 2026-07-16 — Lifecycle badges on hierarchical state nodes

**Context:** Hierarchical layout already conveys structure; entry / exit / after are important but easy to miss without arrow-heavy diagrams.

**Decision:** Overlay small circular icon badges at the top-right of each state node (straddling the top border) for authored `entry`, `exit`, and `after`. Filter out XState’s injected `xstate.raise` / `xstate.cancel` actions so `after` does not falsely imply entry/exit badges. Detect `after` via `xstate.after.*` event keys / delayed transitions.

**Rationale:** Keeps the hierarchical view while giving an immediate “this node has lifecycle/timing behaviour” signal, matching the previous visualizer’s convention.

## 2026-07-17 — Zoom hop radius is on-screen configurable

**Context:** A fixed ±2 hop neighborhood is a reasonable default but too blunt for deep or shallow machines.

**Decision:** Expose `zoomRadius` on `StateTree` / `VisualizerView` (`defaultZoomRadius` prop) and an on-screen − / ±N / + control (clamped 0–8). Changing hops immediately re-evaluates which nodes around the current focus render large.

**Rationale:** Keeps click-zoom simple while letting the user widen or tighten the patch without code changes.

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

## 2026-07-21 — Popup self-close when host refreshes

**Context:** After a host page reload the popup could survive with a dead bridge; reconnect-on-refresh was considered but is heavier than needed.

**Decision:** On host `pagehide` (fires before unload on refresh/navigation), `HostBridge` sends `@viz.closed` to the popup. `connectPopupReceiver` closes the window on that message and polls `window.opener.closed` as a fallback when the host tab is closed without unload (crash/kill).

**Rationale:** Normal reload is covered by `pagehide` → `@viz.closed` → `window.close()`. The next `openPopup()` opens a fresh popup and the usual `@viz.hello` replay path applies. No re-handshake or optional window name required for this flow.

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
