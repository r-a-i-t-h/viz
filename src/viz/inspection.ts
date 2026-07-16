import type {
  AnyStateMachine,
  InspectionEvent,
  StateValue,
} from 'xstate';

/**
 * The crux of the visualizer problem:
 *
 * Raw XState inspection events (see `xstate/inspection.d.ts`) do NOT embed the
 * machine structure. Snapshot events only tell you the *current* `value`; the
 * `@xstate.actor` event only gives you `type` + `actorRef`.
 *
 * The full make-up of the machine lives on `actorRef.logic`, which for a machine
 * actor is the `StateMachine` instance. From there:
 *   - `.config`     -> the raw authored config
 *   - `.definition` -> a normalized StateNodeDefinition tree (best for viz)
 *   - `.toJSON()`   -> same as `.definition`
 *
 * So the strategy is: on the `@xstate.actor` event, reach through `actorRef.logic`
 * and capture the definition once; then overlay streamed snapshot values onto it.
 */

/** A normalized state-node definition, as produced by `machine.definition`. */
export interface StateNodeDefinition {
  id: string;
  key: string;
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial?: { target: readonly unknown[] } | undefined;
  states: Record<string, StateNodeDefinition>;
  on: Record<string, unknown>;
  transitions: unknown[];
  entry: unknown[];
  exit: unknown[];
  tags: string[];
}

export interface CapturedMachine {
  sessionId: string;
  /** The raw config, exactly as authored. */
  config: unknown;
  /** The normalized definition tree — ideal for rendering. */
  definition: StateNodeDefinition;
}

/**
 * An actorRef whose `logic` is a state machine. XState's public `ActorRefLike`
 * type doesn't surface `logic`/`sessionId`, but they are present at runtime (the
 * Stately inspect library relies on this too), so we narrow explicitly.
 */
interface MachineActorRef {
  sessionId: string;
  logic?: AnyStateMachine;
}

function asMachineActorRef(actorRef: unknown): MachineActorRef | null {
  if (actorRef && typeof actorRef === 'object' && 'sessionId' in actorRef) {
    return actorRef as MachineActorRef;
  }
  return null;
}

/**
 * Extract the full machine make-up from an `@xstate.actor` inspection event.
 * Returns `null` for actors that aren't backed by a state machine (e.g. promise
 * or callback actors, which have no `.definition`).
 */
export function captureMachine(event: InspectionEvent): CapturedMachine | null {
  if (event.type !== '@xstate.actor') return null;

  const actorRef = asMachineActorRef(event.actorRef);
  const logic = actorRef?.logic;
  if (!actorRef || !logic || typeof logic.definition === 'undefined') {
    return null;
  }

  return {
    sessionId: actorRef.sessionId,
    config: logic.config,
    definition: logic.definition as unknown as StateNodeDefinition,
  };
}

/** A single inspection event recorded for display in the event log. */
export interface LoggedEvent {
  seq: number;
  type: InspectionEvent['type'];
  sessionId: string;
  /** The domain event name, when the inspection event carries one. */
  eventType?: string;
  /** The snapshot state value, when present. */
  value?: StateValue;
  at: number;
}

/** Pull a compact, displayable summary out of any inspection event. */
export function summarizeEvent(event: InspectionEvent, seq: number): LoggedEvent {
  const actorRef = asMachineActorRef(event.actorRef);
  const base: LoggedEvent = {
    seq,
    type: event.type,
    sessionId: actorRef?.sessionId ?? '(unknown)',
    at: Date.now(),
  };

  if ('event' in event && event.event) {
    base.eventType = event.event.type;
  }
  if ('snapshot' in event && event.snapshot) {
    const snapshot = event.snapshot as { value?: StateValue };
    base.value = snapshot.value;
  }

  return base;
}

/**
 * Flatten a StateValue into dot-delimited active state paths, e.g.
 * `{ running: { engine: 'active', signal: { red: 'flashing' } } }` becomes
 * `['running', 'running.engine.active', 'running.signal.red.flashing']`.
 *
 * The visualizer uses this to decide which nodes in the definition are active.
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
      paths.push(...activePaths(child, path));
    }
  }
  return paths;
}
