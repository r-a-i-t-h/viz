import {
  DEFAULT_MAX_LOG_ENTRIES_PER_SESSION,
  isVizMessage,
  toPortable,
  VIZ_CHANNEL,
  VIZ_WINDOW_NAME,
  type HostBridgeStatus,
  type VizDownstreamMessage,
  type VizFrame,
  type VizLogEntry,
  type VizMachine,
  type VizUpstreamMessage,
} from '@r-a-i-t-h/viz-protocol';

export type { HostBridgeStatus };

type VizLogMessage = Extract<VizDownstreamMessage, { type: '@viz.log' }>;

export interface HostBridgeOptions {
  /** Absolute or same-origin URL of the visualizer page. */
  visualizerUrl: string;
  /** Max deferred log events **per sessionId** when the popup (re)connects. */
  maxLogDeferred?: number;
  onStatus?: (status: HostBridgeStatus) => void;
}

/**
 * Opens a popup visualizer and forwards projected viz payloads to it
 * via `postMessage`. Designed to run inside a (possibly cross-origin) iframe.
 */
export class HostBridge {
  private popup: Window | null = null;
  private status: HostBridgeStatus = 'idle';
  /** Latest VizMachine per sessionId — all replayed on (re)connect. */
  private machines = new Map<string, VizDownstreamMessage>();
  /** Latest VizFrame per sessionId — all replayed on (re)connect. */
  private frames = new Map<string, VizDownstreamMessage>();
  /** Deferred logs per sessionId (oldest→newest within each session). */
  private deferredLogsBySession = new Map<string, VizLogMessage[]>();
  private readonly maxLogDeferred: number;
  private readonly visualizerUrl: string;
  private readonly onStatus?: (status: HostBridgeStatus) => void;
  private closePoll: number | null = null;

  private readonly onPageHide = () => {
    // Fires on host refresh/navigation before unload — tell the popup to close
    // so a later openPopup() gets a clean handshake (not a stale orphan).
    if (this.popup && !this.popup.closed) {
      this.post({ channel: VIZ_CHANNEL, type: '@viz.closed' });
    }
  };

  private readonly onMessage = (event: MessageEvent) => {
    if (!isVizMessage(event.data)) return;
    const data = event.data as VizUpstreamMessage;

    if (data.type === '@viz.hello') {
      // Always re-bind from event.source. Relying only on the Window returned
      // by window.open breaks after React StrictMode remounts: the popup sends
      // @viz.bye (clears this.popup) then @viz.hello (marks connected) — without
      // rebinding, status is "connected" but post() no-ops.
      if (isWindowSource(event.source)) {
        this.popup = event.source;
      }
      this.setStatus('connected');
      this.startClosePoll();
      this.replay();
      return;
    }

    if (data.type === '@viz.bye') {
      // Ignore bye unless it came from the window we are currently talking to.
      // Transient remounts in the popup must not drop the live handle.
      if (isWindowSource(event.source) && event.source === this.popup) {
        this.popup = null;
        this.stopClosePoll();
        this.setStatus('idle');
      }
    }
  };

  constructor(options: HostBridgeOptions) {
    this.visualizerUrl = options.visualizerUrl;
    this.maxLogDeferred =
      options.maxLogDeferred ?? DEFAULT_MAX_LOG_ENTRIES_PER_SESSION;
    this.onStatus = options.onStatus;
    window.addEventListener('message', this.onMessage);
    window.addEventListener('pagehide', this.onPageHide);
  }

  getStatus(): HostBridgeStatus {
    return this.status;
  }

  /**
   * Must be called from a user gesture (click). Popup blockers are especially
   * aggressive when the opener lives inside an iframe.
   */
  open(): boolean {
    this.setStatus('opening');
    const features = 'popup=yes,width=960,height=720';
    // Do NOT pass `noopener` — we need the Window handle AND the popup needs
    // `window.opener` so it can send `@viz.hello` back.
    const popup = window.open(this.visualizerUrl, VIZ_WINDOW_NAME, features);

    if (!popup) {
      this.setStatus('blocked');
      return false;
    }

    this.popup = popup;
    this.setStatus('awaiting-hello');
    this.startClosePoll();
    return true;
  }

  sendMachine(machine: VizMachine): void {
    const message: VizDownstreamMessage = {
      channel: VIZ_CHANNEL,
      type: '@viz.machine',
      payload: toPortable(machine),
    };
    this.machines.set(machine.sessionId, message);
    if (this.status === 'connected') this.post(message);
  }

  sendFrame(frame: VizFrame): void {
    const message: VizDownstreamMessage = {
      channel: VIZ_CHANNEL,
      type: '@viz.frame',
      payload: toPortable(frame),
    };
    this.frames.set(frame.sessionId, message);
    if (this.status === 'connected') this.post(message);
  }

  sendLog(entry: VizLogEntry): void {
    // Live path keeps optional snapshot `frame` for history scrubbing.
    // Deferred reconnect replay strips it — reload may clear history; latest
    // per-session frame is already replayed via `frames`.
    const live: VizDownstreamMessage = {
      channel: VIZ_CHANNEL,
      type: '@viz.log',
      payload: toPortable(entry),
    };
    const { frame: _frame, ...withoutFrame } = entry;
    const deferred: VizLogMessage = {
      channel: VIZ_CHANNEL,
      type: '@viz.log',
      payload: toPortable(withoutFrame),
    };
    const list = this.deferredLogsBySession.get(entry.sessionId) ?? [];
    list.push(deferred);
    if (list.length > this.maxLogDeferred) {
      list.shift();
    }
    this.deferredLogsBySession.set(entry.sessionId, list);
    if (this.status === 'connected') this.post(live);
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('pagehide', this.onPageHide);
    this.stopClosePoll();
    if (this.popup && !this.popup.closed) {
      this.post({ channel: VIZ_CHANNEL, type: '@viz.closed' });
    }
    this.popup = null;
    this.setStatus('idle');
  }

  private replay(): void {
    for (const msg of this.machines.values()) this.post(msg);
    for (const msg of this.frames.values()) this.post(msg);
    const deferred = [...this.deferredLogsBySession.values()]
      .flat()
      .sort((a, b) => a.payload.seq - b.payload.seq);
    for (const msg of deferred) this.post(msg);
  }

  private post(message: VizDownstreamMessage): void {
    if (!this.popup || this.popup.closed) return;
    try {
      this.popup.postMessage(message, '*');
    } catch {
      // Cross-origin / closed-window races; ignore.
    }
  }

  private startClosePoll(): void {
    this.stopClosePoll();
    this.closePoll = window.setInterval(() => {
      if (this.popup && this.popup.closed) {
        this.stopClosePoll();
        this.popup = null;
        this.setStatus('idle');
      }
    }, 500);
  }

  private stopClosePoll(): void {
    if (this.closePoll !== null) {
      window.clearInterval(this.closePoll);
      this.closePoll = null;
    }
  }

  private setStatus(status: HostBridgeStatus): void {
    this.status = status;
    this.onStatus?.(status);
  }
}

function isWindowSource(source: MessageEventSource | null): source is Window {
  return (
    source !== null &&
    typeof source === 'object' &&
    'postMessage' in source &&
    'closed' in source
  );
}
