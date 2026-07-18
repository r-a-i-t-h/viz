import { useCallback, useEffect, useState } from 'react';
import type { VisualizerSnapshot } from '../viz';
import {
  DEFAULT_SIDE_WIDTH,
  DEFAULT_WATCH_WIDTH,
} from './columnLayout';
import { ContextInspector } from './ContextInspector';
import {
  contextKeysForEntities,
  stateIdsForContextKey,
} from './contextDepHighlights';
import { SideColumn } from './SideColumn';
import { FoldSection } from './FoldSection';
import { NextEventsPanel } from './NextEventsPanel';
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
export type ConnectionStatus = 'waiting' | 'connected' | 'closed' | 'orphan';

export function VisualizerView({
  snapshot,
  title = 'Visualizer',
  connection,
  defaultZoomRadius = DEFAULT_ZOOM_RADIUS,
}: {
  snapshot: VisualizerSnapshot;
  title?: string;
  /** When set, shows a status pill beside the title (popup host link). */
  connection?: ConnectionStatus;
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
  const [watchWidth, setWatchWidth] = useState(DEFAULT_WATCH_WIDTH);
  const [sideWidth, setSideWidth] = useState(DEFAULT_SIDE_WIDTH);
  const [highlightedTargetIds, setHighlightedTargetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredContextKey, setHoveredContextKey] = useState<string | null>(
    null,
  );
  const [hoveredEntityIds, setHoveredEntityIds] = useState<string[]>([]);
  const [zoomAnchors, setZoomAnchors] = useState<Set<string>>(() => new Set());
  /** Watched node paths keyed by actor session id (order preserved). */
  const [watchedBySession, setWatchedBySession] = useState<
    Record<string, string[]>
  >({});

  const { machines } = snapshot;
  const machine =
    machines.find((m) => m.sessionId === selectedSessionId) ?? machines[0];
  const frame = machine ? snapshot.frames[machine.sessionId] : undefined;

  const active = new Set(frame?.activePaths ?? []);

  const sessionId = machine?.sessionId ?? '';
  const watchedPaths = watchedBySession[sessionId] ?? [];
  const watchedPathSet = new Set(watchedPaths);

  const { assignIds: contextAssignIds, consumeIds: contextConsumeIds } =
    hoveredContextKey
      ? stateIdsForContextKey(
          machine?.analysis.contextDeps,
          hoveredContextKey,
        )
      : { assignIds: new Set<string>(), consumeIds: new Set<string>() };

  const { assignKeys: entityAssignKeys, consumeKeys: entityConsumeKeys } =
    contextKeysForEntities(machine?.analysis.contextDeps, hoveredEntityIds);

  const onHoverContextKey = useCallback((key: string | null) => {
    setHoveredContextKey(key);
    if (key != null) setHoveredEntityIds([]);
  }, []);

  const onEntityHover = useCallback((entityIds: string[]) => {
    setHoveredEntityIds(entityIds);
    if (entityIds.length > 0) setHoveredContextKey(null);
  }, []);

  const toggleZoom = useCallback((path: string, exclusive: boolean) => {
    setZoomAnchors((current) => {
      if (exclusive) {
        return current.size === 1 && current.has(path)
          ? new Set<string>()
          : new Set([path]);
      }
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Escape clears every zoom anchor (graph + watch "z" controls).
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setZoomAnchors(new Set());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    <div className="viz">
      <header className="viz__header">
        <div className="viz__header-row">
          <div className="viz__header-start">
            <h2 className="viz__title">{title}</h2>
            {connection && <StatusPill state={connection} />}
          </div>
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
        </div>
      </header>

      <main className="viz__panels">
        <SideColumn
          edge="start"
          title="Watched"
          open={watchPanelOpen}
          width={watchWidth}
          onToggle={() => setWatchPanelOpen((open) => !open)}
          onWidthChange={setWatchWidth}
          className="viz__panel--watch"
        >
          {machine ? (
            <WatchColumn
              root={machine.root}
              watchedPaths={watchedPaths}
              activePaths={active}
              showLifecycleBadges={showLifecycleBadges}
              onMove={moveWatch}
              onUnwatch={unwatch}
              zoomAnchors={zoomAnchors}
              onToggleZoom={toggleZoom}
              highlightedTargetIds={highlightedTargetIds}
              onHighlightTargets={setHighlightedTargetIds}
              onEntityHover={onEntityHover}
              contextAssignIds={contextAssignIds}
              contextConsumeIds={contextConsumeIds}
            />
          ) : (
            <p className="viz__muted">Waiting for machine definition…</p>
          )}
        </SideColumn>

        <section className="viz__panel viz__panel--tree">
          <h3>
            {machine
              ? `${machine.label} (${machine.sessionId})`
              : 'Machine structure'}
          </h3>
          <div className="viz__tree-scroll">
            {machine ? (
              <StateTree
                node={machine.root}
                activePaths={active}
                zoomRadius={zoomRadius}
                showLifecycleBadges={showLifecycleBadges}
                onToggleWatch={toggleWatch}
                watchedPaths={watchedPathSet}
                zoomAnchors={zoomAnchors}
                onToggleZoom={toggleZoom}
                highlightedTargetIds={highlightedTargetIds}
                onHighlightTargets={setHighlightedTargetIds}
                onEntityHover={onEntityHover}
                contextAssignIds={contextAssignIds}
                contextConsumeIds={contextConsumeIds}
              />
            ) : (
              <p className="viz__muted">Waiting for machine definition…</p>
            )}
          </div>
        </section>

        <SideColumn
          edge="end"
          open={sidePanelOpen}
          width={sideWidth}
          onToggle={() => setSidePanelOpen((open) => !open)}
          onWidthChange={setSideWidth}
          className="viz__panel--side"
        >
          <FoldSection title="Current state">
            <pre className="viz__code">
              {JSON.stringify(frame?.value, null, 2)}
            </pre>
          </FoldSection>
          <FoldSection title="Next events">
            <NextEventsPanel
              events={frame?.nextEvents ?? []}
              onHighlightProviders={setHighlightedTargetIds}
            />
          </FoldSection>
          <FoldSection title="Context">
            <ContextInspector
              context={frame?.context}
              contextDeps={machine?.analysis.contextDeps}
              contextKeyAges={frame?.contextKeyAges}
              hoveredKey={hoveredContextKey}
              onHoverKey={onHoverContextKey}
              assignKeys={entityAssignKeys}
              consumeKeys={entityConsumeKeys}
            />
          </FoldSection>
          <FoldSection title="Context deps">
            <pre className="viz__code">
              {JSON.stringify(machine?.analysis.contextDeps, null, 2)}
            </pre>
          </FoldSection>
          <FoldSection title="Event log">
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
          </FoldSection>
        </SideColumn>
      </main>
    </div>
  );
}

function StatusPill({ state }: { state: ConnectionStatus }) {
  const label =
    state === 'connected'
      ? 'connected'
      : state === 'waiting'
        ? 'waiting'
        : state === 'closed'
          ? 'closed'
          : 'no host';
  const tone =
    state === 'connected'
      ? 'ok'
      : state === 'waiting'
        ? 'warn'
        : 'err';
  return (
    <span className={`viz__status viz__status--${tone}`}>{label}</span>
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
            {m.label} ({m.sessionId})
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
