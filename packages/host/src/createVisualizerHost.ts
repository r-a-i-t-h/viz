import type { AnyEventObject, InspectionEvent, MachineContext } from 'xstate';
import {
  DEFAULT_MAX_LOG_ENTRIES_PER_SESSION,
  retainLogEntriesPerSession,
  type HostBridgeStatus,
  type VizFrame,
  type VizLogEntry,
  type VizMachine,
  type VisualizerSnapshot,
} from '@r-a-i-t-h/viz-protocol';
import { HostBridge } from './bridge/hostBridge.js';
import {
  machineLogicFromEvent,
  projectFrame,
  projectMachine,
} from './project.js';

export type { HostBridgeStatus, VisualizerSnapshot } from '@r-a-i-t-h/viz-protocol';

export interface VisualizerHostOptions {
  /**
   * Absolute or same-origin URL of the visualizer page.
   * Required for `openPopup()`.
   */
  visualizerUrl: string;
  /**
   * Max event-log entries retained **per actor session** (subscribers + popup
   * deferred replay). Chatty machines cannot evict quieter ones.
   * @default 20 ({@link DEFAULT_MAX_LOG_ENTRIES_PER_SESSION})
   */
  maxLogEntries?: number;
  /**
   * Scrub context before frames are stored / sent over postMessage.
   * Runs after actor-ref enrichment so spawn↔sessionId markers can survive
   * if the hook leaves those keys intact.
   */
  sanitizeContext?: (context: MachineContext) => MachineContext;
  /** Scrub events before logging event types (and any future event payloads). */
  sanitizeEvent?: (event: AnyEventObject) => AnyEventObject;
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
 *   visualizerUrl: 'https://your-viz-host/',
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
  const maxLogEntries =
    options.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES_PER_SESSION;
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
      const machine = projectMachine(resolved.logic, resolved.sessionId, {
        parentSessionId: resolved.parentSessionId,
        input: resolved.input,
      });
      machines.set(machine.sessionId, machine);
      bridge.sendMachine(machine);
    }

    const logged = summarizeInspectionEvent(event, seq++, options.sanitizeEvent);

    if (event.type === '@xstate.snapshot') {
      const snapshot = event.snapshot as {
        value?: unknown;
        context?: unknown;
        status?: string;
        output?: unknown;
        children?: Record<string, unknown>;
      };
      const sessionId = logged.sessionId;
      const frame = projectFrame(sessionId, snapshot, {
        eventType: logged.eventType,
        previousContext: previousContexts.get(sessionId),
        previousAges: previousContextAges.get(sessionId),
        machine: machines.get(sessionId),
        sanitizeContext: options.sanitizeContext
          ? (ctx) =>
              options.sanitizeContext!(
                (ctx ?? {}) as MachineContext,
              ) as unknown
          : undefined,
      });
      previousContexts.set(sessionId, frame.context);
      if (frame.contextKeyAges) {
        previousContextAges.set(sessionId, frame.contextKeyAges);
      }
      frames.set(frame.sessionId, frame);
      // Snapshot rows carry the projected frame for UI history scrubbing
      // (view-only — does not rewind the live actor).
      logged.frame = frame;
      bridge.sendFrame(frame);
    }

    log = retainLogEntriesPerSession(
      [logged, ...log],
      logged.sessionId,
      maxLogEntries,
    );
    bridge.sendLog(logged);

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
  sanitizeEvent?: (event: AnyEventObject) => AnyEventObject,
): VizLogEntry {
  const actorRef = event.actorRef as { sessionId?: string };
  const base: VizLogEntry = {
    seq,
    type: event.type,
    sessionId: actorRef?.sessionId ?? '(unknown)',
    at: Date.now(),
  };

  if ('event' in event && event.event) {
    const scrubbed = sanitizeEvent
      ? sanitizeEvent(event.event as AnyEventObject)
      : event.event;
    base.eventType = scrubbed.type;
  }
  if ('snapshot' in event && event.snapshot) {
    const snapshot = event.snapshot as { value?: unknown };
    base.value = snapshot.value;
  }

  return base;
}
