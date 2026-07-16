import type { StateNodeDefinition } from '../viz';

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
  const transitions = Object.keys(node.on ?? {});

  return (
    <div className={`node node--${node.type} ${isActive ? 'node--active' : ''}`}>
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
        <div className="node__children">
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
