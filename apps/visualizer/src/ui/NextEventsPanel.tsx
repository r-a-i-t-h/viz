import { useMemo, useState } from 'react';
import type { VizNextEvent, VizNode } from '@viz/protocol';
import { HoverTip, type HoverTipItem } from './HoverTip';
import { depEntityId } from './contextDepHighlights';

type NextEventSort = 'shallow' | 'deep' | 'name';

/**
 * Events the active configuration can handle. Hover shows ordered cond
 * cascade and highlights providing states + candidate targets.
 */
export function NextEventsPanel({
  events,
  root,
  onHighlightProviders,
  onEntityHover,
}: {
  events: VizNextEvent[];
  /** Machine tree — used for graph-depth sorts. */
  root?: VizNode;
  onHighlightProviders: (providerIds: Set<string>) => void;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  const [sortBy, setSortBy] = useState<NextEventSort>('shallow');

  const depthById = useMemo(
    () => (root ? depthByNodeId(root) : null),
    [root],
  );

  const sorted = useMemo(() => {
    const list = [...events];
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.type.localeCompare(b.type);
      }
      const depthA = minProviderDepth(a, depthById);
      const depthB = minProviderDepth(b, depthById);
      if (depthA !== depthB) {
        return sortBy === 'shallow' ? depthA - depthB : depthB - depthA;
      }
      return a.type.localeCompare(b.type);
    });
    return list;
  }, [depthById, events, sortBy]);

  if (events.length === 0) {
    return (
      <p className="viz__muted">
        No handled events in the active configuration.
      </p>
    );
  }

  return (
    <div className="viz__next-events-panel">
      <div
        className="viz__context-sort"
        role="group"
        aria-label="Sort next events"
      >
        <span className="viz__context-sort-label">Sort</span>
        <SortButton
          active={sortBy === 'shallow'}
          onClick={() => setSortBy('shallow')}
          title="Graph order: shallowest providers first (ancestors at top)"
        >
          shallow
        </SortButton>
        <SortButton
          active={sortBy === 'deep'}
          onClick={() => setSortBy('deep')}
          title="Graph order: deepest providers first (ancestors at bottom)"
        >
          deep
        </SortButton>
        <SortButton
          active={sortBy === 'name'}
          onClick={() => setSortBy('name')}
          title="Alphabetical by event type"
        >
          name
        </SortButton>
      </div>
      <ul className="viz__next-events">
        {sorted.map((event) => (
          <li key={event.type}>
            <HoverTip
              className="viz__next-event"
              label={event.type}
              items={cascadeTipItems(event)}
              placement="below"
              align="left"
              onEntityHover={onEntityHover}
              onActiveChange={(active) =>
                onHighlightProviders(
                  active
                    ? new Set(event.highlightIds ?? event.providerIds)
                    : new Set(),
                )
              }
            >
              <span className="viz__next-event-type">{event.type}</span>
              <span className="viz__next-event-providers">
                {(event.candidates ?? []).length || event.providerIds.length}
              </span>
            </HoverTip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: string;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'viz__context-sort-btn viz__context-sort-btn--active'
          : 'viz__context-sort-btn'
      }
      aria-pressed={active}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function depthByNodeId(root: VizNode): Map<string, number> {
  const map = new Map<string, number>();
  const walk = (node: VizNode, depth: number) => {
    map.set(node.id, depth);
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(root, 0);
  return map;
}

/** Shallowest providing state depth (0 = root). Missing map → 0. */
function minProviderDepth(
  event: VizNextEvent,
  depthById: Map<string, number> | null,
): number {
  if (!depthById || event.providerIds.length === 0) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const id of event.providerIds) {
    const depth = depthById.get(id);
    if (depth != null && depth < min) min = depth;
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min;
}

function cascadeTipItems(event: VizNextEvent): HoverTipItem[] {
  const candidates = event.candidates ?? [];
  if (candidates.length === 0) {
    return event.providerIds.map((id) => ({ label: `via ${id}` }));
  }
  const items: HoverTipItem[] = [];
  candidates.forEach((candidate, index) => {
    items.push({
      label: `${index + 1}. ${candidate.line}`,
    });
    if (candidate.guard) {
      items.push({
        label: `if ${candidate.guard.name}`,
        entityId: depEntityId(candidate.guard) ?? undefined,
      });
    }
    for (const action of candidate.actions) {
      items.push({
        label: `do ${action.name}`,
        entityId: depEntityId(action) ?? undefined,
      });
    }
  });
  return items;
}
