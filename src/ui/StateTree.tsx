import type { StateNodeDefinition } from '../viz';
import { nodeLifecycleFlags } from './lifecycleBadges';

interface StateTreeProps {
  node: StateNodeDefinition;
  activePaths: Set<string>;
  path?: string;
}

const TYPE_BADGE: Record<StateNodeDefinition['type'], string> = {
  atomic: 'atomic',
  compound: 'compound',
  parallel: 'parallel',
  final: 'final',
  history: 'history',
};

/** Optional React tree renderer — only used when a visualizer UI is mounted. */
export function StateTree({ node, activePaths, path = '' }: StateTreeProps) {
  const childKeys = Object.keys(node.states ?? {});
  const isActive = path === '' || activePaths.has(path);
  const transitions = Object.keys(node.on ?? {}).filter(
    (key) => !key.startsWith('xstate.after.'),
  );
  const childLayout = node.type === 'parallel' ? 'parallel' : 'sequential';
  const lifecycle = nodeLifecycleFlags(node);

  return (
    <div className={`node node--${node.type} ${isActive ? 'node--active' : ''}`}>
      {(lifecycle.entry || lifecycle.exit || lifecycle.after) && (
        <div className="node__badges" aria-hidden={false}>
          {lifecycle.entry && (
            <span className="node__badge node__badge--entry" title="entry">
              <EntryIcon />
              <span className="node__badge-label">entry</span>
            </span>
          )}
          {lifecycle.exit && (
            <span className="node__badge node__badge--exit" title="exit">
              <ExitIcon />
              <span className="node__badge-label">exit</span>
            </span>
          )}
          {lifecycle.after && (
            <span className="node__badge node__badge--after" title="after">
              <AfterIcon />
              <span className="node__badge-label">after</span>
            </span>
          )}
        </div>
      )}
      <div className="node__header">
        <span className="node__key">{node.key}</span>
        <span className={`node__type node__type--${node.type}`}>
          {TYPE_BADGE[node.type]}
        </span>
        {transitions.length > 0 && (
          <span className="node__events">on: {transitions.join(', ')}</span>
        )}
      </div>
      {childKeys.length > 0 && (
        <div
          className={`node__children node__children--${childLayout}`}
          data-layout={childLayout}
        >
          {childKeys.map((key) => {
            const childPath = path ? `${path}.${key}` : key;
            return (
              <StateTree
                key={key}
                node={node.states[key]}
                activePaths={activePaths}
                path={childPath}
              />
            );
          })}
        </div>
      )}
    </div>
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
