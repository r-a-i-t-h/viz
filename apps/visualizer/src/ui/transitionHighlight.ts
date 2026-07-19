/** Graph highlight for transition relationships (hover). */
export type TransitionHighlight = {
  /** Where the event / transition is declared or handled (amber). */
  sources: Set<string>;
  /** Destination states (red — a change). */
  targets: Set<string>;
};

export const NO_TRANSITION_HIGHLIGHT: TransitionHighlight = {
  sources: new Set(),
  targets: new Set(),
};

export function targetHighlight(ids: Iterable<string>): TransitionHighlight {
  return { sources: new Set(), targets: new Set(ids) };
}

export function sourceAndTargetHighlight(
  sources: Iterable<string>,
  targets: Iterable<string>,
): TransitionHighlight {
  return { sources: new Set(sources), targets: new Set(targets) };
}
