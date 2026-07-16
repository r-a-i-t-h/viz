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

## 2026-07-16 — Initial scaffold

**Context:** Starting a playground to explore XState machine visualization.
**Decision:** Scaffolded with Vite (`react-ts` template), added `xstate` v5 and `@statelyai/inspect`.
**Rationale:** Vite gives a fast dev loop; XState v5 is the current major; `@statelyai/inspect` connects running actors to the Stately Inspector for live visualization.
