import type { StateValue } from 'xstate';
import { activePaths, type VisualizerSnapshot } from '../viz';
import { StateTree } from './StateTree';
import './visualizer.css';

/**
 * Optional React renderer for a {@link VisualizerSnapshot}.
 * Importing this module pulls in visualizer CSS — do not import it from a
 * headless host that only needs `openPopup()`.
 */
export function VisualizerView({
  snapshot,
  title = 'Visualizer',
}: {
  snapshot: VisualizerSnapshot;
  title?: string;
}) {
  const active =
    snapshot.stateValue === undefined
      ? new Set<string>()
      : new Set(activePaths(snapshot.stateValue as StateValue));

  return (
    <div className="viz">
      <header className="viz__header">
        <h2 className="viz__title">{title}</h2>
      </header>

      <main className="viz__panels">
        <section className="viz__panel">
          <h3>Machine structure</h3>
          {snapshot.machine ? (
            <StateTree
              node={snapshot.machine.definition}
              activePaths={active}
            />
          ) : (
            <p className="viz__muted">Waiting for machine definition…</p>
          )}
        </section>

        <section className="viz__panel">
          <h3>Current state</h3>
          <pre className="viz__code">
            {JSON.stringify(snapshot.stateValue, null, 2)}
          </pre>
          <h4>Context</h4>
          <pre className="viz__code">
            {JSON.stringify(snapshot.context, null, 2)}
          </pre>

          <h3>Event log</h3>
          <ul className="viz__log">
            {snapshot.log.map((entry) => (
              <li
                key={entry.seq}
                className={`viz__log-item viz__log-item--${entry.type.replace('@xstate.', '')}`}
              >
                <span className="viz__log-type">{entry.type}</span>
                {entry.eventType && (
                  <span className="viz__log-event">{entry.eventType}</span>
                )}
                {entry.value !== undefined && (
                  <span className="viz__log-value">
                    {JSON.stringify(entry.value)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
