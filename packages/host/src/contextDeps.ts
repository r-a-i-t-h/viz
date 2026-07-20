import type { AnyStateMachine } from 'xstate';
import type {
  ContextDepEdge,
  ContextDepGraph,
  ContextDepNode,
  DepCoverage,
  DepEntityKind,
  DepRelation,
  DepSite,
} from '@r-a-i-t-h/viz-protocol';

export type {
  ContextDepEdge,
  ContextDepGraph,
  ContextDepNode,
  DepCoverage,
  DepEntityKind,
  DepRelation,
  DepSite,
} from '@r-a-i-t-h/viz-protocol';

/**
 * Static context dependency graph: which actions / guards / invokes read or
 * write which context keys. Built from live machine `logic` before
 * `toPortable` strips functions.
 */

const CONTEXT_KEY_RE =
  /context\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[["']([^"']+)["']\])/g;

const COMPOUND_GUARDS = new Set(['xstate.and', 'xstate.or', 'xstate.not']);

interface MachineLogic {
  config?: ConfigNode & { context?: unknown };
  definition?: StateNodeLike;
  implementations?: {
    actions?: Record<string, unknown>;
    guards?: Record<string, unknown>;
  };
}

/** Authored config node — keeps live assign/guard/input functions. */
interface ConfigNode {
  entry?: unknown;
  exit?: unknown;
  on?: Record<string, unknown>;
  always?: unknown;
  invoke?: unknown;
  states?: Record<string, ConfigNode>;
}

interface StateNodeLike {
  id?: string;
  key?: string;
  entry?: unknown[];
  exit?: unknown[];
  on?: Record<string, unknown>;
  transitions?: unknown[];
  invoke?: unknown[];
  states?: Record<string, StateNodeLike>;
}

interface EdgeSite {
  stateId: string;
  site: DepSite;
  eventType?: string;
}

interface MutableGraph {
  nodes: Map<string, ContextDepNode>;
  edges: ContextDepEdge[];
}

/** Analyze a live state machine for context key read/write dependencies. */
export function analyzeContextDeps(logic: AnyStateMachine): ContextDepGraph {
  const machine = logic as unknown as MachineLogic;
  const graph: MutableGraph = { nodes: new Map(), edges: [] };

  const initialKeys = plainContextKeys(machine.config?.context);
  for (const key of initialKeys) {
    ensureContextKey(graph, key);
  }

  const root = machine.definition;
  if (root) {
    walkState(root, machine.config, machine, graph);
  }

  return {
    nodes: [...graph.nodes.values()],
    edges: graph.edges,
  };
}

function walkState(
  node: StateNodeLike,
  config: ConfigNode | undefined,
  machine: MachineLogic,
  graph: MutableGraph,
): void {
  const stateId =
    typeof node.id === 'string' && node.id.length > 0 ? node.id : '(unknown)';

  analyzeActions(node.entry, config?.entry, machine, graph, {
    stateId,
    site: 'entry',
  });
  analyzeActions(node.exit, config?.exit, machine, graph, {
    stateId,
    site: 'exit',
  });

  const onKeys = new Set(Object.keys(node.on ?? {}));
  for (const [eventType, value] of Object.entries(node.on ?? {})) {
    const configTransitions = config?.on?.[eventType];
    const defTransitions = asList(value);
    const cfgTransitions = asList(configTransitions);
    for (let i = 0; i < defTransitions.length; i++) {
      analyzeTransition(
        defTransitions[i],
        cfgTransitions[i],
        machine,
        graph,
        {
          stateId,
          site: 'transition',
          eventType,
        },
      );
    }
  }

  // Eventless / always transitions live on `transitions` but not always in `on`.
  for (const transition of node.transitions ?? []) {
    const eventType = eventTypeOf(transition);
    if (eventType && onKeys.has(eventType)) continue;
    analyzeTransition(transition, undefined, machine, graph, {
      stateId,
      site: 'transition',
      eventType,
    });
  }

  const defInvokes = node.invoke ?? [];
  const cfgInvokes = asList(config?.invoke);
  for (let i = 0; i < defInvokes.length; i++) {
    analyzeInvoke(defInvokes[i], cfgInvokes[i], graph, stateId);
  }

  for (const [key, child] of Object.entries(node.states ?? {})) {
    walkState(child, config?.states?.[key], machine, graph);
  }
}

function analyzeTransition(
  transition: unknown,
  configTransition: unknown,
  machine: MachineLogic,
  graph: MutableGraph,
  site: EdgeSite,
): void {
  if (!transition || typeof transition !== 'object') return;
  const t = transition as { actions?: unknown; guard?: unknown };
  const cfg =
    configTransition && typeof configTransition === 'object'
      ? (configTransition as { actions?: unknown; guard?: unknown })
      : undefined;

  analyzeActions(t.actions, cfg?.actions, machine, graph, site);

  const guard = t.guard ?? cfg?.guard;
  if (guard != null) {
    analyzeGuard(guard, machine, graph, site);
  }
}

function analyzeInvoke(
  invoke: unknown,
  configInvoke: unknown,
  graph: MutableGraph,
  stateId: string,
): void {
  if (!invoke || typeof invoke !== 'object') return;
  const inv = invoke as {
    id?: unknown;
    src?: unknown;
    input?: unknown;
  };
  const cfg =
    configInvoke && typeof configInvoke === 'object'
      ? (configInvoke as { input?: unknown })
      : undefined;

  const invokeId = invokeEntityId(inv.id, inv.src, stateId);
  const label = invokeLabel(inv.id, inv.src);
  ensureEntity(graph, invokeId, 'invoke', label, 'opaque');

  const site: EdgeSite = { stateId, site: 'invoke' };
  const input = typeof inv.input === 'function' ? inv.input : cfg?.input;

  if (typeof input === 'function') {
    const reads = extractContextReads(input);
    if (reads.length > 0) {
      bumpCoverage(graph, invokeId, 'partial');
      for (const key of reads) {
        addEdge(graph, invokeId, key, 'reads', site);
      }
    }
  }
  // onDone / onError actions are already present on `definition.on` with live
  // assign functions — do not re-walk invoke.onDone/onError (would duplicate).
}

function analyzeActions(
  actions: unknown,
  configActions: unknown,
  machine: MachineLogic,
  graph: MutableGraph,
  site: EdgeSite,
): void {
  const defList = asList(actions);
  const cfgList = asList(configActions);
  const len = Math.max(defList.length, cfgList.length);
  for (let i = 0; i < len; i++) {
    const action = preferActionBody(defList[i], cfgList[i]);
    if (action == null) continue;
    if (isInjectedAfterAction(action)) continue;
    analyzeAction(action, machine, graph, site);
  }
}

/**
 * Definition sometimes stores `{ type: 'xstate.assign' }` without `.assignment`;
 * the authored config still has the live assign function — prefer that.
 */
function preferActionBody(definitionAction: unknown, configAction: unknown): unknown {
  if (isStrippedAssign(definitionAction) && configAction != null) {
    return configAction;
  }
  return definitionAction ?? configAction;
}

function isStrippedAssign(action: unknown): boolean {
  if (!action || typeof action !== 'object') return false;
  const typed = action as { type?: unknown; assignment?: unknown };
  return typed.type === 'xstate.assign' && typed.assignment == null;
}

function analyzeAction(
  action: unknown,
  machine: MachineLogic,
  graph: MutableGraph,
  site: EdgeSite,
): void {
  const resolved = resolveAction(action, machine);
  const entityId = `action:${resolved.name}`;
  ensureEntity(graph, entityId, 'action', resolved.name, 'opaque');

  if (resolved.assignKeys.length > 0) {
    bumpCoverage(graph, entityId, 'known');
    for (const key of resolved.assignKeys) {
      addEdge(graph, entityId, key, 'writes', site);
    }
  }

  if (resolved.readKeys.length > 0) {
    bumpCoverage(graph, entityId, 'partial');
    for (const key of resolved.readKeys) {
      addEdge(graph, entityId, key, 'reads', site);
    }
  }
}

function analyzeGuard(
  guard: unknown,
  machine: MachineLogic,
  graph: MutableGraph,
  site: EdgeSite,
): void {
  for (const leaf of flattenGuard(guard)) {
    const resolved = resolveGuard(leaf, machine);
    const entityId = `guard:${resolved.name}`;
    ensureEntity(graph, entityId, 'guard', resolved.name, 'opaque');

    if (resolved.readKeys.length > 0) {
      bumpCoverage(graph, entityId, 'partial');
      for (const key of resolved.readKeys) {
        addEdge(graph, entityId, key, 'reads', site);
      }
    }
  }
}

function resolveAction(
  action: unknown,
  machine: MachineLogic,
): { name: string; assignKeys: string[]; readKeys: string[] } {
  if (typeof action === 'string') {
    return resolveActionImpl(action, machine.implementations?.actions?.[action]);
  }

  if (typeof action === 'function') {
    const typed = action as { type?: unknown; assignment?: unknown };
    const type =
      typeof typed.type === 'string' && typed.type.length > 0
        ? typed.type
        : '(inline)';
    return inspectActionValue(type, action);
  }

  if (action && typeof action === 'object') {
    const type = (action as { type?: unknown }).type;
    if (typeof type === 'string' && type.length > 0) {
      if (type === 'xstate.assign') {
        return inspectActionValue(type, action);
      }
      const impl = machine.implementations?.actions?.[type];
      if (impl !== undefined) {
        return resolveActionImpl(type, impl);
      }
      return inspectActionValue(type, action);
    }
  }

  return { name: '(inline)', assignKeys: [], readKeys: [] };
}

function resolveActionImpl(
  name: string,
  impl: unknown,
): { name: string; assignKeys: string[]; readKeys: string[] } {
  if (impl === undefined) {
    return { name, assignKeys: [], readKeys: [] };
  }
  return inspectActionValue(name, impl);
}

function inspectActionValue(
  name: string,
  value: unknown,
): { name: string; assignKeys: string[]; readKeys: string[] } {
  const assignment = getAssignmentMap(value);
  if (assignment) {
    const assignKeys: string[] = [];
    const readKeys: string[] = [];
    for (const [key, expr] of Object.entries(assignment)) {
      assignKeys.push(key);
      if (typeof expr === 'function') {
        readKeys.push(...extractContextReads(expr));
      }
    }
    return {
      name: name === 'xstate.assign' ? 'xstate.assign' : name,
      assignKeys: unique(assignKeys),
      readKeys: unique(readKeys),
    };
  }

  if (typeof value === 'function') {
    return {
      name,
      assignKeys: [],
      readKeys: extractContextReads(value),
    };
  }

  return { name, assignKeys: [], readKeys: [] };
}

/** XState `assign()` is a function (or object) with an `.assignment` map. */
function getAssignmentMap(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value !== 'function' && typeof value !== 'object') return null;
  const assignment = (value as { assignment?: unknown }).assignment;
  if (!assignment || typeof assignment !== 'object' || Array.isArray(assignment)) {
    return null;
  }
  return assignment as Record<string, unknown>;
}

function resolveGuard(
  guard: unknown,
  machine: MachineLogic,
): { name: string; readKeys: string[] } {
  if (typeof guard === 'string') {
    const impl = machine.implementations?.guards?.[guard];
    return {
      name: guard,
      readKeys:
        typeof impl === 'function' ? extractContextReads(impl) : [],
    };
  }

  if (typeof guard === 'function') {
    const typed = guard as { type?: unknown };
    const name =
      typeof typed.type === 'string' && typed.type.length > 0
        ? typed.type
        : '(inline)';
    return { name, readKeys: extractContextReads(guard) };
  }

  if (guard && typeof guard === 'object' && 'type' in guard) {
    const type = (guard as { type: unknown }).type;
    if (typeof type === 'string') {
      const impl = machine.implementations?.guards?.[type];
      if (typeof impl === 'function') {
        return { name: type, readKeys: extractContextReads(impl) };
      }
      return { name: type, readKeys: [] };
    }
  }

  return { name: '(inline)', readKeys: [] };
}

/** Expand compound guards into leaf refs (skipping and/or/not wrappers). */
function flattenGuard(guard: unknown): unknown[] {
  if (guard == null) return [];

  if (typeof guard === 'string' || typeof guard === 'function') {
    return [guard];
  }

  if (guard && typeof guard === 'object' && 'type' in guard) {
    const type = (guard as { type: unknown }).type;
    if (typeof type === 'string' && COMPOUND_GUARDS.has(type)) {
      const params = (guard as { params?: unknown }).params;
      const list = asList(params);
      return list.flatMap(flattenGuard);
    }
    return [guard];
  }

  return [guard];
}

function extractContextReads(fn: unknown): string[] {
  if (typeof fn !== 'function') return [];
  try {
    const src = Function.prototype.toString.call(fn);
    const keys: string[] = [];
    CONTEXT_KEY_RE.lastIndex = 0;
    for (const match of src.matchAll(CONTEXT_KEY_RE)) {
      const key = match[1] ?? match[2];
      if (key) keys.push(key);
    }
    return unique(keys);
  } catch {
    return [];
  }
}

function plainContextKeys(context: unknown): string[] {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return [];
  }
  return Object.keys(context);
}

function ensureContextKey(graph: MutableGraph, key: string): string {
  const id = `ctx:${key}`;
  if (!graph.nodes.has(id)) {
    graph.nodes.set(id, {
      id,
      kind: 'contextKey',
      label: key,
      coverage: 'known',
    });
  }
  return id;
}

function ensureEntity(
  graph: MutableGraph,
  id: string,
  kind: Exclude<DepEntityKind, 'contextKey'>,
  label: string,
  coverage: DepCoverage,
): void {
  const existing = graph.nodes.get(id);
  if (!existing) {
    graph.nodes.set(id, { id, kind, label, coverage });
    return;
  }
  existing.coverage = mergeCoverage(existing.coverage, coverage);
}

function bumpCoverage(
  graph: MutableGraph,
  id: string,
  coverage: DepCoverage,
): void {
  const node = graph.nodes.get(id);
  if (!node) return;
  node.coverage = mergeCoverage(node.coverage, coverage);
}

function mergeCoverage(a: DepCoverage, b: DepCoverage): DepCoverage {
  const rank = { opaque: 0, partial: 1, known: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function addEdge(
  graph: MutableGraph,
  fromEntityId: string,
  contextKey: string,
  relation: DepRelation,
  site: EdgeSite,
): void {
  const to = ensureContextKey(graph, contextKey);
  const already = graph.edges.some(
    (edge) =>
      edge.from === fromEntityId &&
      edge.to === to &&
      edge.relation === relation &&
      edge.at.stateId === site.stateId &&
      edge.at.site === site.site &&
      edge.at.eventType === site.eventType,
  );
  if (already) return;

  graph.edges.push({
    from: fromEntityId,
    to,
    relation,
    at: {
      stateId: site.stateId,
      site: site.site,
      ...(site.eventType !== undefined ? { eventType: site.eventType } : {}),
    },
  });
}

function invokeEntityId(
  id: unknown,
  src: unknown,
  stateId: string,
): string {
  if (typeof id === 'string' && id.length > 0) return `invoke:${id}`;
  if (typeof src === 'string' && src.length > 0) {
    return `invoke:${stateId}:${src}`;
  }
  return `invoke:${stateId}`;
}

function invokeLabel(id: unknown, src: unknown): string {
  if (typeof id === 'string' && id.length > 0) return id;
  if (typeof src === 'string' && src.length > 0) return src;
  if (src && typeof src === 'object' && 'id' in src) {
    const srcId = (src as { id: unknown }).id;
    if (typeof srcId === 'string') return srcId;
  }
  return '(invoke)';
}

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function eventTypeOf(transition: unknown): string | undefined {
  if (!transition || typeof transition !== 'object') return undefined;
  const eventType = (transition as { eventType?: unknown }).eventType;
  return typeof eventType === 'string' ? eventType : undefined;
}

function isInjectedAfterAction(action: unknown): boolean {
  if (!action || typeof action !== 'object') return false;
  const type = (action as { type?: unknown }).type;
  return type === 'xstate.raise' || type === 'xstate.cancel';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
