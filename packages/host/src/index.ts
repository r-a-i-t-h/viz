/**
 * Host library: inspect + project live XState logic → Viz*, open popup bridge.
 *
 * Depends on `@r-a-i-t-h/viz-protocol` for the shared model/wire types.
 * Peer: `xstate` v5.
 */

export {
  createVisualizerHost,
  type VisualizerHost,
  type VisualizerHostOptions,
  type VisualizerListener,
} from './createVisualizerHost.js';

export type { HostBridgeStatus, VisualizerSnapshot } from '@r-a-i-t-h/viz-protocol';

export {
  machineLogicFromEvent,
  projectFrame,
  projectMachine,
  portableizeContext,
  activePaths,
} from './project.js';

export { normalizeStateNodeId } from '@r-a-i-t-h/viz-protocol';

export { collectNextEvents } from './nextEvents.js';
export { computeContextKeyAges } from './contextAges.js';

export {
  analyzeContextDeps,
  type ContextDepEdge,
  type ContextDepGraph,
  type ContextDepNode,
  type DepCoverage,
  type DepEntityKind,
  type DepRelation,
  type DepSite,
} from './contextDeps.js';

/** Re-export protocol model for apps that only install `@r-a-i-t-h/viz-host`. */
export type {
  VizActorRefMarker,
  VizAnalysis,
  VizBadge,
  VizBadgeKind,
  VizEvent,
  VizFrame,
  VizInvoke,
  VizLogEntry,
  VizMachine,
  VizNextEvent,
  VizNextEventCandidate,
  VizNode,
  VizNodeDetails,
  VizNodeKind,
  VizSymbol,
  VizTransition,
} from '@r-a-i-t-h/viz-protocol';

export { isVizActorRefMarker } from '@r-a-i-t-h/viz-protocol';
