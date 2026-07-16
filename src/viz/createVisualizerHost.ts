import type { InspectionEvent } from 'xstate';
import { HostBridge, type HostBridgeStatus } from './bridge/hostBridge';
import {
  captureMachine,
  summarizeEvent,
  type CapturedMachine,
  type LoggedEvent,
} from './inspection';

export type { HostBridgeStatus };

export interface VisualizerHostOptions {
  /**
   * Absolute or same-origin URL of the visualizer page (e.g. visualizer.html).
   * Required for `openPopup()`.
   */
  visualizerUrl: string;
  /** Max log entries retained for subscribers and popup replay. @default 100 */
  maxLogEntries?: number;
}

/**
 * Portable snapshot of everything a visualizer UI needs.
 * Framework-agnostic — React (or anything else) can subscribe and render.
 */
export interface VisualizerSnapshot {
  machine: CapturedMachine | null;
  stateValue: unknown;
  context: unknown;
  log: LoggedEvent[];
  /** Whether an in-page visualizer surface should be shown (caller decides how). */
  inlineVisible: boolean;
  popupStatus: HostBridgeStatus;
}

export type VisualizerListener = (snapshot: VisualizerSnapshot) => void;

/**
 * Framework-agnostic visualizer host API.
 *
 * Real deployments typically only call `openPopup()` from a user gesture
 * (or a parent-page message that triggers one). Inline visibility is optional
 * and mainly useful for local PoCs — the host iframe need not ship any UI.
 *
 * @example
 * ```ts
 * const viz = createVisualizerHost({
 *   visualizerUrl: new URL('visualizer.html', location.href).href,
 * });
 * const actor = createActor(machine, { inspect: viz.inspect });
 * actor.start();
 *
 * // From a click handler, console, or parent postMessage bridge:
 * viz.openPopup();
 * viz.showInline();
 * ```
 */
export interface VisualizerHost {
  /**
   * Pass to `createActor(machine, { inspect: host.inspect })`.
   * Captures machine structure and streams portable events to the popup / subscribers.
   */
  readonly inspect: (event: InspectionEvent) => void;

  /** Open (or focus) the popup visualizer. Must run from a user gesture. */
  openPopup(): boolean;

  /** Request that subscribers show an in-page visualizer. */
  showInline(): void;

  /** Request that subscribers hide the in-page visualizer. */
  hideInline(): void;

  /** Toggle in-page visualizer visibility. Returns the new value. */
  toggleInline(): boolean;

  isInlineVisible(): boolean;

  getPopupStatus(): HostBridgeStatus;

  getSnapshot(): VisualizerSnapshot;

  /** Subscribe to snapshot changes. Returns an unsubscribe function. */
  subscribe(listener: VisualizerListener): () => void;

  dispose(): void;
}

/**
 * Create a visualizer host that attaches to an XState actor via `inspect`.
 * No React, no CSS — pure API. Optional UIs subscribe or call these methods.
 */
export function createVisualizerHost(
  options: VisualizerHostOptions,
): VisualizerHost {
  const maxLogEntries = options.maxLogEntries ?? 100;
  const listeners = new Set<VisualizerListener>();

  let machine: CapturedMachine | null = null;
  let stateValue: unknown = undefined;
  let context: unknown = undefined;
  let log: LoggedEvent[] = [];
  let inlineVisible = false;
  let seq = 0;

  const bridge = new HostBridge({
    visualizerUrl: options.visualizerUrl,
    maxLogDeferred: maxLogEntries,
    onStatus: () => emit(),
  });

  const emit = () => {
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot);
  };

  const getSnapshot = (): VisualizerSnapshot => ({
    machine,
    stateValue,
    context,
    log,
    inlineVisible,
    popupStatus: bridge.getStatus(),
  });

  const inspect = (event: InspectionEvent) => {
    const captured = captureMachine(event);
    if (captured) {
      machine = captured;
      bridge.sendMachine(captured);
    }

    const logged = summarizeEvent(event, seq++);
    log = [logged, ...log].slice(0, maxLogEntries);
    bridge.sendLog(logged);

    if (event.type === '@xstate.snapshot') {
      const snapshot = event.snapshot as {
        value?: unknown;
        context?: unknown;
      };
      stateValue = snapshot.value;
      context = snapshot.context;
      bridge.sendSnapshot({
        sessionId: logged.sessionId,
        value: snapshot.value,
        context: snapshot.context,
        eventType: logged.eventType,
      });
    }

    emit();
  };

  const host: VisualizerHost = {
    inspect,

    openPopup() {
      const ok = bridge.open();
      emit();
      return ok;
    },

    showInline() {
      if (inlineVisible) return;
      inlineVisible = true;
      emit();
    },

    hideInline() {
      if (!inlineVisible) return;
      inlineVisible = false;
      emit();
    },

    toggleInline() {
      inlineVisible = !inlineVisible;
      emit();
      return inlineVisible;
    },

    isInlineVisible() {
      return inlineVisible;
    },

    getPopupStatus() {
      return bridge.getStatus();
    },

    getSnapshot,

    subscribe(listener) {
      listeners.add(listener);
      listener(getSnapshot());
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      listeners.clear();
      bridge.dispose();
    },
  };

  return host;
}
