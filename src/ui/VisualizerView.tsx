import { useCallback, useState } from 'react';
import type { StateValue } from 'xstate';
import { activePaths, type VisualizerSnapshot } from '../viz';
import { StateTree } from './StateTree';
import { WatchColumn } from './WatchColumn';
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
  /** Initial ± range for click-zoom neighborhood (also adjustable on-screen). */
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
  const [watchPanelOpen, setWatchPanelOpen] = useState(true);
  /** Watched node paths keyed by actor session id (order preserved). */
  const [watchedBySession, setWatchedBySession] = useState<
    Record<string, string[]>
  >({});

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

  const sessionId = machine?.sessionId ?? '';
  const watchedPaths = watchedBySession[sessionId] ?? [];
  const watchedPathSet = new Set(watchedPaths);

  const toggleWatch = useCallback(
    (path: string) => {
      if (!sessionId) return;
      setWatchedBySession((current) => {
        const list = current[sessionId] ?? [];
        const next = list.includes(path)
          ? list.filter((p) => p !== path)
          : [...list, path];
        return { ...current, [sessionId]: next };
      });
      setWatchPanelOpen(true);
    },
    [sessionId],
  );

  const unwatch = useCallback(
    (path: string) => {
      if (!sessionId) return;
      setWatchedBySession((current) => ({
        ...current,
        [sessionId]: (current[sessionId] ?? []).filter((p) => p !== path),
      }));
    },
    [sessionId],
  );

  const moveWatch = useCallback(
    (path: string, direction: -1 | 1) => {
      if (!sessionId) return;
      setWatchedBySession((current) => {
        const list = [...(current[sessionId] ?? [])];
        const index = list.indexOf(path);
        if (index < 0) return current;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= list.length) return current;
        const [item] = list.splice(index, 1);
        list.splice(nextIndex, 0, item);
        return { ...current, [sessionId]: list };
      });
    },
    [sessionId],
  );

  return (
    <div
      className={[
        'viz',
        sidePanelOpen ? 'viz--side-open' : 'viz--side-collapsed',
        watchPanelOpen ? 'viz--watch-open' : 'viz--watch-collapsed',
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
          {!watchPanelOpen && (
            <button
              type="button"
              className="viz__side-toggle"
              onClick={() => setWatchPanelOpen(true)}
            >
              Show watched
              {watchedPaths.length > 0 ? ` (${watchedPaths.length})` : ''}
            </button>
          )}
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
        {machine && watchPanelOpen && (
          <WatchColumn
            root={machine.definition}
            watchedPaths={watchedPaths}
            activePaths={active}
            showLifecycleBadges={showLifecycleBadges}
            onMove={moveWatch}
            onUnwatch={unwatch}
            onCollapse={() => setWatchPanelOpen(false)}
          />
        )}

        <section className="viz__panel viz__panel--tree">
          <h3>Machine structure</h3>
          <div className="viz__tree-scroll">
            {machine ? (
              <StateTree
                node={machine.definition}
                activePaths={active}
                zoomRadius={zoomRadius}
                showLifecycleBadges={showLifecycleBadges}
                onToggleWatch={toggleWatch}
                watchedPaths={watchedPathSet}
              />
            ) : (
              <p className="viz__muted">Waiting for machine definition…</p>
            )}
          </div>
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
          title="How many parent/child levels around a clicked node become large"
        >
          <span>Zoom range</span>
          <div className="viz__zoom-control">
            <button
              type="button"
              className="viz__zoom-btn"
              aria-label="Decrease zoom range"
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
              aria-label="Increase zoom range"
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
