/**
 * Framework-agnostic visualizer API.
 *
 * Real host apps (hidden iframe) typically only depend on this module:
 * attach `inspect` to an actor, call `openPopup()` from a user gesture.
 * No React and no visualizer CSS are required.
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
  activePaths,
  captureMachine,
  summarizeEvent,
  type CapturedMachine,
  type LoggedEvent,
  type StateNodeDefinition,
} from './inspection';

export { connectPopupReceiver } from './bridge/popupReceiver';
export type {
  SerializableLogEntry,
  SerializableMachine,
  SerializableSnapshot,
} from './bridge/protocol';
