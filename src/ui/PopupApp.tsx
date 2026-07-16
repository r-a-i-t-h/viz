import { useEffect, useState } from 'react';
import {
  connectPopupReceiver,
  type CapturedMachine,
  type LoggedEvent,
  type VisualizerSnapshot,
} from '../viz';
import { VisualizerView } from './VisualizerView';
import './visualizer.css';

type ConnectionState = 'waiting' | 'connected' | 'closed' | 'orphan';

/**
 * Popup page — receives portable payloads via postMessage and renders with the
 * optional React visualizer UI.
 */
export default function PopupApp() {
  const [connection, setConnection] = useState<ConnectionState>('waiting');
  const [snapshot, setSnapshot] = useState<VisualizerSnapshot>({
    machine: null,
    stateValue: undefined,
    context: undefined,
    log: [],
    inlineVisible: false,
    popupStatus: 'idle',
  });

  useEffect(() => {
    if (!window.opener && window.parent === window) {
      setConnection('orphan');
      return;
    }

    return connectPopupReceiver((message) => {
      switch (message.type) {
        case '@viz.machine':
          setConnection('connected');
          setSnapshot((prev) => ({
            ...prev,
            machine: message.payload as CapturedMachine,
            popupStatus: 'connected',
          }));
          break;
        case '@viz.snapshot':
          setConnection('connected');
          setSnapshot((prev) => ({
            ...prev,
            stateValue: message.payload.value,
            context: message.payload.context,
            popupStatus: 'connected',
          }));
          break;
        case '@viz.log':
          setConnection('connected');
          setSnapshot((prev) => ({
            ...prev,
            log: [message.payload as LoggedEvent, ...prev.log].slice(0, 40),
            popupStatus: 'connected',
          }));
          break;
        case '@viz.closed':
          setConnection('closed');
          break;
      }
    });
  }, []);

  return (
    <div
      className="viz"
      style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}
    >
      <header
        className="viz__header"
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
      >
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Visualizer</h1>
        <StatusPill state={connection} />
      </header>
      <p className="viz__muted" style={{ marginBottom: '1rem' }}>
        Popup surface — fed by <code>postMessage</code> from the host API.
      </p>

      {connection === 'orphan' && (
        <p className="viz__muted">
          Opened directly — call <code>viz.openPopup()</code> from the host
          instead.
        </p>
      )}
      {connection === 'waiting' && (
        <p className="viz__muted">Waiting for host handshake…</p>
      )}
      {connection === 'closed' && (
        <p className="viz__muted">Host closed the connection.</p>
      )}

      {connection !== 'orphan' && (
        <VisualizerView snapshot={snapshot} title="Popup visualizer" />
      )}
    </div>
  );
}

function StatusPill({ state }: { state: ConnectionState }) {
  const label =
    state === 'connected'
      ? 'connected'
      : state === 'waiting'
        ? 'waiting'
        : state === 'closed'
          ? 'closed'
          : 'no host';
  const color =
    state === 'connected'
      ? '#4ade80'
      : state === 'waiting'
        ? '#fbbf24'
        : '#f87171';
  return (
    <span
      style={{
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '0.15rem 0.5rem',
        borderRadius: 999,
        background: '#2a3244',
        color,
      }}
    >
      {label}
    </span>
  );
}
