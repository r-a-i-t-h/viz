/**
 * Framework-agnostic visualizer API.
 *
 * Real host apps (hidden iframe) typically only depend on this module:
 * attach `inspect` to an actor, call `openPopup()` from a user gesture.
 * No React and no visualizer CSS are required.
 *
 * Inspection = XState inspect stream.
 * Projection = walk live logic → Viz* model (host-side only).
 */
export {
  createVisualizerHost,
  type VisualizerHost,
  type VisualizerHostOptions,
  type VisualizerListener,
  type VisualizerSnapshot,
  type HostBridgeStatus,
} from './createVisualizerHost';

export {
  machineLogicFromEvent,
  projectFrame,
  projectMachine,
  activePaths,
  normalizeStateNodeId,
} from './project';

export type {
  VizAnalysis,
  VizBadge,
  VizBadgeKind,
  VizEvent,
  VizFrame,
  VizInvoke,
  VizLogEntry,
  VizMachine,
  VizNextEvent,
  VizNode,
  VizNodeDetails,
  VizNodeKind,
  VizSymbol,
  VizTransition,
} from './model';

export { collectNextEvents } from './nextEvents';
export { computeContextKeyAges } from './contextAges';

export {
  analyzeContextDeps,
  type ContextDepEdge,
  type ContextDepGraph,
  type ContextDepNode,
  type DepCoverage,
  type DepEntityKind,
  type DepRelation,
  type DepSite,
} from './contextDeps';

export { connectPopupReceiver } from './bridge/popupReceiver';
