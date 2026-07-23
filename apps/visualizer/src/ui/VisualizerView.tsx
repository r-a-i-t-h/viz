import { useCallback, useEffect, useState } from 'react';
import type {
  VizFrame,
  VizLogEntry,
  VizMachine,
  VisualizerSnapshot,
} from '@r-a-i-t-h/viz-protocol';
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
import { SideTabs } from './SideTabs';
import { FoldSection } from './FoldSection';
import { NextEventsPanel } from './NextEventsPanel';
import { TreeViewport } from './TreeViewport';
import { StateTree } from './StateTree';
import { WatchColumn } from './WatchColumn';
import {
  clampZoomRadius,
  DEFAULT_ZOOM_RADIUS,
  MAX_ZOOM_RADIUS,
  MIN_ZOOM_RADIUS,
} from './zoom';
import {
  applyDocumentTheme,
  persistTheme,
  readStoredTheme,
  type VizTheme,
} from './theme';
import {
  NO_TRANSITION_HIGHLIGHT,
  type TransitionHighlight,
} from './transitionHighlight';
import './visualizer.css';

/**
 * Optional React renderer for a {@link VisualizerSnapshot}.
 * Importing this module pulls in visualizer CSS — do not import it from a
 * headless host that only needs `openPopup()`.
 */
export type ConnectionStatus = 'waiting' | 'connected' | 'closed' | 'orphan';
export type { VizTheme };

export function VisualizerView({
  snapshot,
  title = 'Visualizer',
  connection,
  defaultZoomRadius = DEFAULT_ZOOM_RADIUS,
  syncDocumentTheme = false,
}: {
  snapshot: VisualizerSnapshot;
  title?: string;
  /** When set, shows a status pill beside the title (popup host link). */
  connection?: ConnectionStatus;
  /** Initial ± range for click-zoom neighborhood (also adjustable on-screen). */
  defaultZoomRadius?: number;
  /**
   * When true, mirrors the theme onto `document.documentElement` so popup
   * page chrome matches. Leave false for inline embeds inside a host page.
   */
  syncDocumentTheme?: boolean;
}) {
  const [zoomRadius, setZoomRadius] = useState(() =>
    clampZoomRadius(defaultZoomRadius),
  );
  const [theme, setTheme] = useState<VizTheme>(readStoredTheme);
  const [showLifecycleBadges, setShowLifecycleBadges] = useState(true);
  const [filterLogToCurrentMachine, setFilterLogToCurrentMachine] =
    useState(true);
  /** View-only pin of a past snapshot frame (does not rewind the live actor). */
  const [historyPin, setHistoryPin] = useState<{
    seq: number;
    sessionId: string;
    frame: VizFrame;
  } | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [watchPanelOpen, setWatchPanelOpen] = useState(true);
  const [watchWidth, setWatchWidth] = useState(DEFAULT_WATCH_WIDTH);
  const [sideWidth, setSideWidth] = useState(DEFAULT_SIDE_WIDTH);
  const [transitionHighlight, setTransitionHighlight] =
    useState<TransitionHighlight>(NO_TRANSITION_HIGHLIGHT);
  const [hoveredContextKey, setHoveredContextKey] = useState<string | null>(
    null,
  );
  const [hoveredEntityIds, setHoveredEntityIds] = useState<string[]>([]);
  const [zoomAnchors, setZoomAnchors] = useState<Set<string>>(() => new Set());
  const [viewportResetSignal, setViewportResetSignal] = useState(0);
  /** Watched node paths keyed by actor session id (order preserved). */
  const [watchedBySession, setWatchedBySession] = useState<
    Record<string, string[]>
  >({});

  const { machines } = snapshot;
  const machine =
    machines.find((m) => m.sessionId === selectedSessionId) ?? machines[0];
  const sessionId = machine?.sessionId ?? '';
  const liveFrame = machine ? snapshot.frames[machine.sessionId] : undefined;
  const viewingHistory =
    historyPin != null && historyPin.sessionId === sessionId;
  const frame = viewingHistory ? historyPin.frame : liveFrame;

  const active = new Set(frame?.activePaths ?? []);

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

  // Escape resets graph viewport pan/zoom and clears every zoom anchor.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setZoomAnchors(new Set());
      setViewportResetSignal((current) => current + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    persistTheme(theme);
    // Always set document data-theme so body-portaled hover tips inherit
    // --viz-* tokens. color-scheme / page chrome only for the popup shell.
    document.documentElement.dataset.theme = theme;
    if (syncDocumentTheme) applyDocumentTheme(theme);
  }, [theme, syncDocumentTheme]);

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

  const selectHistory = useCallback((entry: VizLogEntry) => {
    if (!entry.frame) return;
    setSelectedSessionId(entry.sessionId);
    setHistoryPin({
      seq: entry.seq,
      sessionId: entry.sessionId,
      frame: entry.frame,
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryPin(null);
  }, []);

  return (
    <div className="viz" data-theme={theme}>
      <header className="viz__header">
        <div className="viz__header-row">
          <div className="viz__header-start">
            <h2 className="viz__title">{title}</h2>
            {connection && <StatusPill state={connection} />}
          </div>
          {machines.length > 0 && (
            <ActorSelect
              machines={machines}
              frames={snapshot.frames}
              selectedSessionId={machine?.sessionId ?? ''}
              onChange={setSelectedSessionId}
            />
          )}
          <AppearanceSettings
            theme={theme}
            onThemeChange={setTheme}
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
              highlightedSourceIds={transitionHighlight.sources}
              highlightedTargetIds={transitionHighlight.targets}
              onHighlightTransition={setTransitionHighlight}
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
            {frame && (
              <span
                className={`viz__actor-status viz__actor-status--${frame.status}`}
              >
                {frame.status}
              </span>
            )}
            {viewingHistory && (
              <button
                type="button"
                className="viz__history-live"
                onClick={clearHistory}
              >
                Viewing history · back to live
              </button>
            )}
          </h3>
          <TreeViewport
            resetKey={`${machine?.sessionId ?? ''}:${viewportResetSignal}`}
          >
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
                highlightedSourceIds={transitionHighlight.sources}
                highlightedTargetIds={transitionHighlight.targets}
                onHighlightTransition={setTransitionHighlight}
                onEntityHover={onEntityHover}
                contextAssignIds={contextAssignIds}
                contextConsumeIds={contextConsumeIds}
              />
            ) : (
              <p className="viz__muted">Waiting for machine definition…</p>
            )}
          </TreeViewport>
        </section>

        <SideColumn
          edge="end"
          open={sidePanelOpen}
          width={sideWidth}
          onToggle={() => setSidePanelOpen((open) => !open)}
          onWidthChange={setSideWidth}
          className="viz__panel--side"
        >
          <SideTabs
            panels={{
              state: (
                <>
                  <FoldSection title={viewingHistory ? 'State (history)' : 'Current state'}>
                    <pre className="viz__code viz__code--plain">
                      {JSON.stringify(frame?.value, null, 2)}
                    </pre>
                    <InputOutputMeta frame={frame} machine={machine} />
                  </FoldSection>
                  <FoldSection title="Next events">
                    <NextEventsPanel
                      events={frame?.nextEvents ?? []}
                      root={machine?.root}
                      onHighlightTransition={setTransitionHighlight}
                    />
                  </FoldSection>
                </>
              ),
              context: (
                <>
                  <ContextInspector
                    context={frame?.context}
                    contextDeps={machine?.analysis.contextDeps}
                    contextKeyAges={frame?.contextKeyAges}
                    hoveredKey={hoveredContextKey}
                    onHoverKey={onHoverContextKey}
                    assignKeys={entityAssignKeys}
                    consumeKeys={entityConsumeKeys}
                    onSelectActor={setSelectedSessionId}
                  />
                  <ContextDepsTools deps={machine?.analysis.contextDeps} />
                </>
              ),
              log: (
                <EventLogPanel
                  entries={snapshot.log}
                  sessionId={sessionId}
                  filterToCurrent={filterLogToCurrentMachine}
                  onFilterToCurrentChange={setFilterLogToCurrentMachine}
                  pinnedSeq={viewingHistory ? historyPin.seq : null}
                  onSelectEntry={selectHistory}
                />
              ),
            }}
          />
        </SideColumn>
      </main>
    </div>
  );
}

/** Spawn input / done output under current state — status lives on the tree badge. */
function InputOutputMeta({
  frame,
  machine,
}: {
  frame: VizFrame | undefined;
  machine: VizMachine | undefined;
}) {
  const showInput = machine?.input !== undefined;
  const showOutput = frame?.status === 'done' || frame?.output !== undefined;
  if (!showInput && !showOutput) return null;
  return (
    <dl className="viz__dump-meta">
      {showInput && (
        <div>
          <dt>input</dt>
          <dd>
            <pre className="viz__code viz__code--plain viz__code--inline">
              {JSON.stringify(machine?.input, null, 2)}
            </pre>
          </dd>
        </div>
      )}
      {showOutput && (
        <div>
          <dt>output</dt>
          <dd>
            <pre className="viz__code viz__code--plain viz__code--inline">
              {JSON.stringify(frame?.output ?? null, null, 2)}
            </pre>
          </dd>
        </div>
      )}
    </dl>
  );
}

function ContextDepsTools({
  deps,
}: {
  deps: VizMachine['analysis']['contextDeps'] | undefined;
}) {
  const [showDeps, setShowDeps] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(deps ?? null, null, 2);

  const copyDeps = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="viz__context-deps-tools">
      <div className="viz__context-deps-actions">
        <button
          type="button"
          className="viz__text-button"
          aria-expanded={showDeps}
          onClick={() => setShowDeps((open) => !open)}
        >
          {showDeps ? 'Hide context deps' : 'Show context deps'}
        </button>
        <button type="button" className="viz__text-button" onClick={copyDeps}>
          {copied ? 'Copied' : 'Copy deps'}
        </button>
      </div>
      {showDeps && <pre className="viz__code">{json}</pre>}
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

type ActorOption = {
  sessionId: string;
  label: string;
  depth: number;
  status: VizFrame['status'];
};

function EventLogPanel({
  entries,
  sessionId,
  filterToCurrent,
  onFilterToCurrentChange,
  pinnedSeq,
  onSelectEntry,
}: {
  entries: VizLogEntry[];
  sessionId: string;
  filterToCurrent: boolean;
  onFilterToCurrentChange: (next: boolean) => void;
  pinnedSeq: number | null;
  onSelectEntry: (entry: VizLogEntry) => void;
}) {
  const visible =
    filterToCurrent && sessionId
      ? entries.filter((entry) => entry.sessionId === sessionId)
      : entries;

  return (
    <div className="viz__log-panel">
      <label className="viz__setting-row viz__log-filter">
        <span>Filter to current machine</span>
        <input
          type="checkbox"
          checked={filterToCurrent}
          disabled={!sessionId}
          onChange={(event) => onFilterToCurrentChange(event.target.checked)}
        />
      </label>
      {visible.length === 0 ? (
        <p className="viz__log-empty">No events yet.</p>
      ) : (
        <ul className="viz__log">
          {visible.map((entry) => {
            const revisitable = entry.frame != null;
            const pinned = pinnedSeq === entry.seq;
            return (
              <li
                key={entry.seq}
                className={[
                  'viz__log-item',
                  `viz__log-item--${entry.type.replace('@xstate.', '')}`,
                  revisitable ? 'viz__log-item--revisitable' : '',
                  pinned ? 'viz__log-item--pinned' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {revisitable ? (
                  <button
                    type="button"
                    className="viz__log-hit"
                    aria-pressed={pinned}
                    onClick={() => onSelectEntry(entry)}
                  >
                    <LogEntryBody entry={entry} />
                  </button>
                ) : (
                  <LogEntryBody entry={entry} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LogEntryBody({ entry }: { entry: VizLogEntry }) {
  return (
    <>
      <span className="viz__log-type">{entry.type}</span>
      {entry.eventType && (
        <span className="viz__log-event">{entry.eventType}</span>
      )}
      {entry.value !== undefined && (
        <span className="viz__log-value">{JSON.stringify(entry.value)}</span>
      )}
    </>
  );
}

function ActorSelect({
  machines,
  frames,
  selectedSessionId,
  onChange,
}: {
  machines: VizMachine[];
  frames: Record<string, VizFrame>;
  selectedSessionId: string;
  onChange: (sessionId: string) => void;
}) {
  const options = flattenActorTree(machines, frames);
  return (
    <label className="viz__actor-select">
      <span className="viz__actor-select-label">Actor</span>
      <select
        value={selectedSessionId}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.sessionId} value={opt.sessionId}>
            {`${'· '.repeat(opt.depth)}${opt.label} (${opt.sessionId}) [${opt.status}]`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Shallow parent→child forest from `parentSessionId`, registration order within siblings. */
function flattenActorTree(
  machines: VizMachine[],
  frames: Record<string, VizFrame>,
): ActorOption[] {
  const byId = new Map(machines.map((m) => [m.sessionId, m]));
  const children = new Map<string, VizMachine[]>();
  const roots: VizMachine[] = [];

  for (const machine of machines) {
    const parentId = machine.parentSessionId;
    if (parentId && byId.has(parentId)) {
      const list = children.get(parentId) ?? [];
      list.push(machine);
      children.set(parentId, list);
    } else {
      roots.push(machine);
    }
  }

  const options: ActorOption[] = [];
  function walk(machine: VizMachine, depth: number) {
    options.push({
      sessionId: machine.sessionId,
      label: machine.label,
      depth,
      status: frames[machine.sessionId]?.status ?? 'active',
    });
    for (const child of children.get(machine.sessionId) ?? []) {
      walk(child, depth + 1);
    }
  }
  for (const root of roots) walk(root, 0);
  return options;
}

function AppearanceSettings({
  theme,
  onThemeChange,
  zoomRadius,
  onZoomRadiusChange,
  showLifecycleBadges,
  onShowLifecycleBadgesChange,
}: {
  theme: VizTheme;
  onThemeChange: (next: VizTheme) => void;
  zoomRadius: number;
  onZoomRadiusChange: (next: number) => void;
  showLifecycleBadges: boolean;
  onShowLifecycleBadgesChange: (next: boolean) => void;
}) {
  return (
    <details className="viz__appearance">
      <summary>Appearance</summary>
      <div className="viz__appearance-panel">
        <div className="viz__setting-row">
          <span>Theme</span>
          <div className="viz__theme-toggle" role="group" aria-label="Theme">
            <button
              type="button"
              className="viz__theme-btn"
              aria-pressed={theme === 'dark'}
              onClick={() => onThemeChange('dark')}
            >
              Dark
            </button>
            <button
              type="button"
              className="viz__theme-btn"
              aria-pressed={theme === 'light'}
              onClick={() => onThemeChange('light')}
            >
              Light
            </button>
          </div>
        </div>
        <div
          className="viz__setting-row"
          title="How many parent/child levels around a clicked node become large"
        >
          <span title="Click-zoom neighborhood hops (± levels), not viewport scale">
            Zoom range
          </span>
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
