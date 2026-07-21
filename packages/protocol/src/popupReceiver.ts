import {
  isVizMessage,
  VIZ_CHANNEL,
  VIZ_PROTOCOL_VERSION,
  type VizDownstreamMessage,
  type VizUpstreamMessage,
} from './protocol.js';

export type PopupMessageHandler = (message: VizDownstreamMessage) => void;

/**
 * Runs inside the popup visualizer. Announces readiness to `window.opener`
 * (the host, which may itself be a nested iframe) and delivers downstream
 * messages to a handler.
 *
 * Does not send `@viz.bye` on React effect cleanup — StrictMode remounts would
 * otherwise clear the host's popup handle while leaving status "connected".
 * Teardown uses `pagehide` (actual close / navigate) instead.
 *
 * Closes the popup when the host sends `@viz.closed` (including on host
 * refresh via the bridge's `pagehide` handler) or when `window.opener` is gone.
 */
export function connectPopupReceiver(onMessage: PopupMessageHandler): () => void {
  let closed = false;
  let openerPoll: number | null = null;

  const stopOpenerPoll = () => {
    if (openerPoll !== null) {
      window.clearInterval(openerPoll);
      openerPoll = null;
    }
  };

  const closePopup = () => {
    if (closed) return;
    closed = true;
    stopOpenerPoll();
    window.close();
  };

  const handle = (event: MessageEvent) => {
    if (!isVizMessage(event.data)) return;
    const data = event.data;
    if (
      data.type === '@viz.machine' ||
      data.type === '@viz.frame' ||
      data.type === '@viz.log' ||
      data.type === '@viz.closed'
    ) {
      onMessage(data);
      if (data.type === '@viz.closed') closePopup();
    }
  };

  const target: Window | null =
    window.opener && !window.opener.closed
      ? window.opener
      : window.parent !== window
        ? window.parent
        : null;

  const sendBye = () => {
    if (!target) return;
    const bye: VizUpstreamMessage = { channel: VIZ_CHANNEL, type: '@viz.bye' };
    try {
      target.postMessage(bye, '*');
    } catch {
      // ignore
    }
  };

  window.addEventListener('message', handle);
  // pagehide fires on real close/navigation; not on React StrictMode remount.
  window.addEventListener('pagehide', sendBye);

  if (window.opener) {
    openerPoll = window.setInterval(() => {
      if (!window.opener || window.opener.closed) closePopup();
    }, 500);
  }

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
    window.removeEventListener('pagehide', sendBye);
    stopOpenerPoll();
  };
}
