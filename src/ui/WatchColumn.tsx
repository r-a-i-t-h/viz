import { useState } from 'react';
import type { StateNodeDefinition } from '../viz';
import { DisclosureChevron } from './DisclosureChevron';
import { findNodeByPath } from './findNodeByPath';
import { HoverTip } from './HoverTip';
import { nodeLifecycleFlags } from './lifecycleBadges';
import {
  formatAfterTransitions,
  formatAllOnTransitions,
  formatEntryActions,
  formatExitActions,
  getOnTransitionTargetIds,
  normalizeStateNodeId,
} from './nodeDetails';

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
}: {
  root: StateNodeDefinition;
  watchedPaths: string[];
  activePaths: Set<string>;
  showLifecycleBadges: boolean;
  onMove: (path: string, direction: -1 | 1) => void;
  onUnwatch: (path: string) => void;
  zoomAnchors?: Set<string>;
  onToggleZoom?: (path: string, exclusive: boolean) => void;
  highlightedTargetIds?: Set<string>;
  onHighlightTargets?: (targets: Set<string>) => void;
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
              isTransitionTarget={
                highlightedTargetIds?.has(normalizeStateNodeId(node.id)) ??
                false
              }
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
  node: StateNodeDefinition;
  path: string;
  isActive: boolean;
  isTransitionTarget: boolean;
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
  const isFinal = node.type === 'final';
  const lifecycle = nodeLifecycleFlags(node);
  const eventKeys = Object.keys(node.on ?? {}).filter(
    (key) => !key.startsWith('xstate.after.'),
  );
  const entryItems = formatEntryActions(node.entry);
  const exitItems = formatExitActions(node.exit);
  const afterItems = formatAfterTransitions(node.on, node.transitions);
  const displayPath = path === '' ? node.key : path;

  return (
    <div
      className={[
        'node',
        'node--watch',
        `node--${node.type}`,
        isActive ? 'node--active' : '',
        isFinal ? 'node--final' : '',
        detailsOpen ? 'node--watch-open' : '',
        isTransitionTarget ? 'node--transition-target' : '',
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

      {showLifecycleBadges &&
        (lifecycle.entry || lifecycle.exit || lifecycle.after) && (
          <div className="node__badges node__badges--watch">
            {lifecycle.entry && (
              <HoverTip
                className="node__badge node__badge--entry"
                label="entry"
                items={entryItems}
                placement="below"
                align="left"
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
                align="left"
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
                align="left"
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
            <dd>{node.type}</dd>
          </div>
          {node.tags.length > 0 && (
            <div>
              <dt>tags</dt>
              <dd>{node.tags.join(', ')}</dd>
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
            <div>
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
          {eventKeys.map((eventKey) => {
            const lines = formatAllOnTransitions(eventKey, node.on[eventKey]);
            if (lines.length === 0) return null;
            return (
              <div
                key={eventKey}
                className="node__watch-on"
                onMouseEnter={() =>
                  onHighlightTargets?.(
                    getOnTransitionTargetIds(node.on[eventKey]),
                  )
                }
                onMouseLeave={() => onHighlightTargets?.(new Set())}
              >
                <dt>on</dt>
                <dd>
                  <ul>
                    {lines.map((item) => (
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
