import { useEffect, useMemo, useState } from 'react';
import type { StateValue } from 'xstate';
import { connectPopupReceiver } from './bridge/popupReceiver';
import type { SerializableLogEntry, SerializableMachine } from './bridge/protocol';
import { activePaths, type StateNodeDefinition } from './inspection';
import { StateTree } from './StateTree';
import './App.css';

type ConnectionState = 'waiting' | 'connected' | 'closed' | 'orphan';

/**
 * Popup-side visualizer. Receives portable machine structure + live snapshots
 * over `postMessage` from the host (typically a machine running in an iframe).
 */
export default function VisualizerApp() {
  const [connection, setConnection] = useState<ConnectionState>('waiting');
  const [machine, setMachine] = useState<SerializableMachine | null>(null);
  const [stateValue, setStateValue] = useState<unknown>(undefined);
  const [context, setContext] = useState<unknown>(undefined);
  const [log, setLog] = useState<SerializableLogEntry[]>([]);

  useEffect(() => {
    if (!window.opener && window.parent === window) {
      setConnection('orphan');
      return;
    }

    return connectPopupReceiver((message) => {
      switch (message.type) {
        case '@viz.machine':
          setConnection('connected');
          setMachine(message.payload);
          break;
        case '@viz.snapshot':
          setConnection('connected');
          setStateValue(message.payload.value);
          setContext(message.payload.context);
          break;
        case '@viz.log':
          setConnection('connected');
          setLog((prev) => [message.payload, ...prev].slice(0, 40));
          break;
        case '@viz.closed':
          setConnection('closed');
          break;
      }
    });
  }, []);

  const active = useMemo(() => {
    if (stateValue === undefined) return new Set<string>();
    return new Set(activePaths(stateValue as StateValue));
  }, [stateValue]);

  const definition = machine?.definition as StateNodeDefinition | undefined;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title-row">
          <h1>Visualizer</h1>
          <StatusPill state={connection} />
        </div>
        <p>
          Receiving events over <code>postMessage</code> from the host window
          (machine may live in a hidden iframe).
        </p>
      </header>

      {connection === 'orphan' && (
        <p className="banner banner--warn">
          Opened directly — no host opener. Open this page via the host&apos;s
          &ldquo;Pop out visualizer&rdquo; button instead.
        </p>
      )}
      {connection === 'waiting' && (
        <p className="banner">Waiting for host handshake…</p>
      )}
      {connection === 'closed' && (
        <p className="banner banner--warn">Host closed the connection.</p>
      )}

      <main className="panels">
        <section className="panel">
          <h2>Machine structure</h2>
          {definition ? (
            <StateTree node={definition} activePaths={active} />
          ) : (
            <p className="muted">No machine definition received yet.</p>
          )}
        </section>

        <section className="panel">
          <h2>Current state</h2>
          <pre className="code">{JSON.stringify(stateValue, null, 2)}</pre>
          <h3>Context</h3>
          <pre className="code">{JSON.stringify(context, null, 2)}</pre>

          <h2>Event log</h2>
          <ul className="log">
            {log.map((entry) => (
              <li
                key={entry.seq}
                className={`log__item log__item--${entry.type.replace('@xstate.', '')}`}
              >
                <span className="log__type">{entry.type}</span>
                {entry.eventType && (
                  <span className="log__event">{entry.eventType}</span>
                )}
                {entry.value !== undefined && (
                  <span className="log__value">{JSON.stringify(entry.value)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
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
  return <span className={`status status--${state}`}>{label}</span>;
}
