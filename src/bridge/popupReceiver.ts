import {
  isVizMessage,
  VIZ_CHANNEL,
  VIZ_PROTOCOL_VERSION,
  type VizDownstreamMessage,
  type VizUpstreamMessage,
} from './protocol';

export type PopupMessageHandler = (message: VizDownstreamMessage) => void;

/**
 * Runs inside the popup visualizer. Announces readiness to `window.opener`
 * (the host, which may itself be a nested iframe) and delivers downstream
 * messages to a handler.
 */
export function connectPopupReceiver(onMessage: PopupMessageHandler): () => void {
  const handle = (event: MessageEvent) => {
    if (!isVizMessage(event.data)) return;
    const data = event.data;
    if (
      data.type === '@viz.machine' ||
      data.type === '@viz.snapshot' ||
      data.type === '@viz.log' ||
      data.type === '@viz.closed'
    ) {
      onMessage(data);
    }
  };

  window.addEventListener('message', handle);

  // Announce to whoever opened us. Prefer opener (popup case); fall back to
  // parent (if the visualizer is ever embedded as an iframe instead).
  const target: Window | null =
    window.opener && !window.opener.closed
      ? window.opener
      : window.parent !== window
        ? window.parent
        : null;

  if (target) {
    const hello: VizUpstreamMessage = {
      channel: VIZ_CHANNEL,
      type: '@viz.hello',
      version: VIZ_PROTOCOL_VERSION,
    };
    target.postMessage(hello, '*');
  }

  return () => {
    window.removeEventListener('message', handle);
    if (target) {
      const bye: VizUpstreamMessage = { channel: VIZ_CHANNEL, type: '@viz.bye' };
      try {
        target.postMessage(bye, '*');
      } catch {
        // ignore
      }
    }
  };
}
