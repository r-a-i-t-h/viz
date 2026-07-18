import type { InspectionEvent } from 'xstate';
import { HostBridge, type HostBridgeStatus } from './bridge/hostBridge';
import type { VizFrame, VizLogEntry, VizMachine } from './model';
import {
  machineLogicFromEvent,
  projectFrame,
  projectMachine,
} from './project';

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
 * Machines and frames are already projected (Viz*), not raw XState shapes.
 */
export interface VisualizerSnapshot {
  /**
   * Every machine-backed actor observed so far (registration order).
   * Each `@xstate.actor` inspection event adds one; a UI with more than one
   * should offer a selector.
   */
  machines: VizMachine[];
  /** Latest projected frame per sessionId. */
  frames: Record<string, VizFrame>;
  log: VizLogEntry[];
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
   * Every new machine actor (root or spawned/invoked) is projected from its
   * `@xstate.actor` event and forwarded to the popup / subscribers.
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
 * Create a visualizer host that attaches to XState actors via `inspect`.
 * No React, no CSS — pure API. Optional UIs subscribe or call these methods.
 */
export function createVisualizerHost(
  options: VisualizerHostOptions,
): VisualizerHost {
  const maxLogEntries = options.maxLogEntries ?? 100;
  const listeners = new Set<VisualizerListener>();

  const machines = new Map<string, VizMachine>();
  const frames = new Map<string, VizFrame>();
  const previousContexts = new Map<string, unknown>();
  const previousContextAges = new Map<string, Record<string, number>>();
  let log: VizLogEntry[] = [];
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
    machines: [...machines.values()],
    frames: Object.fromEntries(frames),
    log,
    inlineVisible,
    popupStatus: bridge.getStatus(),
  });

  const inspect = (event: InspectionEvent) => {
    const resolved = machineLogicFromEvent(event);
    if (resolved) {
      const machine = projectMachine(resolved.logic, resolved.sessionId);
      machines.set(machine.sessionId, machine);
      bridge.sendMachine(machine);
    }

    const logged = summarizeInspectionEvent(event, seq++);
    log = [logged, ...log].slice(0, maxLogEntries);
    bridge.sendLog(logged);

    if (event.type === '@xstate.snapshot') {
      const snapshot = event.snapshot as {
        value?: unknown;
        context?: unknown;
        status?: string;
        output?: unknown;
      };
      const sessionId = logged.sessionId;
      const frame = projectFrame(sessionId, snapshot, {
        eventType: logged.eventType,
        previousContext: previousContexts.get(sessionId),
        previousAges: previousContextAges.get(sessionId),
        machine: machines.get(sessionId),
      });
      previousContexts.set(sessionId, snapshot.context);
      if (frame.contextKeyAges) {
        previousContextAges.set(sessionId, frame.contextKeyAges);
      }
      frames.set(frame.sessionId, frame);
      bridge.sendFrame(frame);
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
      inlineVisible = true;
      emit();
    },

    hideInline() {
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
      bridge.dispose();
      listeners.clear();
      machines.clear();
      frames.clear();
      previousContexts.clear();
      previousContextAges.clear();
      log = [];
    },
  };

  return host;
}

function summarizeInspectionEvent(
  event: InspectionEvent,
  seq: number,
): VizLogEntry {
  const actorRef = event.actorRef as { sessionId?: string };
  const base: VizLogEntry = {
    seq,
    type: event.type,
    sessionId: actorRef?.sessionId ?? '(unknown)',
    at: Date.now(),
  };

  if ('event' in event && event.event) {
    base.eventType = event.event.type;
  }
  if ('snapshot' in event && event.snapshot) {
    const snapshot = event.snapshot as { value?: unknown };
    base.value = snapshot.value;
  }

  return base;
}
