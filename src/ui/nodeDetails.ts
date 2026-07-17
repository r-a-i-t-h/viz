/**
 * Format state-node entry/exit/after/`on` details into short human-readable
 * lines for hover popups.
 */

const AFTER_EVENT = /^xstate\.after\./;

export function formatEntryActions(entry: unknown[] | undefined): string[] {
  return (entry ?? [])
    .filter((action) => !isInjectedAfterAction(action))
    .map(formatAction)
    .filter(Boolean);
}

export function formatExitActions(exit: unknown[] | undefined): string[] {
  return (exit ?? [])
    .filter((action) => !isInjectedAfterAction(action))
    .map(formatAction)
    .filter(Boolean);
}

export function formatAfterTransitions(
  on: Record<string, unknown> | undefined,
  transitions: unknown[] | undefined,
): string[] {
  const fromOn = Object.entries(on ?? {})
    .filter(([key]) => AFTER_EVENT.test(key))
    .flatMap(([, value]) => asTransitionList(value).map(formatAfterTransition));

  if (fromOn.length > 0) return fromOn.filter(Boolean);

  return (transitions ?? [])
    .filter(isDelayedTransition)
    .map(formatAfterTransition)
    .filter(Boolean);
}

export function formatOnTransitionDetails(
  eventType: string,
  transitions: unknown,
): string[] {
  return asTransitionList(transitions)
    .filter(hasGuardOrActions)
    .map((transition) => formatOnTransition(eventType, transition))
    .filter(Boolean);
}

/** Full `on` transition lines for detail panes (not only guard/action cases). */
export function formatAllOnTransitions(
  eventType: string,
  transitions: unknown,
): string[] {
  return asTransitionList(transitions)
    .map((transition) => formatOnTransition(eventType, transition))
    .filter(Boolean);
}

/** Target node ids for highlighting while an `on` event is hovered. */
export function getOnTransitionTargetIds(transitions: unknown): Set<string> {
  const ids = new Set<string>();

  for (const transition of asTransitionList(transitions)) {
    if (!transition || typeof transition !== 'object') continue;
    const target = (transition as { target?: unknown }).target;
    const targets = Array.isArray(target) ? target : target == null ? [] : [target];

    for (const item of targets) {
      const id = targetId(item);
      if (id) ids.add(id);
    }
  }

  return ids;
}

/** Target node ids for all delayed `after` transitions on a node. */
export function getAfterTransitionTargetIds(
  on: Record<string, unknown> | undefined,
  transitions: unknown[] | undefined,
): Set<string> {
  const fromOn = Object.entries(on ?? {})
    .filter(([key]) => AFTER_EVENT.test(key))
    .flatMap(([, value]) => asTransitionList(value));

  if (fromOn.length > 0) return getOnTransitionTargetIds(fromOn);

  return getOnTransitionTargetIds(
    (transitions ?? []).filter(isDelayedTransition),
  );
}

/** Normalize XState target ids (`#demo.running`) to node ids (`demo.running`). */
export function normalizeStateNodeId(id: string): string {
  return id.replace(/^#/, '');
}

function formatAction(action: unknown): string {
  if (typeof action === 'string') return action;
  if (!action || typeof action !== 'object') return String(action);
  const type = (action as { type?: unknown }).type;
  if (typeof type === 'string' && type.length > 0) return type;
  return 'action';
}

function formatAfterTransition(transition: unknown): string {
  if (!transition || typeof transition !== 'object') return '';
  const t = transition as {
    delay?: unknown;
    target?: unknown;
    actions?: unknown;
    guard?: unknown;
    eventType?: unknown;
  };

  const delay =
    typeof t.delay === 'number'
      ? `${t.delay}ms`
      : typeof t.delay === 'string'
        ? t.delay
        : parseDelayFromEventType(t.eventType) ?? '?';

  const parts = [`after ${delay} → ${formatTargets(t.target)}`];
  const guard = formatGuard(t.guard);
  if (guard) parts.push(`if ${guard}`);
  const actions = formatActionList(t.actions);
  if (actions) parts.push(`do ${actions}`);
  return parts.join(' · ');
}

function formatOnTransition(eventType: string, transition: unknown): string {
  if (!transition || typeof transition !== 'object') {
    return `${eventType} → ?`;
  }
  const t = transition as {
    target?: unknown;
    actions?: unknown;
    guard?: unknown;
    reenter?: unknown;
  };

  const target = formatTargets(t.target);
  const parts = [`${eventType} → ${target}`];
  const guard = formatGuard(t.guard);
  if (guard) parts.push(`if ${guard}`);
  const actions = formatActionList(t.actions);
  if (actions) parts.push(`do ${actions}`);
  if (t.reenter === true) parts.push('reenter');
  return parts.join(' · ');
}

function hasGuardOrActions(transition: unknown): boolean {
  if (!transition || typeof transition !== 'object') return false;
  const t = transition as { guard?: unknown; actions?: unknown };
  return (
    t.guard != null ||
    (Array.isArray(t.actions) && t.actions.length > 0)
  );
}

function formatTargets(target: unknown): string {
  if (target == null) return '(internal)';
  const list = Array.isArray(target) ? target : [target];
  if (list.length === 0) return '(internal)';
  return list.map(shortTarget).join(', ');
}

function shortTarget(target: unknown): string {
  if (typeof target === 'string') {
    const bare = target.replace(/^#/, '');
    const parts = bare.split('.');
    return parts[parts.length - 1] || bare;
  }
  if (target && typeof target === 'object' && 'id' in target) {
    return shortTarget((target as { id: unknown }).id);
  }
  if (target && typeof target === 'object' && 'key' in target) {
    const key = (target as { key: unknown }).key;
    if (typeof key === 'string') return key;
  }
  return '?';
}

function targetId(target: unknown): string | null {
  if (typeof target === 'string') return normalizeStateNodeId(target);
  if (target && typeof target === 'object' && 'id' in target) {
    const id = (target as { id: unknown }).id;
    return typeof id === 'string' ? normalizeStateNodeId(id) : null;
  }
  return null;
}

function formatGuard(guard: unknown): string | null {
  if (guard == null) return null;
  if (typeof guard === 'string') return guard;
  if (typeof guard === 'object' && guard && 'type' in guard) {
    const type = (guard as { type: unknown }).type;
    if (typeof type === 'string') return type;
  }
  return null;
}

function formatActionList(actions: unknown): string | null {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  const names = actions.map(formatAction).filter(Boolean);
  return names.length > 0 ? names.join(', ') : null;
}

function asTransitionList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDelayFromEventType(eventType: unknown): string | null {
  if (typeof eventType !== 'string') return null;
  // xstate.after.<delay>.<id...>
  const match = /^xstate\.after\.([^.]+)\./.exec(eventType);
  if (!match) return null;
  const delay = match[1];
  return /^\d+$/.test(delay) ? `${delay}ms` : delay;
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
