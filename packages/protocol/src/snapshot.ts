/**
 * Portable snapshot shared by the host store and any visualizer UI.
 */

import type { VizFrame, VizLogEntry, VizMachine } from './model.js';

export type HostBridgeStatus =
  | 'idle'
  | 'opening'
  | 'awaiting-hello'
  | 'connected'
  | 'blocked';

/**
 * Everything a visualizer UI needs for one tick.
 * Machines and frames are already projected (Viz*), not raw XState shapes.
 */
export interface VisualizerSnapshot {
  /**
   * Every machine-backed actor observed so far (registration order).
   * Each `@xstate.actor` inspection event adds one; a UI with more than one
   * should offer a selector (prefer parent/child tree when links exist).
   */
  machines: VizMachine[];
  /** Latest projected frame per sessionId. */
  frames: Record<string, VizFrame>;
  log: VizLogEntry[];
  /** Whether an in-page visualizer surface should be shown (caller decides how). */
  inlineVisible: boolean;
  popupStatus: HostBridgeStatus;
}
