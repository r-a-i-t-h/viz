import { useEffect, useMemo, useRef, useState } from 'react';
import { createActor, type InspectionEvent } from 'xstate';
import { createInspector, type StatelyInspectionEvent } from '@statelyai/inspect';
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

export default function App() {
  const actorRef = useRef<ReturnType<typeof createActor<typeof demoMachine>>>(null);
  const seqRef = useRef(0);

  const [machine, setMachine] = useState<CapturedMachine | null>(null);
  const [stateValue, setStateValue] = useState<unknown>(undefined);
  const [context, setContext] = useState<unknown>(undefined);
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const [libraryActorEvent, setLibraryActorEvent] =
    useState<StatelyInspectionEvent | null>(null);

  useEffect(() => {
    // A custom in-memory adapter so we can watch the *library's* serialized
    // events. This proves the inspect library responds to inspection events and
    // that its `@xstate.actor` event carries the machine config as `definition`.
    const inspector = createInspector({
      send: (event) => {
        if (event.type === '@xstate.actor') {
          setLibraryActorEvent(event);
        }
      },
    });

    const inspect = (event: InspectionEvent) => {
      // 1. Feed the Stately inspect library so it can process/serialize events.
      inspector.inspect.next?.(event);

      // 2. Our own handling: capture structure once, log everything.
      const captured = captureMachine(event);
      if (captured) setMachine(captured);

      setLog((prev) => [summarizeEvent(event, seqRef.current++), ...prev].slice(0, 40));
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
    };
  }, []);

  const active = useMemo(() => {
    if (stateValue === undefined) return new Set<string>();
    return new Set(activePaths(stateValue as never));
  }, [stateValue]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>XState v5 Inspection Visualizer</h1>
        <p>
          The full machine make-up is captured from{' '}
          <code>actorRef.logic.definition</code> on the{' '}
          <code>@xstate.actor</code> event, then live snapshot values are
          overlaid to highlight active states.
        </p>
      </header>

      <section className="controls">
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

      <main className="panels">
        <section className="panel">
          <h2>Machine structure (from definition)</h2>
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
              <li key={entry.seq} className={`log__item log__item--${entry.type.replace('@xstate.', '')}`}>
                <span className="log__type">{entry.type}</span>
                {entry.eventType && <span className="log__event">{entry.eventType}</span>}
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
