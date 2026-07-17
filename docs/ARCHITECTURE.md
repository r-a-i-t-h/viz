# Visualizer layers

How inspection, interaction, and rendering split today — and when a further extract would be worth it.

## Preferred terms

| Term | Meaning | Where today |
|------|---------|-------------|
| **Host API** | Framework-agnostic inspect + snapshot store + popup/inline launch. What real embeds depend on. | `src/viz/` (`createVisualizerHost`, bridge, `inspection`) |
| **Interaction model** | Presentation/session behavior over a snapshot: zoom anchors, transition highlights, watches, selected actor, panel prefs. | React `useState` in `VisualizerView` (+ pure helpers under `src/ui/`) |
| **Renderer** | DOM/UI that displays host snapshot + interaction state. | Optional React PoC in `src/ui/` |

Avoid “visualizer API” alone — it blurs host vs interaction. Prefer **host API** for `src/viz`.

Avoid “headless visualizer” alone — the host is already headless. A future extract would be a **headless interaction model** (or session), not a second host.

## Current shape

```text
XState inspect
  → Host API (machines, actorStates, log, inline/popup status)
       → VisualizerSnapshot
            ├─ HostApp / PopupApp subscribe or postMessage
            └─ Renderer: VisualizerView
                 ├─ Interaction state (React-owned)
                 ├─ Pure helpers (zoom, nodeDetails, activePaths, …)
                 └─ Presentational tree / watch / chrome
```

- **Domain/runtime** lives only in the host snapshot. No zoom, highlight, or watches there.
- **Shared interaction state** is lifted in `VisualizerView` and passed as props/callbacks into `StateTree` / `WatchColumn`.
- **Leaf-local** UI (hover tip open, watch-card disclosure, fold open, resize gesture) stays in components.
- Inline and popup each mount their own `VisualizerView`, so interaction state is **not** shared across surfaces.

This is a React-owned view-model at the view root — not buried imperative DOM logic, and not a separate framework-agnostic module.

## What already extracts cleanly

Pure functions that any interaction model / renderer can reuse:

- Zoom neighborhood math (`zoom.ts`)
- Transition target id resolution (`nodeDetails.ts`)
- Active path derivation (`activePaths` in `inspection.ts`)
- Watch list mutate/reorder (logic today inline in `VisualizerView`)
- “Definition + interaction state → presentation facts” (active, zoom-large, transition-target, watched)

## What stays renderer-bound

- Hover → highlight *timing* and tip chrome
- Panel open / width / resize
- Input bindings (Escape, Alt-click, Shift/Cmd/Ctrl) — the *effects* are portable; the gestures are not
- CSS classes and layout

A headless interaction model should own state + intents, not mouse or CSS details.

## When to extract a headless interaction model

Worth doing when a **second consumer** needs the same behavior:

- Non-React renderer (canvas, Solid, web component, different webview kit)
- Non-DOM surface (e.g. tests asserting zoom/highlight/watch rules without mounting React)
- Syncing interaction across host inline + popup (today each mount is independent)

Until then, a formal store mostly renames lifted React state without changing product behavior. The current split does not paint into a corner: helpers are already mostly pure under `src/ui/`.

## Likely extract shape (if needed)

Pull `zoomAnchors`, `highlightedTargetIds`, `watchedBySession`, actor selection (and similar) out of `VisualizerView` into something like `createVisualizerSession(snapshot)` that:

1. Holds interaction state
2. Exposes intents (`toggleZoom`, `setHighlights`, `toggleWatch`, …)
3. Derives presentation facts for the current machine
4. Lets React (or anything else) subscribe and render

Keep `src/viz` as the **host API** only. Do not fold interaction into `VisualizerSnapshot` unless cross-surface sync becomes a real product requirement.

## Related

- Host vs React split: `docs/DECISIONS.md` — “Visualizer is an API; React/CSS are optional”
- Inline vs popup independence: same file — “Inline and popup visualizers are independent”
- Model coverage backlog: `docs/TODO.md`
