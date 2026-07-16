/**
 * Detect which lifecycle affordances a state node has, for badge overlays.
 *
 * XState injects `xstate.raise` / `xstate.cancel` into entry/exit when a node
 * has `after` delays — those are filtered out so badges reflect authored
 * entry/exit actions, not the after machinery.
 */
export function nodeLifecycleFlags(node: {
  entry?: unknown[] | undefined;
  exit?: unknown[] | undefined;
  on?: Record<string, unknown> | undefined;
  transitions?: unknown[] | undefined;
}): { entry: boolean; exit: boolean; after: boolean } {
  const entry = (node.entry ?? []).some((action) => !isInjectedAfterAction(action));
  const exit = (node.exit ?? []).some((action) => !isInjectedAfterAction(action));
  const after =
    Object.keys(node.on ?? {}).some((key) => key.startsWith('xstate.after.')) ||
    (node.transitions ?? []).some(isDelayedTransition);

  return { entry, exit, after };
}

function isInjectedAfterAction(action: unknown): boolean {
  if (!action || typeof action !== 'object') return false;
  const type = (action as { type?: unknown }).type;
  return type === 'xstate.raise' || type === 'xstate.cancel';
}

function isDelayedTransition(transition: unknown): boolean {
  if (!transition || typeof transition !== 'object') return false;
  const delay = (transition as { delay?: unknown }).delay;
  return delay !== undefined && delay !== null;
}
