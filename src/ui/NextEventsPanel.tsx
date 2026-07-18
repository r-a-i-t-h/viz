import type { VizNextEvent } from '../viz';

/**
 * Events the active configuration can handle. Hover highlights providing
 * state(s) in the graph (including active ancestors).
 */
export function NextEventsPanel({
  events,
  onHighlightProviders,
}: {
  events: VizNextEvent[];
  onHighlightProviders: (providerIds: Set<string>) => void;
}) {
  if (events.length === 0) {
    return <p className="viz__muted">No handled events in the active configuration.</p>;
  }

  return (
    <ul className="viz__next-events">
      {events.map((event) => (
        <li key={event.type}>
          <button
            type="button"
            className="viz__next-event"
            onMouseEnter={() =>
              onHighlightProviders(new Set(event.providerIds))
            }
            onMouseLeave={() => onHighlightProviders(new Set())}
            onFocus={() => onHighlightProviders(new Set(event.providerIds))}
            onBlur={() => onHighlightProviders(new Set())}
            title={
              event.providerIds.length === 1
                ? `Handled by ${event.providerIds[0]}`
                : `Handled by ${event.providerIds.length} states`
            }
          >
            <span className="viz__next-event-type">{event.type}</span>
            <span className="viz__next-event-providers">
              {event.providerIds.length}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
