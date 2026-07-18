import type { VizNextEvent } from '../viz';
import { HoverTip, type HoverTipItem } from './HoverTip';
import { depEntityId } from './contextDepHighlights';

/**
 * Events the active configuration can handle. Hover shows ordered cond
 * cascade and highlights providing states + candidate targets.
 */
export function NextEventsPanel({
  events,
  onHighlightProviders,
  onEntityHover,
}: {
  events: VizNextEvent[];
  onHighlightProviders: (providerIds: Set<string>) => void;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="viz__muted">
        No handled events in the active configuration.
      </p>
    );
  }

  return (
    <ul className="viz__next-events">
      {events.map((event) => (
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
  );
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
