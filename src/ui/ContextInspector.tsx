import { useState } from 'react';
import type { ContextDepGraph } from '../viz';
import { stateIdsForContextKey } from './contextDepHighlights';

/** Fade highlight window: age 0 is hottest; ages beyond this look idle. */
const AGE_FADE_MAX = 8;

type ContextSort = 'name' | 'age';

/**
 * Top-level context keys as hover targets for dep-graph highlight.
 * Nested values stay JSON-stringified; only root keys are interactive.
 */
export function ContextInspector({
  context,
  contextDeps,
  contextKeyAges,
  hoveredKey,
  onHoverKey,
  assignKeys,
  consumeKeys,
}: {
  context: unknown;
  contextDeps?: ContextDepGraph;
  /** Events since each key last changed (0 = this frame). */
  contextKeyAges?: Record<string, number>;
  hoveredKey: string | null;
  onHoverKey: (key: string | null) => void;
  /** Keys highlighted from hovering an action / guard / invoke. */
  assignKeys?: Set<string>;
  consumeKeys?: Set<string>;
}) {
  const [sortBy, setSortBy] = useState<ContextSort>('name');

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

  const sorted = [...entries].sort(([a], [b]) => {
    if (sortBy === 'age') {
      const ageA = contextKeyAges?.[a] ?? Number.POSITIVE_INFINITY;
      const ageB = contextKeyAges?.[b] ?? Number.POSITIVE_INFINITY;
      if (ageA !== ageB) return ageA - ageB;
    }
    return a.localeCompare(b);
  });

  return (
    <div className="viz__context">
      <div
        className="viz__context-sort"
        role="group"
        aria-label="Sort context keys"
      >
        <span className="viz__context-sort-label">Sort</span>
        <button
          type="button"
          className={
            sortBy === 'name'
              ? 'viz__context-sort-btn viz__context-sort-btn--active'
              : 'viz__context-sort-btn'
          }
          aria-pressed={sortBy === 'name'}
          onClick={() => setSortBy('name')}
        >
          name
        </button>
        <button
          type="button"
          className={
            sortBy === 'age'
              ? 'viz__context-sort-btn viz__context-sort-btn--active'
              : 'viz__context-sort-btn'
          }
          aria-pressed={sortBy === 'age'}
          onClick={() => setSortBy('age')}
          title="Most recently changed first"
        >
          age
        </button>
      </div>
      <ul className="viz__context-keys">
        {sorted.map(([key, value]) => {
          const linked = knownKeys.has(key);
          const active = hoveredKey === key;
          const isAssign = assignKeys?.has(key) ?? false;
          const isConsume = consumeKeys?.has(key) ?? false;
          const age = contextKeyAges?.[key];
          const { assignIds, consumeIds } = stateIdsForContextKey(
            contextDeps,
            key,
          );
          const ageClass =
            age != null && age <= AGE_FADE_MAX
              ? `viz__context-key--changed viz__context-key--age-${age}`
              : '';
          return (
            <li key={key}>
              <button
                type="button"
                className={[
                  'viz__context-key',
                  linked ? 'viz__context-key--linked' : '',
                  active ? 'viz__context-key--active' : '',
                  isAssign ? 'viz__context-key--assign' : '',
                  isConsume ? 'viz__context-key--consume' : '',
                  ageClass,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => onHoverKey(key)}
                onMouseLeave={() => onHoverKey(null)}
                onFocus={() => onHoverKey(key)}
                onBlur={() => onHoverKey(null)}
                title={
                  age != null
                    ? `${assignIds.size} assign · ${consumeIds.size} consume · changed ${age} event${age === 1 ? '' : 's'} ago`
                    : `${assignIds.size} assign · ${consumeIds.size} consume`
                }
              >
                <span className="viz__context-key-name">{key}</span>
                <span className="viz__context-key-value">
                  {JSON.stringify(value)}
                </span>
                {age != null && (
                  <span
                    className="viz__context-key-age"
                    aria-label={`Changed ${age} events ago`}
                  >
                    {age}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
