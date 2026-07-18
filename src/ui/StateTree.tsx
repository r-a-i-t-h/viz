import {
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { VizEvent, VizNode } from '../viz';
import { depEntityId } from './contextDepHighlights';
import { HoverTip, type HoverTipItem } from './HoverTip';
import { NodeLifecycleBadges } from './NodeLifecycleBadges';
import {
  FinalStateIcon,
  HistoryStateIcon,
  InitialArrowIcon,
} from './nodeIcons';
import { DEFAULT_ZOOM_RADIUS, isZoomLarge } from './zoom';

interface StateTreeProps {
  node: VizNode;
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
  onEntityHover?: (entityIds: string[]) => void;
  contextAssignIds?: Set<string>;
  contextConsumeIds?: Set<string>;
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
  onEntityHover,
  contextAssignIds,
  contextConsumeIds,
}: {
  node: VizNode;
  activePaths: Set<string>;
  zoomRadius?: number;
  showLifecycleBadges?: boolean;
  onToggleWatch?: (path: string) => void;
  watchedPaths?: Set<string>;
  zoomAnchors: Set<string>;
  onToggleZoom: (path: string, exclusive: boolean) => void;
  highlightedTargetIds?: Set<string>;
  onHighlightTargets?: (targets: Set<string>) => void;
  onEntityHover?: (entityIds: string[]) => void;
  contextAssignIds?: Set<string>;
  contextConsumeIds?: Set<string>;
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
      onEntityHover={onEntityHover}
      contextAssignIds={contextAssignIds}
      contextConsumeIds={contextConsumeIds}
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
  onEntityHover,
  contextAssignIds = new Set(),
  contextConsumeIds = new Set(),
}: StateTreeProps) {
  const isActive = path === '' || activePaths.has(path);
  const childLayout = node.layout === 'none' ? 'sequential' : node.layout;
  const isFinal = node.kind === 'final';
  const isHistory = node.kind === 'history';
  const initialChildIds = new Set(node.initialChildIds);
  const zoomLarge = [...zoomAnchors].some((anchor) =>
    isZoomLarge(path, anchor, zoomRadius),
  );
  const isTransitionTarget = highlightedTargetIds.has(node.id);
  const isContextAssign = contextAssignIds.has(node.id);
  const isContextConsume = contextConsumeIds.has(node.id);
  const isWatched = watchedPaths.has(path);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
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
        `node--${node.kind}`,
        zoomLarge ? 'node--zoom-large' : 'node--zoom-small',
        isActive ? 'node--active' : '',
        isInitial ? 'node--initial' : '',
        isFinal ? 'node--final' : '',
        isHistory ? 'node--history' : '',
        zoomAnchors.has(path) ? 'node--zoom-focus' : '',
        isWatched ? 'node--watched' : '',
        isTransitionTarget ? 'node--transition-target' : '',
        isContextAssign ? 'node--context-assign' : '',
        isContextConsume ? 'node--context-consume' : '',
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
          onEntityHover={onEntityHover}
        />
      )}

      <div className="node__header">
        {isFinal && (
          <span className="node__final-icon" title="final">
            <FinalStateIcon />
            <span className="node__badge-label">final</span>
          </span>
        )}
        {isHistory && (
          <span
            className="node__history-icon"
            title={
              node.details.history === 'deep' ? 'deep history' : 'shallow history'
            }
          >
            <HistoryStateIcon />
            <span className="node__badge-label">
              {node.details.history === 'deep' ? 'deep' : 'hist'}
            </span>
          </span>
        )}
        <span className="node__key">{node.key}</span>
        {node.events.length > 0 && (
          <span className="node__events">
            <span className="node__events-label">on:</span>{' '}
            {node.events.map((ev, index) => (
              <span key={ev.type}>
                {index > 0 && <span className="node__event-separator">, </span>}
                <HoverTip
                  className="node__event"
                  label={ev.type}
                  items={eventTipItems(ev)}
                  placement="below"
                  align="left"
                  onActiveChange={(active) =>
                    onHighlightTargets?.(
                      active ? new Set(ev.highlightIds) : new Set(),
                    )
                  }
                  onEntityHover={onEntityHover}
                >
                  {ev.type}
                </HoverTip>
              </span>
            ))}
          </span>
        )}
      </div>

      {node.children.length > 0 && (
        <div
          className={`node__children node__children--${childLayout}`}
          data-layout={childLayout}
        >
          {node.children.map((child) => {
            const childPath = path ? `${path}.${child.key}` : child.key;
            return (
              <StateTreeNode
                key={child.key}
                node={child}
                activePaths={activePaths}
                path={childPath}
                isInitial={
                  initialChildIds.has(child.id) ||
                  initialChildIds.has(child.key)
                }
                zoomAnchors={zoomAnchors}
                zoomRadius={zoomRadius}
                showLifecycleBadges={showLifecycleBadges}
                onToggleZoom={onToggleZoom}
                onToggleWatch={onToggleWatch}
                watchedPaths={watchedPaths}
                highlightedTargetIds={highlightedTargetIds}
                onHighlightTargets={onHighlightTargets}
                onEntityHover={onEntityHover}
                contextAssignIds={contextAssignIds}
                contextConsumeIds={contextConsumeIds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Tip rows: numbered cond cascade, then each guard/action as its own entity. */
function eventTipItems(ev: VizEvent): HoverTipItem[] {
  const items: HoverTipItem[] = [];
  ev.transitions.forEach((transition, index) => {
    items.push({
      label: `${index + 1}. ${transition.line.split(' · ')[0] ?? transition.line}`,
    });
    if (transition.guard) {
      items.push({
        label: `if ${transition.guard.name}`,
        entityId: depEntityId(transition.guard) ?? undefined,
      });
    }
    for (const action of transition.actions) {
      items.push({
        label: `do ${action.name}`,
        entityId: depEntityId(action) ?? undefined,
      });
    }
  });
  return items;
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
