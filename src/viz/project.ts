/**
 * Host-side projection: walk live XState machine logic (official types) into
 * the shared Viz* model. This is the only module that should import XState
 * structural types (`StateNodeDefinition`, transition shapes, etc.).
 */

import type {
  AnyStateMachine,
  InspectionEvent,
  StateNodeDefinition as XStateNodeDefinition,
  StateValue,
} from 'xstate';
import { analyzeContextDeps } from './contextDeps';
import type {
  VizBadge,
  VizEvent,
  VizFrame,
  VizMachine,
  VizNode,
  VizNodeDetails,
  VizNodeKind,
  VizSymbol,
  VizTransition,
} from './model';

const AFTER_EVENT = /^xstate\.after\./;

interface MachineActorRef {
  sessionId: string;
  logic?: AnyStateMachine;
  getSnapshot?: () => {
    value?: unknown;
    context?: unknown;
    status?: VizFrame['status'];
    output?: unknown;
  };
}

function asMachineActorRef(actorRef: unknown): MachineActorRef | null {
  if (actorRef && typeof actorRef === 'object' && 'sessionId' in actorRef) {
    return actorRef as MachineActorRef;
  }
  return null;
}

/** Resolve machine logic from an `@xstate.actor` inspection event. */
export function machineLogicFromEvent(
  event: InspectionEvent,
): { sessionId: string; logic: AnyStateMachine } | null {
  if (event.type !== '@xstate.actor') return null;
  const actorRef = asMachineActorRef(event.actorRef);
  const logic = actorRef?.logic;
  if (!actorRef || !logic || typeof logic.definition === 'undefined') {
    return null;
  }
  return { sessionId: actorRef.sessionId, logic };
}

export function projectMachine(
  logic: AnyStateMachine,
  sessionId: string,
): VizMachine {
  const rootDef = logic.definition as XStateNodeDefinition<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
  return {
    sessionId,
    label: rootDef.id || logic.id || sessionId,
    root: projectNode(rootDef, ''),
    analysis: {
      contextDeps: analyzeContextDeps(logic),
    },
  };
}

export function projectFrame(
  sessionId: string,
  snapshot: {
    value?: unknown;
    context?: unknown;
    status?: string;
    output?: unknown;
  },
  eventType?: string,
): VizFrame {
  const value = snapshot.value;
  const status = normalizeStatus(snapshot.status);
  return {
    sessionId,
    activePaths:
      value === undefined || value === null
        ? []
        : activePaths(value as StateValue),
    context: snapshot.context,
    value,
    status,
    output: snapshot.output,
    eventType,
  };
}

/**
 * Flatten a StateValue into dot-delimited active state paths.
 * Host-only; popup receives the result on VizFrame.activePaths.
 */
export function activePaths(value: StateValue, prefix = ''): string[] {
  if (typeof value === 'string') {
    return [prefix ? `${prefix}.${value}` : value];
  }

  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    if (child !== undefined) {
      paths.push(...activePaths(child as StateValue, path));
    }
  }
  return paths;
}

function normalizeStatus(status: unknown): VizFrame['status'] {
  if (
    status === 'active' ||
    status === 'done' ||
    status === 'error' ||
    status === 'stopped'
  ) {
    return status;
  }
  return 'active';
}

function projectNode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
  path: string,
): VizNode {
  const kind = def.type as VizNodeKind;
  const layout =
    kind === 'parallel'
      ? 'parallel'
      : Object.keys(def.states ?? {}).length > 0
        ? 'sequential'
        : 'none';

  const children = Object.values(def.states ?? {}).map((child) => {
    const childPath = path ? `${path}.${child.key}` : child.key;
    return projectNode(child, childPath);
  });

  const entrySymbols = projectActions(def.entry);
  const exitSymbols = projectActions(def.exit);
  const afterTransitions = collectAfterTransitions(def);
  const alwaysTransitions: VizTransition[] = []; // deferred (TODO)
  const events = collectEvents(def);
  const badges = buildBadges(entrySymbols, exitSymbols, afterTransitions);
  const history =
    def.history === 'shallow' || def.history === 'deep'
      ? def.history
      : undefined;

  const details: VizNodeDetails = {
    path,
    tags: [...(def.tags ?? [])].map(String),
    entry: entrySymbols,
    exit: exitSymbols,
    after: afterTransitions,
    always: alwaysTransitions,
    invokes: [],
    history,
  };

  return {
    id: normalizeStateNodeId(def.id),
    key: def.key,
    kind,
    layout,
    children,
    initialChildIds: resolveInitialChildIds(def),
    badges,
    events,
    details,
  };
}

function buildBadges(
  entry: VizSymbol[],
  exit: VizSymbol[],
  after: VizTransition[],
): VizBadge[] {
  const badges: VizBadge[] = [];
  if (entry.length > 0) {
    badges.push({
      kind: 'entry',
      label: 'entry',
      lines: entry.map(symbolLine),
      highlightIds: [],
    });
  }
  if (after.length > 0) {
    badges.push({
      kind: 'after',
      label: 'after',
      lines: after.map((t) => t.line),
      highlightIds: uniqueIds(after.flatMap((t) => t.targetIds)),
    });
  }
  if (exit.length > 0) {
    badges.push({
      kind: 'exit',
      label: 'exit',
      lines: exit.map(symbolLine),
      highlightIds: [],
    });
  }
  return badges;
}

function collectEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
): VizEvent[] {
  const events: VizEvent[] = [];
  for (const [eventType, transitions] of Object.entries(def.on ?? {})) {
    if (AFTER_EVENT.test(eventType)) continue;
    const list = asTransitionList(transitions).map((t) =>
      projectTransition(t, eventType),
    );
    const highlightIds = uniqueIds(list.flatMap((t) => t.targetIds));
    const detailLines = list.map((t) => t.line);
    const hoverLines = list
      .filter((t) => t.guard != null || t.actions.length > 0)
      .map((t) => t.line);
    events.push({
      type: eventType,
      transitions: list,
      highlightIds,
      hoverLines,
      detailLines,
      pattern: eventPattern(eventType),
    });
  }
  return events;
}

function collectAfterTransitions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
): VizTransition[] {
  const fromOn: unknown[] = [];
  for (const [key, value] of Object.entries(def.on ?? {})) {
    if (!AFTER_EVENT.test(key)) continue;
    fromOn.push(...asTransitionList(value));
  }
  if (fromOn.length > 0) {
    return fromOn.map((t) => projectTransition(t, undefined, true));
  }
  return (def.transitions ?? [])
    .filter(isDelayedTransition)
    .map((t) => projectTransition(t, undefined, true));
}

function projectTransition(
  transition: unknown,
  eventType?: string,
  asAfter = false,
): VizTransition {
  if (!transition || typeof transition !== 'object') {
    const line = eventType ? `${eventType} → ?` : '→ ?';
    return { targetIds: [], actions: [], line };
  }
  const t = transition as {
    target?: unknown;
    actions?: unknown;
    guard?: unknown;
    reenter?: unknown;
    delay?: unknown;
    eventType?: unknown;
  };

  const targetIds = extractTargetIds(t.target);
  const guard = projectGuard(t.guard);
  const actions = projectActions(t.actions);
  const reenter = t.reenter === true ? true : undefined;
  const delayLabel = asAfter
    ? formatDelay(t.delay, t.eventType)
    : undefined;

  const targetLabel = formatTargetLabel(t.target);
  const parts: string[] = [];
  if (asAfter) {
    parts.push(`after ${delayLabel ?? '?'} → ${targetLabel}`);
  } else {
    parts.push(`${eventType ?? '?'} → ${targetLabel}`);
  }
  if (guard) parts.push(`if ${guard.name}`);
  if (actions.length > 0) {
    parts.push(`do ${actions.map((a) => a.name).join(', ')}`);
  }
  if (reenter) parts.push('reenter');

  return {
    targetIds,
    guard: guard ?? undefined,
    actions,
    reenter,
    delayLabel,
    line: parts.join(' · '),
  };
}

function projectActions(actions: unknown): VizSymbol[] {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((action) => !isInjectedAfterAction(action))
    .map(projectAction)
    .filter((s): s is VizSymbol => s != null);
}

function projectAction(action: unknown): VizSymbol | null {
  if (typeof action === 'string') {
    return { kind: 'action', name: action };
  }
  if (!action || typeof action !== 'object') return null;
  const type = (action as { type?: unknown }).type;
  if (typeof type === 'string' && type.length > 0) {
    return { kind: 'action', name: type };
  }
  return { kind: 'action', name: 'action' };
}

function projectGuard(guard: unknown): VizSymbol | null {
  if (guard == null) return null;
  if (typeof guard === 'string') return { kind: 'guard', name: guard };
  if (typeof guard === 'object' && guard && 'type' in guard) {
    const type = (guard as { type: unknown }).type;
    if (typeof type === 'string') return { kind: 'guard', name: type };
  }
  return null;
}

function resolveInitialChildIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
): string[] {
  const ids: string[] = [];
  const target = def.initial?.target;
  if (!target) return ids;

  for (const item of target) {
    for (const id of extractTargetIds(item)) {
      ids.push(id);
      const bare = id.split('.').pop();
      if (bare) ids.push(bare);
    }
    if (item && typeof item === 'object' && 'key' in item) {
      const key = (item as { key: unknown }).key;
      if (typeof key === 'string') ids.push(key);
    }
  }
  return uniqueIds(ids);
}

function extractTargetIds(target: unknown): string[] {
  if (target == null) return [];
  const list = Array.isArray(target) ? target : [target];
  const ids: string[] = [];
  for (const item of list) {
    const id = targetId(item);
    if (id) ids.push(id);
  }
  return uniqueIds(ids);
}

function targetId(target: unknown): string | null {
  if (typeof target === 'string') return normalizeStateNodeId(target);
  if (target && typeof target === 'object' && 'id' in target) {
    const id = (target as { id: unknown }).id;
    return typeof id === 'string' ? normalizeStateNodeId(id) : null;
  }
  return null;
}

function formatTargetLabel(target: unknown): string {
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

function formatDelay(delay: unknown, eventType: unknown): string {
  if (typeof delay === 'number') return `${delay}ms`;
  if (typeof delay === 'string') return delay;
  if (typeof eventType === 'string') {
    const match = /^xstate\.after\.([^.]+)\./.exec(eventType);
    if (match) {
      const d = match[1];
      return /^\d+$/.test(d) ? `${d}ms` : d;
    }
  }
  return '?';
}

function eventPattern(
  eventType: string,
): 'exact' | 'wildcard' | 'partial' | undefined {
  if (eventType === '*') return 'wildcard';
  if (eventType.endsWith('.*')) return 'partial';
  return 'exact';
}

function symbolLine(symbol: VizSymbol): string {
  return symbol.detail ? `${symbol.name} (${symbol.detail})` : symbol.name;
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

function asTransitionList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Normalize XState target ids (`#demo.running`) to node ids (`demo.running`). */
export function normalizeStateNodeId(id: string): string {
  return id.replace(/^#/, '');
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
