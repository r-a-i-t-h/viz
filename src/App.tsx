import { useEffect, useMemo, useRef, useState } from 'react';
import { createActor, type InspectionEvent } from 'xstate';
import { createInspector, type StatelyInspectionEvent } from '@statelyai/inspect';
import { HostBridge, type HostBridgeStatus } from './bridge/hostBridge';
import { demoMachine } from './machine';
import {
  activePaths,
  captureMachine,
  summarizeEvent,
  type CapturedMachine,
  type LoggedEvent,
} from './inspection';
import { StateTree } from './StateTree';
import './App.css';

type ActorEvent = Parameters<ReturnType<typeof createActor<typeof demoMachine>>['send']>[0];

const SEND_BUTTONS: { label: string; event: ActorEvent }[] = [
  { label: 'START', event: { type: 'START' } },
  { label: 'TICK', event: { type: 'TICK' } },
  { label: 'PAUSE', event: { type: 'PAUSE' } },
  { label: 'RESUME', event: { type: 'RESUME' } },
  { label: 'CYCLE', event: { type: 'CYCLE' } },
  { label: 'TOGGLE_MODE', event: { type: 'TOGGLE_MODE' } },
  { label: 'STOP', event: { type: 'STOP' } },
];

const STATUS_LABEL: Record<HostBridgeStatus, string> = {
  idle: 'popup closed',
  opening: 'opening…',
  'awaiting-hello': 'awaiting handshake…',
  connected: 'popup connected',
  blocked: 'popup blocked',
};

export default function App() {
  const actorRef = useRef<ReturnType<typeof createActor<typeof demoMachine>>>(null);
  const bridgeRef = useRef<HostBridge | null>(null);
  const seqRef = useRef(0);

  const [machine, setMachine] = useState<CapturedMachine | null>(null);
  const [stateValue, setStateValue] = useState<unknown>(undefined);
  const [context, setContext] = useState<unknown>(undefined);
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const [libraryActorEvent, setLibraryActorEvent] =
    useState<StatelyInspectionEvent | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<HostBridgeStatus>('idle');

  useEffect(() => {
    const visualizerUrl = new URL('visualizer.html', window.location.href).href;
    const bridge = new HostBridge({
      visualizerUrl,
      onStatus: setBridgeStatus,
    });
    bridgeRef.current = bridge;

    const inspector = createInspector({
      send: (event) => {
        if (event.type === '@xstate.actor') {
          setLibraryActorEvent(event);
        }
      },
    });

    const inspect = (event: InspectionEvent) => {
      inspector.inspect.next?.(event);

      const captured = captureMachine(event);
      if (captured) {
        setMachine(captured);
        bridge.sendMachine(captured);
      }

      const logged = summarizeEvent(event, seqRef.current++);
      setLog((prev) => [logged, ...prev].slice(0, 40));
      bridge.sendLog(logged);

      if (event.type === '@xstate.snapshot') {
        const snapshot = event.snapshot as {
          value?: unknown;
          context?: unknown;
        };
        bridge.sendSnapshot({
          sessionId: logged.sessionId,
          value: snapshot.value,
          context: snapshot.context,
          eventType: logged.eventType,
        });
      }
    };

    const actor = createActor(demoMachine, { inspect });
    actorRef.current = actor;

    const sub = actor.subscribe((snapshot) => {
      setStateValue(snapshot.value);
      setContext(snapshot.context);
    });

    actor.start();

    return () => {
      sub.unsubscribe();
      actor.stop();
      inspector.stop();
      bridge.dispose();
      bridgeRef.current = null;
    };
  }, []);

  const active = useMemo(() => {
    if (stateValue === undefined) return new Set<string>();
    return new Set(activePaths(stateValue as never));
  }, [stateValue]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title-row">
          <h1>Machine host</h1>
          <span className={`status status--${bridgeStatus}`}>
            {STATUS_LABEL[bridgeStatus]}
          </span>
        </div>
        <p>
          Runs the demo machine and streams portable inspection payloads to a
          popup visualizer over <code>postMessage</code> (works from a hidden
          iframe).
        </p>
      </header>

      <section className="controls">
        <button
          type="button"
          className="controls__primary"
          onClick={() => bridgeRef.current?.open()}
        >
          Pop out visualizer
        </button>
        {SEND_BUTTONS.map(({ label, event }) => (
          <button
            key={label}
            onClick={() => actorRef.current?.send(event)}
            type="button"
          >
            {label}
          </button>
        ))}
      </section>

      {bridgeStatus === 'blocked' && (
        <p className="banner banner--warn">
          Popup was blocked. Allow popups for this origin (especially when
          embedded in an iframe), then try again.
        </p>
      )}

      <main className="panels">
        <section className="panel">
          <h2>Local preview (host)</h2>
          {machine ? (
            <StateTree node={machine.definition} activePaths={active} />
          ) : (
            <p className="muted">Waiting for the @xstate.actor event…</p>
          )}
        </section>

        <section className="panel">
          <h2>Current state</h2>
          <pre className="code">{JSON.stringify(stateValue, null, 2)}</pre>
          <h3>Context</h3>
          <pre className="code">{JSON.stringify(context, null, 2)}</pre>

          <h2>Inspection event log</h2>
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

      <section className="panel">
        <h2>What the inspect library serialized (@xstate.actor)</h2>
        <p className="muted">
          Note the <code>definition</code> field — the library reads{' '}
          <code>actorRef.logic.config</code> and stringifies it here.
        </p>
        <pre className="code code--scroll">
          {libraryActorEvent
            ? JSON.stringify(libraryActorEvent, null, 2)
            : 'Waiting…'}
        </pre>
      </section>
    </div>
  );
}
