import {
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { StateNodeDefinition } from '../viz';
import { HoverTip } from './HoverTip';
import { NodeLifecycleBadges } from './NodeLifecycleBadges';
import {
  formatOnTransitionDetails,
  getOnTransitionTargetIds,
  normalizeStateNodeId,
} from './nodeDetails';
import { FinalStateIcon, InitialArrowIcon } from './nodeIcons';
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
  onToggleWatch?: (path: string) => void;
  watchedPaths?: Set<string>;
  highlightedTargetIds?: Set<string>;
  onHighlightTargets?: (targets: Set<string>) => void;
}

/**
 * Clicking a node toggles a large ±zoomRadius neighborhood anchored on it;
 * plain clicks accumulate anchors, modifier-clicks (Shift/Cmd/Ctrl) replace
 * them all. Alt-click watches the node in the left column. Zoom anchors are
 * owned by the parent so the watch column can toggle them too.
 */
export function StateTree({
  node,
  activePaths,
  zoomRadius = DEFAULT_ZOOM_RADIUS,
  showLifecycleBadges = true,
  onToggleWatch,
  watchedPaths,
  zoomAnchors,
  onToggleZoom,
  highlightedTargetIds,
  onHighlightTargets,
}: {
  node: StateNodeDefinition;
  activePaths: Set<string>;
  /** Neighborhood radius in parent/child levels (±). Controllable from the visualizer UI. */
  zoomRadius?: number;
  /** Whether authored entry, exit, and after badges are visible. */
  showLifecycleBadges?: boolean;
  /** Alt-click / Alt-Enter toggles watching this path. */
  onToggleWatch?: (path: string) => void;
  /** Paths currently in the watch column (for title hints). */
  watchedPaths?: Set<string>;
  /** Zoom anchor paths owned by the parent view (shared with watch). */
  zoomAnchors: Set<string>;
  onToggleZoom: (path: string, exclusive: boolean) => void;
  /** Node ids highlighted while an `on` event is hovered (graph or watch). */
  highlightedTargetIds?: Set<string>;
  onHighlightTargets?: (targets: Set<string>) => void;
}) {
  return (
    <StateTreeNode
      node={node}
      activePaths={activePaths}
      path=""
      zoomAnchors={zoomAnchors}
      zoomRadius={zoomRadius}
      showLifecycleBadges={showLifecycleBadges}
      onToggleZoom={onToggleZoom}
      onToggleWatch={onToggleWatch}
      watchedPaths={watchedPaths}
      highlightedTargetIds={highlightedTargetIds}
      onHighlightTargets={onHighlightTargets}
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
  onToggleWatch,
  watchedPaths = new Set(),
  highlightedTargetIds = new Set(),
  onHighlightTargets,
}: StateTreeProps) {
  const childKeys = Object.keys(node.states ?? {});
  const isActive = path === '' || activePaths.has(path);
  const eventKeys = Object.keys(node.on ?? {}).filter(
    (key) => !key.startsWith('xstate.after.'),
  );
  const childLayout = node.type === 'parallel' ? 'parallel' : 'sequential';
  const isFinal = node.type === 'final';
  const initialChildIds = resolveInitialChildIds(node);
  const zoomLarge = [...zoomAnchors].some((anchor) =>
    isZoomLarge(path, anchor, zoomRadius),
  );
  const isTransitionTarget = highlightedTargetIds.has(
    normalizeStateNodeId(node.id),
  );
  const isWatched = watchedPaths.has(path);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    // Deepest node under the cursor wins (children stopPropagation first).
    event.stopPropagation();
    if (hasWatchModifier(event)) {
      onToggleWatch?.(path);
      return;
    }
    onToggleZoom?.(path, hasZoomModifier(event));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (hasWatchModifier(event)) {
      onToggleWatch?.(path);
      return;
    }
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
        isWatched ? 'node--watched' : '',
        isTransitionTarget ? 'node--transition-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {isInitial && (
        <span className="node__initial" title="initial">
          <InitialArrowIcon />
          <span className="node__badge-label">initial</span>
        </span>
      )}

      {showLifecycleBadges && (
        <NodeLifecycleBadges
          node={node}
          align="right"
          onHighlightTargets={onHighlightTargets}
        />
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
                onToggleWatch={onToggleWatch}
                watchedPaths={watchedPaths}
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

function hasWatchModifier(
  event: Pick<MouseEvent, 'altKey'>,
): boolean {
  return event.altKey;
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
