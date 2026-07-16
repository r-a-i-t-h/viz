import {
  isVizMessage,
  toPortable,
  VIZ_WINDOW_NAME,
  type SerializableLogEntry,
  type SerializableMachine,
  type SerializableSnapshot,
  type VizDownstreamMessage,
  type VizUpstreamMessage,
} from './protocol';

export type HostBridgeStatus = 'idle' | 'opening' | 'awaiting-hello' | 'connected' | 'blocked';

export interface HostBridgeOptions {
  /** Absolute or same-origin URL of the visualizer page. */
  visualizerUrl: string;
  /** Max log events to keep for replay when the popup (re)connects. */
  maxLogDeferred?: number;
  onStatus?: (status: HostBridgeStatus) => void;
}

/**
 * Opens a popup visualizer and forwards serializable inspection payloads to it
 * via `postMessage`. Designed to run inside a (possibly cross-origin) iframe.
 */
export class HostBridge {
  private popup: Window | null = null;
  private status: HostBridgeStatus = 'idle';
  private latestMachine: VizDownstreamMessage | null = null;
  private latestSnapshot: VizDownstreamMessage | null = null;
  private deferredLogs: VizDownstreamMessage[] = [];
  private readonly maxLogDeferred: number;
  private readonly visualizerUrl: string;
  private readonly onStatus?: (status: HostBridgeStatus) => void;
  private closePoll: number | null = null;

  private readonly onMessage = (event: MessageEvent) => {
    if (!isVizMessage(event.data)) return;
    const data = event.data as VizUpstreamMessage;
    if (data.type === '@viz.hello') {
      this.setStatus('connected');
      this.replay();
      return;
    }
    if (data.type === '@viz.bye') {
      this.popup = null;
      this.setStatus('idle');
    }
  };

  constructor(options: HostBridgeOptions) {
    this.visualizerUrl = options.visualizerUrl;
    this.maxLogDeferred = options.maxLogDeferred ?? 100;
    this.onStatus = options.onStatus;
    window.addEventListener('message', this.onMessage);
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

  sendMachine(machine: SerializableMachine): void {
    const message: VizDownstreamMessage = {
      channel: 'viz',
      type: '@viz.machine',
      payload: toPortable(machine),
    };
    this.latestMachine = message;
    if (this.status === 'connected') this.post(message);
  }

  sendSnapshot(snapshot: SerializableSnapshot): void {
    const message: VizDownstreamMessage = {
      channel: 'viz',
      type: '@viz.snapshot',
      payload: toPortable(snapshot),
    };
    this.latestSnapshot = message;
    if (this.status === 'connected') this.post(message);
  }

  sendLog(entry: SerializableLogEntry): void {
    const message: VizDownstreamMessage = {
      channel: 'viz',
      type: '@viz.log',
      payload: toPortable(entry),
    };
    this.deferredLogs.push(message);
    if (this.deferredLogs.length > this.maxLogDeferred) {
      this.deferredLogs.shift();
    }
    if (this.status === 'connected') this.post(message);
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    this.stopClosePoll();
    if (this.popup && !this.popup.closed) {
      this.post({ channel: 'viz', type: '@viz.closed' });
    }
    this.popup = null;
    this.setStatus('idle');
  }

  private replay(): void {
    if (this.latestMachine) this.post(this.latestMachine);
    if (this.latestSnapshot) this.post(this.latestSnapshot);
    for (const msg of this.deferredLogs) this.post(msg);
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
