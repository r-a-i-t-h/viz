import { useState } from 'react';
import type { VizEvent, VizNode, VizSymbol } from '@r-a-i-t-h/viz-protocol';
import { depEntityId } from './contextDepHighlights';
import { DisclosureChevron } from './DisclosureChevron';
import { findNodeByPath } from './findNodeByPath';
import { NodeLifecycleBadges } from './NodeLifecycleBadges';
import { FinalStateIcon, HistoryStateIcon } from './nodeIcons';
import {
  NO_TRANSITION_HIGHLIGHT,
  targetHighlight,
  type TransitionHighlight,
} from './transitionHighlight';

export function WatchColumn({
  root,
  watchedPaths,
  activePaths,
  showLifecycleBadges,
  onMove,
  onUnwatch,
  zoomAnchors,
  onToggleZoom,
  highlightedSourceIds,
  highlightedTargetIds,
  onHighlightTransition,
  onEntityHover,
  contextAssignIds,
  contextConsumeIds,
}: {
  root: VizNode;
  watchedPaths: string[];
  activePaths: Set<string>;
  showLifecycleBadges: boolean;
  onMove: (path: string, direction: -1 | 1) => void;
  onUnwatch: (path: string) => void;
  zoomAnchors?: Set<string>;
  onToggleZoom?: (path: string, exclusive: boolean) => void;
  highlightedSourceIds?: Set<string>;
  highlightedTargetIds?: Set<string>;
  onHighlightTransition?: (highlight: TransitionHighlight) => void;
  onEntityHover?: (entityIds: string[]) => void;
  contextAssignIds?: Set<string>;
  contextConsumeIds?: Set<string>;
}) {
  if (watchedPaths.length === 0) {
    return (
      <p className="viz__muted">
        Alt-click a node in the graph to watch it here at a fixed size.
      </p>
    );
  }

  return (
    <ul className="viz__watch-list">
      {watchedPaths.map((path, index) => {
        const node = findNodeByPath(root, path);
        if (!node) return null;
        return (
          <li key={path} className="viz__watch-item">
            <WatchNode
              node={node}
              path={path}
              isActive={path === '' || activePaths.has(path)}
              isTransitionSource={highlightedSourceIds?.has(node.id) ?? false}
              isTransitionTarget={highlightedTargetIds?.has(node.id) ?? false}
              isContextAssign={contextAssignIds?.has(node.id) ?? false}
              isContextConsume={contextConsumeIds?.has(node.id) ?? false}
              isZoomed={zoomAnchors?.has(path) ?? false}
              showLifecycleBadges={showLifecycleBadges}
              canMoveUp={index > 0}
              canMoveDown={index < watchedPaths.length - 1}
              onMoveUp={() => onMove(path, -1)}
              onMoveDown={() => onMove(path, 1)}
              onToggleZoom={() => onToggleZoom?.(path, false)}
              onClose={() => onUnwatch(path)}
              onHighlightTransition={onHighlightTransition}
              onEntityHover={onEntityHover}
            />
          </li>
        );
      })}
    </ul>
  );
}

function WatchNode({
  node,
  path,
  isActive,
  isTransitionSource,
  isTransitionTarget,
  isContextAssign,
  isContextConsume,
  isZoomed,
  showLifecycleBadges,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleZoom,
  onClose,
  onHighlightTransition,
  onEntityHover,
}: {
  node: VizNode;
  path: string;
  isActive: boolean;
  isTransitionSource: boolean;
  isTransitionTarget: boolean;
  isContextAssign: boolean;
  isContextConsume: boolean;
  isZoomed: boolean;
  showLifecycleBadges: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleZoom: () => void;
  onClose: () => void;
  onHighlightTransition?: (highlight: TransitionHighlight) => void;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isFinal = node.kind === 'final';
  const isHistory = node.kind === 'history';
  const afterItems = node.details.after.map((t) => t.line);
  const afterHighlightIds = node.details.after.flatMap((t) => t.targetIds);
  const alwaysItems = node.details.always.map((t) => t.line);
  const alwaysHighlightIds = node.details.always.flatMap((t) => t.targetIds);
  const invokeHighlightIds = node.details.invokes.flatMap(
    (inv) => inv.highlightIds,
  );
  const displayPath = path === '' ? node.key : path;

  return (
    <div
      className={[
        'node',
        'node--watch',
        `node--${node.kind}`,
        isActive ? 'node--active' : '',
        isFinal ? 'node--final' : '',
        isHistory ? 'node--history' : '',
        detailsOpen ? 'node--watch-open' : '',
        isTransitionSource ? 'node--transition-source' : '',
        isTransitionTarget ? 'node--transition-target' : '',
        isContextAssign ? 'node--context-assign' : '',
        isContextConsume ? 'node--context-consume' : '',
        isZoomed ? 'node--watch-zoomed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="node__watch-controls">
        <button
          type="button"
          className={[
            'node__watch-btn',
            'node__watch-btn--zoom',
            isZoomed ? 'node__watch-btn--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={isZoomed ? 'Clear graph zoom' : 'Zoom in graph'}
          aria-pressed={isZoomed}
          title={isZoomed ? 'Clear graph zoom' : 'Zoom in graph'}
          onClick={onToggleZoom}
        >
          z
          <span className="node__badge-label">zoom</span>
        </button>
        <button
          type="button"
          className="node__watch-btn"
          aria-label="Move watch up"
          title="Move up"
          disabled={!canMoveUp}
          onClick={onMoveUp}
        >
          <ChevronUpIcon />
          <span className="node__badge-label">up</span>
        </button>
        <button
          type="button"
          className="node__watch-btn"
          aria-label="Move watch down"
          title="Move down"
          disabled={!canMoveDown}
          onClick={onMoveDown}
        >
          <ChevronDownIcon />
          <span className="node__badge-label">down</span>
        </button>
        <button
          type="button"
          className="node__watch-btn node__watch-btn--close"
          aria-label="Stop watching"
          title="Stop watching"
          onClick={onClose}
        >
          <CloseIcon />
          <span className="node__badge-label">close</span>
        </button>
      </div>

      {showLifecycleBadges && (
        <NodeLifecycleBadges
          node={node}
          align="left"
          className="node__badges--watch"
          onHighlightTransition={onHighlightTransition}
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
        <button
          type="button"
          className="node__watch-name"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span className="node__watch-disclosure" aria-hidden="true">
            <DisclosureChevron open={detailsOpen} />
          </span>
          <span className="node__key">{node.key}</span>
        </button>
      </div>

      {detailsOpen && (
        <dl className="node__watch-meta">
          <div>
            <dt>path</dt>
            <dd>{displayPath}</dd>
          </div>
          <div>
            <dt>id</dt>
            <dd>{node.id}</dd>
          </div>
          <div>
            <dt>type</dt>
            <dd>{node.kind}</dd>
          </div>
          {node.details.tags.length > 0 && (
            <div>
              <dt>tags</dt>
              <dd>{node.details.tags.join(', ')}</dd>
            </div>
          )}
          {node.details.entry.length > 0 && (
            <SymbolList
              label="entry"
              symbols={node.details.entry}
              onEntityHover={onEntityHover}
            />
          )}
          {node.details.exit.length > 0 && (
            <SymbolList
              label="exit"
              symbols={node.details.exit}
              onEntityHover={onEntityHover}
            />
          )}
          {alwaysItems.length > 0 && (
            <div
              className="node__watch-on"
              onMouseEnter={() =>
                onHighlightTransition?.(targetHighlight(alwaysHighlightIds))
              }
              onMouseLeave={() =>
                onHighlightTransition?.(NO_TRANSITION_HIGHLIGHT)
              }
            >
              <dt>always</dt>
              <dd>
                <ul>
                  {alwaysItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {afterItems.length > 0 && (
            <div
              className="node__watch-on"
              onMouseEnter={() =>
                onHighlightTransition?.(targetHighlight(afterHighlightIds))
              }
              onMouseLeave={() =>
                onHighlightTransition?.(NO_TRANSITION_HIGHLIGHT)
              }
            >
              <dt>after</dt>
              <dd>
                <ul>
                  {afterItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {node.details.invokes.length > 0 && (
            <div
              className="node__watch-on"
              onMouseEnter={() =>
                onHighlightTransition?.(targetHighlight(invokeHighlightIds))
              }
              onMouseLeave={() =>
                onHighlightTransition?.(NO_TRANSITION_HIGHLIGHT)
              }
            >
              <dt>invoke</dt>
              <dd>
                <ul>
                  {node.details.invokes.flatMap((inv) => {
                    const lines = [
                      `src ${inv.src}`,
                      inv.id ? `id ${inv.id}` : null,
                      inv.inputSummary ?? null,
                      ...inv.onDone.map((t) => t.line),
                      ...inv.onError.map((t) => t.line),
                    ].filter((line): line is string => line != null);
                    return lines.map((item) => (
                      <li key={`${inv.id}:${item}`}>{item}</li>
                    ));
                  })}
                </ul>
              </dd>
            </div>
          )}
          {node.events.map((ev) => (
            <EventDetail
              key={ev.type}
              event={ev}
              onHighlightTransition={onHighlightTransition}
              onEntityHover={onEntityHover}
            />
          ))}
        </dl>
      )}
    </div>
  );
}

function SymbolList({
  label,
  symbols,
  onEntityHover,
}: {
  label: string;
  symbols: VizSymbol[];
  onEntityHover?: (entityIds: string[]) => void;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <ul>
          {symbols.map((symbol) => (
            <SymbolItem
              key={`${symbol.kind}:${symbol.name}`}
              symbol={symbol}
              onEntityHover={onEntityHover}
            />
          ))}
        </ul>
      </dd>
    </div>
  );
}

function SymbolItem({
  symbol,
  onEntityHover,
}: {
  symbol: VizSymbol;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  const entityId = depEntityId(symbol);
  const text = symbol.detail
    ? `${symbol.name} (${symbol.detail})`
    : symbol.name;

  if (!entityId || !onEntityHover) {
    return <li>{text}</li>;
  }

  return (
    <li>
      <button
        type="button"
        className="node__watch-entity"
        onMouseEnter={() => onEntityHover([entityId])}
        onMouseLeave={() => onEntityHover([])}
        onFocus={() => onEntityHover([entityId])}
        onBlur={() => onEntityHover([])}
      >
        {text}
      </button>
    </li>
  );
}

function EventDetail({
  event,
  onHighlightTransition,
  onEntityHover,
}: {
  event: VizEvent;
  onHighlightTransition?: (highlight: TransitionHighlight) => void;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  if (event.detailLines.length === 0) return null;

  const entityIds = event.transitions.flatMap((t) => {
    const ids: string[] = [];
    if (t.guard) {
      const id = depEntityId(t.guard);
      if (id) ids.push(id);
    }
    for (const action of t.actions) {
      const id = depEntityId(action);
      if (id) ids.push(id);
    }
    return ids;
  });

  return (
    <div
      className="node__watch-on"
      onMouseEnter={() => {
        onHighlightTransition?.(targetHighlight(event.highlightIds));
        if (entityIds.length > 0) onEntityHover?.(entityIds);
      }}
      onMouseLeave={() => {
        onHighlightTransition?.(NO_TRANSITION_HIGHLIGHT);
        onEntityHover?.([]);
      }}
    >
      <dt>on</dt>
      <dd>
        <ul>
          {event.detailLines.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 4.5 3.5 9h9L8 4.5z" fill="currentColor" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 11.5 12.5 7h-9L8 11.5z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M4.2 4.2 7 7l2.8-2.8 1.2 1.2L8.2 8.2l2.8 2.8-1.2 1.2L7 9.4l-2.8 2.8-1.2-1.2 2.8-2.8-2.8-2.8 1.2-1.2z"
        fill="currentColor"
      />
    </svg>
  );
}
