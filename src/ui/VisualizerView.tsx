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
  const [showLifecycleBadges, setShowLifecycleBadges] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

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
    <div
      className={[
        'viz',
        sidePanelOpen ? 'viz--side-open' : 'viz--side-collapsed',
      ].join(' ')}
    >
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
          <AppearanceSettings
            zoomRadius={zoomRadius}
            onZoomRadiusChange={setZoomRadius}
            showLifecycleBadges={showLifecycleBadges}
            onShowLifecycleBadgesChange={setShowLifecycleBadges}
          />
          {!sidePanelOpen && (
            <button
              type="button"
              className="viz__side-toggle"
              onClick={() => setSidePanelOpen(true)}
            >
              Show current state
            </button>
          )}
        </div>
      </header>

      <main className="viz__panels">
        <section className="viz__panel viz__panel--tree">
          <h3>Machine structure</h3>
          {machine ? (
            <StateTree
              node={machine.definition}
              activePaths={active}
              zoomRadius={zoomRadius}
              showLifecycleBadges={showLifecycleBadges}
            />
          ) : (
            <p className="viz__muted">Waiting for machine definition…</p>
          )}
        </section>

        {sidePanelOpen && (
          <section className="viz__panel viz__panel--side">
            <div className="viz__panel-heading">
              <h3>Current state</h3>
              <button
                type="button"
                className="viz__side-toggle"
                onClick={() => setSidePanelOpen(false)}
                aria-expanded={sidePanelOpen}
              >
                Collapse
              </button>
            </div>
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
        )}
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

function AppearanceSettings({
  zoomRadius,
  onZoomRadiusChange,
  showLifecycleBadges,
  onShowLifecycleBadgesChange,
}: {
  zoomRadius: number;
  onZoomRadiusChange: (next: number) => void;
  showLifecycleBadges: boolean;
  onShowLifecycleBadgesChange: (next: boolean) => void;
}) {
  return (
    <details className="viz__appearance">
      <summary>Appearance</summary>
      <div className="viz__appearance-panel">
        <div
          className="viz__setting-row"
          title="How many parent/child hops around a clicked node become large"
        >
          <span>Zoom hops</span>
          <div className="viz__zoom-control">
            <button
              type="button"
              className="viz__zoom-btn"
              aria-label="Decrease zoom hops"
              disabled={zoomRadius <= MIN_ZOOM_RADIUS}
              onClick={() =>
                onZoomRadiusChange(clampZoomRadius(zoomRadius - 1))
              }
            >
              −
            </button>
            <span className="viz__zoom-value" aria-live="polite">
              ±{zoomRadius}
            </span>
            <button
              type="button"
              className="viz__zoom-btn"
              aria-label="Increase zoom hops"
              disabled={zoomRadius >= MAX_ZOOM_RADIUS}
              onClick={() =>
                onZoomRadiusChange(clampZoomRadius(zoomRadius + 1))
              }
            >
              +
            </button>
          </div>
        </div>
        <label className="viz__setting-row">
          <span>Show badges?</span>
          <input
            type="checkbox"
            checked={showLifecycleBadges}
            onChange={(event) =>
              onShowLifecycleBadgesChange(event.target.checked)
            }
          />
        </label>
      </div>
    </details>
  );
}
