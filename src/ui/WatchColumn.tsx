import { useState } from 'react';
import type { VizNode } from '../viz';
import { DisclosureChevron } from './DisclosureChevron';
import { findNodeByPath } from './findNodeByPath';
import { NodeLifecycleBadges } from './NodeLifecycleBadges';
import { FinalStateIcon } from './nodeIcons';

export function WatchColumn({
  root,
  watchedPaths,
  activePaths,
  showLifecycleBadges,
  onMove,
  onUnwatch,
  zoomAnchors,
  onToggleZoom,
  highlightedTargetIds,
  onHighlightTargets,
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
  highlightedTargetIds?: Set<string>;
  onHighlightTargets?: (targets: Set<string>) => void;
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
              onHighlightTargets={onHighlightTargets}
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
  onHighlightTargets,
}: {
  node: VizNode;
  path: string;
  isActive: boolean;
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
  onHighlightTargets?: (targets: Set<string>) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isFinal = node.kind === 'final';
  const entryItems = node.details.entry.map((s) => s.name);
  const exitItems = node.details.exit.map((s) => s.name);
  const afterItems = node.details.after.map((t) => t.line);
  const afterHighlightIds = node.details.after.flatMap((t) => t.targetIds);
  const displayPath = path === '' ? node.key : path;

  return (
    <div
      className={[
        'node',
        'node--watch',
        `node--${node.kind}`,
        isActive ? 'node--active' : '',
        isFinal ? 'node--final' : '',
        detailsOpen ? 'node--watch-open' : '',
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
          {entryItems.length > 0 && (
            <div>
              <dt>entry</dt>
              <dd>
                <ul>
                  {entryItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {exitItems.length > 0 && (
            <div>
              <dt>exit</dt>
              <dd>
                <ul>
                  {exitItems.map((item) => (
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
                onHighlightTargets?.(new Set(afterHighlightIds))
              }
              onMouseLeave={() => onHighlightTargets?.(new Set())}
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
          {node.events.map((ev) => {
            if (ev.detailLines.length === 0) return null;
            return (
              <div
                key={ev.type}
                className="node__watch-on"
                onMouseEnter={() =>
                  onHighlightTargets?.(new Set(ev.highlightIds))
                }
                onMouseLeave={() => onHighlightTargets?.(new Set())}
              >
                <dt>on</dt>
                <dd>
                  <ul>
                    {ev.detailLines.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
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
