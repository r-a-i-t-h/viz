/**
 * Shared viz presentation model + wire protocol.
 *
 * Host projects into Viz*; visualizer renders Viz*. No XState here.
 */

export type {
  ContextDepEdge,
  ContextDepGraph,
  ContextDepNode,
  DepCoverage,
  DepEntityKind,
  DepRelation,
  DepSite,
} from './contextDeps.js';

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
} from './model.js';

export {
  DEFAULT_MAX_LOG_ENTRIES_PER_SESSION,
  isVizActorRefMarker,
  retainLogEntriesPerSession,
} from './model.js';

export type { HostBridgeStatus, VisualizerSnapshot } from './snapshot.js';

export {
  VIZ_CHANNEL,
  VIZ_PROTOCOL_VERSION,
  VIZ_WINDOW_NAME,
  isVizMessage,
  toPortable,
  type VizDownstreamMessage,
  type VizMessage,
  type VizUpstreamMessage,
} from './protocol.js';

export {
  connectPopupReceiver,
  type PopupMessageHandler,
} from './popupReceiver.js';

export { normalizeStateNodeId } from './ids.js';
