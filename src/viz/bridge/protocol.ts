/**
 * Cross-window protocol for the visualizer.
 *
 * Transport: `window.postMessage` with targetOrigin `"*"`.
 *
 * Why postMessage (and not BroadcastChannel / SharedWorker / etc.):
 * - Works across origins (hidden iframe on host-A, popup from host-B).
 * - Works when the machine runs inside a sandboxed iframe (given
 *   `allow-scripts` + `allow-popups` / `allow-popups-to-escape-sandbox`).
 * - Needs no permissions, service workers, or shared storage.
 * - Same approach used by `@statelyai/inspect`'s BrowserAdapter.
 *
 * Handshake (mirrors Stately's `@statelyai.connected`):
 * 1. Host opens the popup via `window.open` (must be a user gesture).
 * 2. Popup loads and posts `@viz.hello` to `window.opener`.
 * 3. Host marks the link connected and replays deferred payloads
 *    (VizMachine + latest VizFrame), then streams live updates.
 *
 * Payloads are already-projected viz models — not raw XState definitions.
 */

import type { VizFrame, VizLogEntry, VizMachine } from '../model';

export const VIZ_CHANNEL = 'viz' as const;
export const VIZ_PROTOCOL_VERSION = 1 as const;

/** Namespaced window name so a second open focuses the same popup. */
export const VIZ_WINDOW_NAME = 'viz-inspector';

/** Messages the popup sends to the host. */
export type VizUpstreamMessage =
  | {
      channel: typeof VIZ_CHANNEL;
      type: '@viz.hello';
      version: typeof VIZ_PROTOCOL_VERSION;
    }
  | {
      channel: typeof VIZ_CHANNEL;
      type: '@viz.bye';
    };

/** Messages the host sends to the popup. */
export type VizDownstreamMessage =
  | {
      channel: typeof VIZ_CHANNEL;
      type: '@viz.machine';
      payload: VizMachine;
    }
  | {
      channel: typeof VIZ_CHANNEL;
      type: '@viz.frame';
      payload: VizFrame;
    }
  | {
      channel: typeof VIZ_CHANNEL;
      type: '@viz.log';
      payload: VizLogEntry;
    }
  | {
      channel: typeof VIZ_CHANNEL;
      type: '@viz.closed';
    };

export type VizMessage = VizUpstreamMessage | VizDownstreamMessage;

export function isVizMessage(data: unknown): data is VizMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'channel' in data &&
    (data as { channel: unknown }).channel === VIZ_CHANNEL &&
    'type' in data &&
    typeof (data as { type: unknown }).type === 'string'
  );
}

/**
 * Structured-clone / postMessage–safe serialization.
 * Drops functions and other non-JSON values (should already be gone after
 * projection, but kept as a safety net).
 */
export function toPortable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'function' ? undefined : v)),
  ) as T;
}
