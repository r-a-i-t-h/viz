import { useState } from 'react';
import type { StateValue } from 'xstate';
import { activePaths, type VisualizerSnapshot } from '../viz';
import { StateTree } from './StateTree';
import {
  clampZoomRadius,
  DEFAULT_ZOOM_RADIUS,
  MAX_ZOOM_RADIUS,
  MIN_ZOOM_RADIUS,
} from './zoom';
import './visualizer.css';

/**
 * Optional React renderer for a {@link VisualizerSnapshot}.
 * Importing this module pulls in visualizer CSS — do not import it from a
 * headless host that only needs `openPopup()`.
 */
export function VisualizerView({
  snapshot,
  title = 'Visualizer',
  defaultZoomRadius = DEFAULT_ZOOM_RADIUS,
}: {
  snapshot: VisualizerSnapshot;
  title?: string;
  /** Initial ± hops for click-zoom neighborhood (also adjustable on-screen). */
  defaultZoomRadius?: number;
}) {
  const [zoomRadius, setZoomRadius] = useState(() =>
    clampZoomRadius(defaultZoomRadius),
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const { machines } = snapshot;
  const machine =
    machines.find((m) => m.sessionId === selectedSessionId) ?? machines[0];
  const actorState = machine
    ? snapshot.actorStates[machine.sessionId]
    : undefined;

  const active =
    actorState?.value === undefined
      ? new Set<string>()
      : new Set(activePaths(actorState.value as StateValue));

  return (
    <div className="viz">
      <header className="viz__header">
        <div className="viz__header-row">
          <h2 className="viz__title">{title}</h2>
          {machines.length > 1 && (
            <ActorSelect
              machines={machines}
              selectedSessionId={machine?.sessionId ?? ''}
              onChange={setSelectedSessionId}
            />
          )}
          <ZoomHopsControl value={zoomRadius} onChange={setZoomRadius} />
        </div>
      </header>

      <main className="viz__panels">
        <section className="viz__panel">
          <h3>Machine structure</h3>
          {machine ? (
            <StateTree
              node={machine.definition}
              activePaths={active}
              zoomRadius={zoomRadius}
            />
          ) : (
            <p className="viz__muted">Waiting for machine definition…</p>
          )}
        </section>

        <section className="viz__panel">
          <h3>Current state</h3>
          <pre className="viz__code">
            {JSON.stringify(actorState?.value, null, 2)}
          </pre>
          <h4>Context</h4>
          <pre className="viz__code">
            {JSON.stringify(actorState?.context, null, 2)}
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

function ActorSelect({
  machines,
  selectedSessionId,
  onChange,
}: {
  machines: VisualizerSnapshot['machines'];
  selectedSessionId: string;
  onChange: (sessionId: string) => void;
}) {
  return (
    <label className="viz__actor-select">
      <span className="viz__actor-select-label">Actor</span>
      <select
        value={selectedSessionId}
        onChange={(event) => onChange(event.target.value)}
      >
        {machines.map((m) => (
          <option key={m.sessionId} value={m.sessionId}>
            {m.definition.id} ({m.sessionId})
          </option>
        ))}
      </select>
    </label>
  );
}

function ZoomHopsControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div
      className="viz__zoom-control"
      title="How many parent/child hops around a clicked node become large"
    >
      <span className="viz__zoom-label">Zoom hops</span>
      <button
        type="button"
        className="viz__zoom-btn"
        aria-label="Decrease zoom hops"
        disabled={value <= MIN_ZOOM_RADIUS}
        onClick={(event) => {
          event.stopPropagation();
          onChange(clampZoomRadius(value - 1));
        }}
      >
        −
      </button>
      <span className="viz__zoom-value" aria-live="polite">
        ±{value}
      </span>
      <button
        type="button"
        className="viz__zoom-btn"
        aria-label="Increase zoom hops"
        disabled={value >= MAX_ZOOM_RADIUS}
        onClick={(event) => {
          event.stopPropagation();
          onChange(clampZoomRadius(value + 1));
        }}
      >
        +
      </button>
    </div>
  );
}
