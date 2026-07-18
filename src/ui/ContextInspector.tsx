import type { ContextDepGraph } from '../viz';

/**
 * Top-level context keys as hover targets for dep-graph highlight.
 * Nested values stay JSON-stringified; only root keys are interactive.
 */
export function ContextInspector({
  context,
  contextDeps,
  hoveredKey,
  onHoverKey,
}: {
  context: unknown;
  contextDeps?: ContextDepGraph;
  hoveredKey: string | null;
  onHoverKey: (key: string | null) => void;
}) {
  if (context == null) {
    return <pre className="viz__code">null</pre>;
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return (
      <pre className="viz__code">{JSON.stringify(context, null, 2)}</pre>
    );
  }

  const entries = Object.entries(context as Record<string, unknown>);
  if (entries.length === 0) {
    return <pre className="viz__code">{'{}'}</pre>;
  }

  const knownKeys = new Set(
    (contextDeps?.nodes ?? [])
      .filter((node) => node.kind === 'contextKey')
      .map((node) => node.label),
  );

  return (
    <ul className="viz__context-keys">
      {entries.map(([key, value]) => {
        const linked = knownKeys.has(key);
        const active = hoveredKey === key;
        return (
          <li key={key}>
            <button
              type="button"
              className={[
                'viz__context-key',
                linked ? 'viz__context-key--linked' : '',
                active ? 'viz__context-key--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => onHoverKey(key)}
              onMouseLeave={() => onHoverKey(null)}
              onFocus={() => onHoverKey(key)}
              onBlur={() => onHoverKey(null)}
              title={
                linked
                  ? 'Hover to highlight states that assign or consume this key'
                  : 'No dep-graph links for this key'
              }
            >
              <span className="viz__context-key-name">{key}</span>
              <span className="viz__context-key-value">
                {JSON.stringify(value)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
