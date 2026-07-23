/**
 * Shared viz presentation model — spoken by the host projector and the popup UI.
 * No XState structural types here; those stay behind `projectMachine` / `projectFrame`.
 */

import type { ContextDepGraph } from './contextDeps.js';

export interface VizMachine {
  sessionId: string;
  /** Display name (machine id or fallback). */
  label: string;
  /** Parent actor session when this machine was invoked/spawned. */
  parentSessionId?: string;
  /** Actor input captured at registration (portable / sanitized). */
  input?: unknown;
  /** Machine root as a tree. */
  root: VizNode;
  /** Static analyses computed against live logic on the host. */
  analysis: VizAnalysis;
}

/**
 * Portable stand-in for a live ActorRef in scrubbed context.
 * Host replaces refs before postMessage so sessionId survives JSON.
 */
export interface VizActorRefMarker {
  __viz: 'actorRef';
  sessionId: string;
  id: string;
}

export function isVizActorRefMarker(value: unknown): value is VizActorRefMarker {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as VizActorRefMarker).__viz === 'actorRef' &&
    typeof (value as VizActorRefMarker).sessionId === 'string'
  );
}

export interface VizNode {
  id: string;
  key: string;
  kind: VizNodeKind;
  /** Child layout hint — already decided from XState compound vs parallel. */
  layout: 'sequential' | 'parallel' | 'none';
  children: VizNode[];
  /** Which child ids are initial targets (for arrow glyph). */
  initialChildIds: string[];
  /** Compact badges — no raw entry/exit arrays. */
  badges: VizBadge[];
  /** Ordinary named events (not after/always — those are badges + details). */
  events: VizEvent[];
  /** Longer copy for watch cards / hover — still viz vocabulary. */
  details: VizNodeDetails;
}

export type VizNodeKind =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history';

export interface VizBadge {
  kind: VizBadgeKind;
  /** Short label on the node chrome. */
  label: string;
  /** Lines for hover tip. */
  lines: string[];
  /** Node ids to highlight while this badge is hovered. */
  highlightIds: string[];
}

/**
 * Non-`on` (and lifecycle) markers. Projector maps XState concepts → these.
 * Popup only switches on VizBadgeKind.
 */
export type VizBadgeKind =
  | 'entry'
  | 'exit'
  | 'after'
  | 'always'
  | 'invoke'
  | 'history';

export interface VizEvent {
  /** Event type string as shown in the UI (`TICK`, not internal keys). */
  type: string;
  /** Ordered transition candidates (guard cascade). */
  transitions: VizTransition[];
  /** Union of all transition targets — for cheap hover highlight. */
  highlightIds: string[];
  /** Lines for hover when guards/actions exist (subset of full transition lines). */
  hoverLines: string[];
  /** Full transition lines for watch-card details. */
  detailLines: string[];
  /** Wildcard / partial annotation for hover only. */
  pattern?: 'exact' | 'wildcard' | 'partial';
}

export interface VizTransition {
  /** Target node ids (empty = internal / no target). */
  targetIds: string[];
  guard?: VizSymbol;
  actions: VizSymbol[];
  reenter?: boolean;
  /** Delay label for after-transitions. */
  delayLabel?: string;
  /** Preformatted one-line summary for lists. */
  line: string;
}

/** Named executable without the function. */
export interface VizSymbol {
  kind: 'action' | 'guard' | 'actor' | 'delay';
  name: string;
  /** Optional params summary / assign key list, already stringified. */
  detail?: string;
}

export interface VizNodeDetails {
  /** Dot path from machine root keys (`""` = root, `"a.b"` = nested). */
  path: string;
  tags: string[];
  entry: VizSymbol[];
  exit: VizSymbol[];
  after: VizTransition[];
  always: VizTransition[];
  invokes: VizInvoke[];
  history?: 'shallow' | 'deep';
}

export interface VizInvoke {
  id: string;
  src: string;
  inputSummary?: string;
  onDone: VizTransition[];
  onError: VizTransition[];
  highlightIds: string[];
}

export interface VizAnalysis {
  contextDeps: ContextDepGraph;
}

/** Ordered transition candidate for next-events / cond cascade. */
export interface VizNextEventCandidate {
  providerId: string;
  targetIds: string[];
  guard?: VizSymbol;
  actions: VizSymbol[];
  /** Preformatted one-line summary (`1.` prefix added in UI). */
  line: string;
}

/** An event the active configuration can handle, with providing state ids. */
export interface VizNextEvent {
  type: string;
  /** State node ids that declare a handler (including active ancestors). */
  providerIds: string[];
  /** Guard cascade across providers (definition order within each provider). */
  candidates: VizNextEventCandidate[];
  /** Providers + candidate targets — for hover highlight. */
  highlightIds: string[];
}

/** Runtime frame — projected from an inspection snapshot. */
export interface VizFrame {
  sessionId: string;
  /**
   * Active state paths (key segments from the root), same shape as former
   * `activePaths(value)` — used for graph/watch “you are here” overlay.
   */
  activePaths: string[];
  /** Scrubbed context for the dump panel. */
  context: unknown;
  /** Raw state value for the JSON dump panel. */
  value: unknown;
  status: 'active' | 'done' | 'error' | 'stopped';
  output?: unknown;
  /** Event that produced this frame, if any. */
  eventType?: string;
  /**
   * Events since each top-level context key last changed (0 = changed this
   * frame). Host-tracked so popup replay stays consistent.
   */
  contextKeyAges?: Record<string, number>;
  /** Named events the active configuration can handle (+ providing states). */
  nextEvents?: VizNextEvent[];
}

/** Debug log entry (still inspection-flavored for the event log panel). */
export interface VizLogEntry {
  seq: number;
  type: string;
  sessionId: string;
  eventType?: string;
  value?: unknown;
  at: number;
  /**
   * Projected frame for `@xstate.snapshot` rows — enables UI history scrubbing.
   * Omitted on other log types; may be stripped from popup reconnect replay.
   */
  frame?: VizFrame;
}

/** Default max event-log entries retained per actor `sessionId`. */
export const DEFAULT_MAX_LOG_ENTRIES_PER_SESSION = 100;

/**
 * Newest-first log: after prepending an entry for `sessionId`, drop that
 * session’s overflow while leaving other actors untouched.
 */
export function retainLogEntriesPerSession(
  entries: VizLogEntry[],
  sessionId: string,
  maxPerSession: number,
): VizLogEntry[] {
  let keptForSession = 0;
  return entries.filter((entry) => {
    if (entry.sessionId !== sessionId) return true;
    keptForSession += 1;
    return keptForSession <= maxPerSession;
  });
}
