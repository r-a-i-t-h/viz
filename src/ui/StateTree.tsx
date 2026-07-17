import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { StateNodeDefinition } from '../viz';
import { HoverTip } from './HoverTip';
import { nodeLifecycleFlags } from './lifecycleBadges';
import {
  formatAfterTransitions,
  formatEntryActions,
  formatExitActions,
  formatOnTransitionDetails,
  getOnTransitionTargetIds,
  normalizeStateNodeId,
} from './nodeDetails';
import { DEFAULT_ZOOM_RADIUS, isZoomLarge } from './zoom';

interface StateTreeProps {
  node: StateNodeDefinition;
  activePaths: Set<string>;
  path?: string;
  /** True when this node is the parent's initial child. */
  isInitial?: boolean;
  zoomAnchors?: Set<string>;
  zoomRadius?: number;
  showLifecycleBadges?: boolean;
  onToggleZoom?: (path: string, exclusive: boolean) => void;
  highlightedTargetIds?: Set<string>;
  onHighlightTargets?: (targets: Set<string>) => void;
}

/**
 * Stateful tree: starts at zoom "small". Clicking a node toggles a large
 * ±zoomRadius neighborhood anchored on it; plain clicks accumulate anchors,
 * modifier-clicks (Shift/Cmd/Ctrl) replace them all. Escape clears every
 * anchor.
 */
export function StateTree({
  node,
  activePaths,
  zoomRadius = DEFAULT_ZOOM_RADIUS,
  showLifecycleBadges = true,
}: {
  node: StateNodeDefinition;
  activePaths: Set<string>;
  /** Neighborhood radius in parent/child levels (±). Controllable from the visualizer UI. */
  zoomRadius?: number;
  /** Whether authored entry, exit, and after badges are visible. */
  showLifecycleBadges?: boolean;
}) {
  const [zoomAnchors, setZoomAnchors] = useState<Set<string>>(() => new Set());
  const [highlightedTargetIds, setHighlightedTargetIds] = useState<Set<string>>(
    () => new Set(),
  );

  const onToggleZoom = useCallback((path: string, exclusive: boolean) => {
    setZoomAnchors((current) => {
      if (exclusive) {
        // Sole anchor already → toggle off; otherwise focus only this one.
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

  // Escape resets every zoom anchor.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setZoomAnchors(new Set());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <StateTreeNode
      node={node}
      activePaths={activePaths}
      path=""
      zoomAnchors={zoomAnchors}
      zoomRadius={zoomRadius}
      showLifecycleBadges={showLifecycleBadges}
      onToggleZoom={onToggleZoom}
      highlightedTargetIds={highlightedTargetIds}
      onHighlightTargets={setHighlightedTargetIds}
    />
  );
}

function StateTreeNode({
  node,
  activePaths,
  path = '',
  isInitial = false,
  zoomAnchors = new Set(),
  zoomRadius = DEFAULT_ZOOM_RADIUS,
  showLifecycleBadges = true,
  onToggleZoom,
  highlightedTargetIds = new Set(),
  onHighlightTargets,
}: StateTreeProps) {
  const childKeys = Object.keys(node.states ?? {});
  const isActive = path === '' || activePaths.has(path);
  const eventKeys = Object.keys(node.on ?? {}).filter(
    (key) => !key.startsWith('xstate.after.'),
  );
  const childLayout = node.type === 'parallel' ? 'parallel' : 'sequential';
  const lifecycle = nodeLifecycleFlags(node);
  const isFinal = node.type === 'final';
  const initialChildIds = resolveInitialChildIds(node);
  const zoomLarge = [...zoomAnchors].some((anchor) =>
    isZoomLarge(path, anchor, zoomRadius),
  );
  const isTransitionTarget = highlightedTargetIds.has(
    normalizeStateNodeId(node.id),
  );

  const entryItems = formatEntryActions(node.entry);
  const exitItems = formatExitActions(node.exit);
  const afterItems = formatAfterTransitions(node.on, node.transitions);
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    // Deepest node under the cursor wins (children stopPropagation first).
    event.stopPropagation();
    onToggleZoom?.(path, hasZoomModifier(event));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    onToggleZoom?.(path, hasZoomModifier(event));
  };

  return (
    <div
      className={[
        'node',
        `node--${node.type}`,
        zoomLarge ? 'node--zoom-large' : 'node--zoom-small',
        isActive ? 'node--active' : '',
        isInitial ? 'node--initial' : '',
        isFinal ? 'node--final' : '',
        zoomAnchors.has(path) ? 'node--zoom-focus' : '',
        isTransitionTarget ? 'node--transition-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title={
        zoomAnchors.has(path)
          ? `Click to remove this ±${zoomRadius} zoom; Shift/Cmd-click to zoom it exclusively; Esc clears all`
          : `Click to zoom ±${zoomRadius} levels around this node; Shift/Cmd-click to zoom it exclusively`
      }
    >
      {isInitial && (
        <span className="node__initial" title="initial">
          <InitialArrowIcon />
          <span className="node__badge-label">initial</span>
        </span>
      )}

      {showLifecycleBadges &&
        (lifecycle.entry || lifecycle.exit || lifecycle.after) && (
        <div className="node__badges">
          {lifecycle.entry && (
            <HoverTip
              className="node__badge node__badge--entry"
              label="entry"
              items={entryItems}
              placement="below"
              align="right"
            >
              <EntryIcon />
              <span className="node__badge-label">entry</span>
            </HoverTip>
          )}
          {lifecycle.after && (
            <HoverTip
              className="node__badge node__badge--after"
              label="after"
              items={afterItems}
              placement="below"
              align="right"
            >
              <AfterIcon />
              <span className="node__badge-label">after</span>
            </HoverTip>
          )}
          {lifecycle.exit && (
            <HoverTip
              className="node__badge node__badge--exit"
              label="exit"
              items={exitItems}
              placement="below"
              align="right"
            >
              <ExitIcon />
              <span className="node__badge-label">exit</span>
            </HoverTip>
          )}
        </div>
      )}

      <div className="node__header">
        {isFinal && (
          <span className="node__final-icon" title="final">
            <FinalStateIcon />
            <span className="node__badge-label">final</span>
          </span>
        )}
        <span className="node__key">{node.key}</span>
        {eventKeys.length > 0 && (
          <span className="node__events">
            <span className="node__events-label">on:</span>{' '}
            {eventKeys.map((eventKey, index) => {
              const transitions = node.on[eventKey];
              return (
                <span key={eventKey}>
                  {index > 0 && <span className="node__event-separator">, </span>}
                  <HoverTip
                    className="node__event"
                    label={eventKey}
                    items={formatOnTransitionDetails(eventKey, transitions)}
                    placement="below"
                    align="left"
                    onActiveChange={(active) =>
                      onHighlightTargets?.(
                        active
                          ? getOnTransitionTargetIds(transitions)
                          : new Set(),
                      )
                    }
                  >
                    {eventKey}
                  </HoverTip>
                </span>
              );
            })}
          </span>
        )}
      </div>

      {childKeys.length > 0 && (
        <div
          className={`node__children node__children--${childLayout}`}
          data-layout={childLayout}
        >
          {childKeys.map((key) => {
            const child = node.states[key];
            const childPath = path ? `${path}.${key}` : key;
            return (
              <StateTreeNode
                key={key}
                node={child}
                activePaths={activePaths}
                path={childPath}
                isInitial={
                  initialChildIds.has(child.id) || initialChildIds.has(key)
                }
                zoomAnchors={zoomAnchors}
                zoomRadius={zoomRadius}
                showLifecycleBadges={showLifecycleBadges}
                onToggleZoom={onToggleZoom}
                highlightedTargetIds={highlightedTargetIds}
                onHighlightTargets={onHighlightTargets}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function hasZoomModifier(
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>,
): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey;
}

/**
 * Resolve which child ids/keys are the parent's initial target(s).
 * After portable serialization, targets are id strings like `#demo.idle`.
 */
function resolveInitialChildIds(node: StateNodeDefinition): Set<string> {
  const ids = new Set<string>();
  const target = node.initial?.target;
  if (!target) return ids;

  for (const item of target) {
    if (typeof item === 'string') {
      ids.add(item);
      const bare = item.replace(/^#/, '').split('.').pop();
      if (bare) ids.add(bare);
      continue;
    }
    if (item && typeof item === 'object' && 'id' in item) {
      const id = (item as { id: unknown }).id;
      if (typeof id === 'string') {
        ids.add(id);
        const bare = id.replace(/^#/, '').split('.').pop();
        if (bare) ids.add(bare);
      }
    }
  }

  return ids;
}

function InitialArrowIcon() {
  return (
    <svg viewBox="0 0 10 14" width="10" height="14" aria-hidden="true">
      <path d="M1.5 1.75 8.5 7l-7 5.25V1.75z" fill="currentColor" />
    </svg>
  );
}

/** Classic UML final-state glyph: outer ring + filled inner circle. */
function FinalStateIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8" cy="8" r="3.25" fill="currentColor" />
    </svg>
  );
}

function EntryIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3 3h6v2H5v6h4v2H3V3zm5 3h5v1.5L15 8l-2 1.5V11H8V6z"
        fill="currentColor"
      />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3 3h6v2H5v6h4v2H3V3zm5 3h2.5V4.5L15 8l-4.5 3.5V10H8V6z"
        fill="currentColor"
      />
    </svg>
  );
}

function AfterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 4h1.5v4.1l2.4 1.4-.75 1.25L7.25 9V4z"
        fill="currentColor"
      />
    </svg>
  );
}
