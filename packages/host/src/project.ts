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
import { analyzeContextDeps } from './contextDeps.js';
import { computeContextKeyAges } from './contextAges.js';
import type {
  VizActorRefMarker,
  VizBadge,
  VizEvent,
  VizFrame,
  VizInvoke,
  VizMachine,
  VizNextEvent,
  VizNode,
  VizNodeDetails,
  VizNodeKind,
  VizSymbol,
  VizTransition,
} from '@viz/protocol';
import { normalizeStateNodeId } from '@viz/protocol';
import { collectNextEvents } from './nextEvents.js';

const AFTER_EVENT = /^xstate\.after\./;
const DONE_ACTOR_EVENT = /^xstate\.done\.actor\./;
const ERROR_ACTOR_EVENT = /^xstate\.error\.actor\./;

/** Live StateNode fields we read beyond the serializable definition. */
interface LiveStateNode {
  always?: unknown[];
  invoke?: unknown[];
  states?: Record<string, LiveStateNode>;
  parent?: { id?: string };
  target?: unknown;
}

interface MachineActorRef {
  sessionId: string;
  logic?: AnyStateMachine;
  id?: string;
  _parent?: { sessionId?: string };
  options?: { input?: unknown };
  getSnapshot?: () => {
    value?: unknown;
    context?: unknown;
    status?: VizFrame['status'];
    output?: unknown;
  };
}

export interface ResolvedMachineActor {
  sessionId: string;
  logic: AnyStateMachine;
  parentSessionId?: string;
  input?: unknown;
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
): ResolvedMachineActor | null {
  if (event.type !== '@xstate.actor') return null;
  const actorRef = asMachineActorRef(event.actorRef);
  const logic = actorRef?.logic;
  if (!actorRef || !logic || typeof logic.definition === 'undefined') {
    return null;
  }
  const parentSessionId = actorRef._parent?.sessionId;
  const input = actorRef.options?.input;
  return {
    sessionId: actorRef.sessionId,
    logic,
    parentSessionId:
      typeof parentSessionId === 'string' ? parentSessionId : undefined,
    input,
  };
}

export function projectMachine(
  logic: AnyStateMachine,
  sessionId: string,
  options?: {
    parentSessionId?: string;
    input?: unknown;
  },
): VizMachine {
  const rootDef = logic.definition as XStateNodeDefinition<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
  const liveRoot = (logic as { root?: LiveStateNode }).root;
  return {
    sessionId,
    label: rootDef.id || logic.id || sessionId,
    parentSessionId: options?.parentSessionId,
    input: options?.input,
    root: projectNode(rootDef, '', liveRoot),
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
    children?: Record<string, unknown>;
  },
  options?: {
    eventType?: string;
    previousContext?: unknown;
    previousAges?: Record<string, number>;
    machine?: VizMachine;
    /**
     * Optional scrub after actor-ref enrichment (host sanitizeContext).
     * Receives already-portable context.
     */
    sanitizeContext?: (context: unknown) => unknown;
  },
): VizFrame {
  const value = snapshot.value;
  const status = normalizeStatus(snapshot.status);
  const paths =
    value === undefined || value === null
      ? []
      : activePaths(value as StateValue);
  const childSessionById = childSessionIndex(snapshot.children);
  let context = portableizeContext(snapshot.context, childSessionById);
  if (options?.sanitizeContext && context != null) {
    context = options.sanitizeContext(context);
  }
  const contextKeyAges = computeContextKeyAges(
    context,
    options?.previousContext,
    options?.previousAges,
  );
  const nextEvents: VizNextEvent[] | undefined = options?.machine
    ? collectNextEvents(options.machine.root, paths)
    : undefined;
  return {
    sessionId,
    activePaths: paths,
    context,
    value,
    status,
    output: snapshot.output,
    eventType: options?.eventType,
    contextKeyAges,
    nextEvents,
  };
}

/** Map child actor id → sessionId from a live snapshot.children bag. */
function childSessionIndex(
  children: Record<string, unknown> | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!children) return map;
  for (const [id, ref] of Object.entries(children)) {
    if (ref && typeof ref === 'object' && 'sessionId' in ref) {
      const sessionId = (ref as { sessionId: unknown }).sessionId;
      if (typeof sessionId === 'string') map.set(id, sessionId);
    }
  }
  return map;
}

/**
 * Replace live ActorRefs with {@link VizActorRefMarker} so sessionId survives
 * JSON / postMessage. Uses live sessionId when present; falls back to
 * snapshot.children lookup via `id` / toJSON shape.
 */
export function portableizeContext(
  context: unknown,
  childSessionById: Map<string, string> = new Map(),
): unknown {
  return walkPortable(context, childSessionById, new WeakSet());
}

function walkPortable(
  value: unknown,
  childSessionById: Map<string, string>,
  seen: WeakSet<object>,
): unknown {
  const marker = asActorRefMarker(value, childSessionById);
  if (marker) return marker;
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => walkPortable(item, childSessionById, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = walkPortable(child, childSessionById, seen);
  }
  return out;
}

function asActorRefMarker(
  value: unknown,
  childSessionById: Map<string, string>,
): VizActorRefMarker | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;

  if (
    typeof obj.sessionId === 'string' &&
    (typeof obj.send === 'function' ||
      typeof obj.getSnapshot === 'function' ||
      obj.xstate$$type === 1)
  ) {
    const id =
      typeof obj.id === 'string'
        ? obj.id
        : typeof obj.sessionId === 'string'
          ? obj.sessionId
          : '?';
    return { __viz: 'actorRef', sessionId: obj.sessionId, id };
  }

  // Already-serialized ActorRef shape from toJSON / prior stringify.
  if (obj.xstate$$type === 1 && typeof obj.id === 'string') {
    const sessionId = childSessionById.get(obj.id);
    if (sessionId) {
      return { __viz: 'actorRef', sessionId, id: obj.id };
    }
  }

  return null;
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
  live?: LiveStateNode,
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
    const liveChild = live?.states?.[child.key];
    return projectNode(child, childPath, liveChild);
  });

  const entrySymbols = projectActions(def.entry);
  const exitSymbols = projectActions(def.exit);
  const afterTransitions = collectAfterTransitions(def);
  const alwaysTransitions = collectAlwaysTransitions(live);
  const invokes = collectInvokes(def, live);
  const events = collectEvents(def);
  const history =
    kind === 'history'
      ? def.history === 'deep'
        ? 'deep'
        : 'shallow'
      : def.history === 'shallow' || def.history === 'deep'
        ? def.history
        : undefined;
  const historyHighlightIds = historyRestoreTargets(def, live);
  const badges = buildBadges(
    entrySymbols,
    exitSymbols,
    afterTransitions,
    alwaysTransitions,
    invokes,
    history,
    historyHighlightIds,
  );

  const details: VizNodeDetails = {
    path,
    tags: [...(def.tags ?? [])].map(String),
    entry: entrySymbols,
    exit: exitSymbols,
    after: afterTransitions,
    always: alwaysTransitions,
    invokes,
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
  always: VizTransition[],
  invokes: VizInvoke[],
  history: 'shallow' | 'deep' | undefined,
  historyHighlightIds: string[],
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
  if (history) {
    badges.push({
      kind: 'history',
      label: history === 'deep' ? 'deep' : 'hist',
      lines: [
        `${history} history`,
        historyHighlightIds.length > 0
          ? `restore → ${historyHighlightIds.map(shortId).join(', ')}`
          : 'restore → (last configuration)',
      ],
      highlightIds: historyHighlightIds,
    });
  }
  if (always.length > 0) {
    badges.push({
      kind: 'always',
      label: 'always',
      lines: always.map((t) => t.line),
      highlightIds: uniqueIds(always.flatMap((t) => t.targetIds)),
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
  if (invokes.length > 0) {
    const highlightIds = uniqueIds(invokes.flatMap((inv) => inv.highlightIds));
    const hasDone = invokes.some((inv) => inv.onDone.length > 0);
    badges.push({
      kind: 'invoke',
      label: hasDone ? 'onDone' : 'invoke',
      lines: invokes.flatMap(invokeBadgeLines),
      highlightIds,
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

/**
 * Static restore targets for history hover: explicit `target` when configured,
 * otherwise the owning compound parent (runtime restores last config there).
 */
function historyRestoreTargets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
  live?: LiveStateNode,
): string[] {
  const fromDef = extractTargetIds(
    (def as { target?: unknown }).target ?? live?.target,
  );
  if (fromDef.length > 0) return fromDef;
  const parentId = live?.parent?.id;
  if (typeof parentId === 'string') {
    return [normalizeStateNodeId(parentId)];
  }
  return [];
}

function shortId(id: string): string {
  const parts = id.split('.');
  return parts[parts.length - 1] || id;
}

function invokeBadgeLines(inv: VizInvoke): string[] {
  const lines: string[] = [`src ${inv.src}`];
  if (inv.id) lines.push(`id ${inv.id}`);
  if (inv.inputSummary) lines.push(inv.inputSummary);
  for (const t of inv.onDone) lines.push(t.line);
  for (const t of inv.onError) lines.push(t.line);
  return lines;
}

function collectEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
): VizEvent[] {
  const events: VizEvent[] = [];
  for (const [eventType, transitions] of Object.entries(def.on ?? {})) {
    if (AFTER_EVENT.test(eventType)) continue;
    if (DONE_ACTOR_EVENT.test(eventType)) continue;
    if (ERROR_ACTOR_EVENT.test(eventType)) continue;
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

function collectAlwaysTransitions(live?: LiveStateNode): VizTransition[] {
  if (!live?.always || live.always.length === 0) return [];
  return live.always.map((t) => projectTransition(t, undefined, false, true));
}

function collectInvokes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: XStateNodeDefinition<any, any>,
  live?: LiveStateNode,
): VizInvoke[] {
  const list = live?.invoke ?? def.invoke ?? [];
  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((raw, index) => {
    const inv = (raw && typeof raw === 'object' ? raw : {}) as {
      id?: unknown;
      src?: unknown;
      input?: unknown;
    };
    const id =
      typeof inv.id === 'string' && inv.id.length > 0
        ? inv.id
        : `${index}`;
    const src = formatInvokeSrc(inv.src);
    const doneKey = `xstate.done.actor.${id}`;
    const errorKey = `xstate.error.actor.${id}`;
    const onDone = asTransitionList(def.on?.[doneKey]).map((t) =>
      projectTransition(t, 'done'),
    );
    const onError = asTransitionList(def.on?.[errorKey]).map((t) =>
      projectTransition(t, 'error'),
    );
    const highlightIds = uniqueIds([
      ...onDone.flatMap((t) => t.targetIds),
      ...onError.flatMap((t) => t.targetIds),
    ]);
    return {
      id,
      src,
      inputSummary:
        typeof inv.input === 'function'
          ? 'input (fn)'
          : inv.input != null
            ? `input ${summarizeValue(inv.input)}`
            : undefined,
      onDone,
      onError,
      highlightIds,
    };
  });
}

function formatInvokeSrc(src: unknown): string {
  if (typeof src === 'string') return src;
  if (src && typeof src === 'object' && 'id' in src) {
    const id = (src as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return '(actor)';
}

function summarizeValue(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 40 ? `${text.slice(0, 37)}…` : text;
  } catch {
    return '[object]';
  }
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
  asAlways = false,
): VizTransition {
  if (!transition || typeof transition !== 'object') {
    const line = asAlways
      ? 'always → ?'
      : eventType
        ? `${eventType} → ?`
        : '→ ?';
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
  } else if (asAlways) {
    parts.push(`always → ${targetLabel}`);
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

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
