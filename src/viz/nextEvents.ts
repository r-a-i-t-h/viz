import type {
  VizNextEvent,
  VizNextEventCandidate,
  VizNode,
} from './model';

/**
 * Events the active configuration can handle, including handlers on active
 * ancestors (XState bubbling). Provider ids are the states that declare `on`.
 * Candidates preserve definition order within each provider (cond cascade).
 */
export function collectNextEvents(
  root: VizNode,
  activePaths: string[],
): VizNextEvent[] {
  const active = new Set(activePaths);
  const providersByType = new Map<string, string[]>();
  const candidatesByType = new Map<string, VizNextEventCandidate[]>();

  function visit(node: VizNode) {
    const path = node.details.path;
    const isActive =
      path === ''
        ? active.size > 0 || activePaths.length === 0
        : active.has(path);

    if (isActive) {
      for (const event of node.events) {
        let providers = providersByType.get(event.type);
        if (!providers) {
          providers = [];
          providersByType.set(event.type, providers);
        }
        if (!providers.includes(node.id)) {
          providers.push(node.id);
        }

        let candidates = candidatesByType.get(event.type);
        if (!candidates) {
          candidates = [];
          candidatesByType.set(event.type, candidates);
        }
        for (const transition of event.transitions) {
          candidates.push({
            providerId: node.id,
            targetIds: transition.targetIds,
            guard: transition.guard,
            actions: transition.actions,
            line: transition.line,
          });
        }
      }
    }

    for (const child of node.children) visit(child);
  }

  visit(root);

  return [...providersByType.entries()].map(([type, providerIds]) => {
    const candidates = candidatesByType.get(type) ?? [];
    const highlightIds = [
      ...new Set([
        ...providerIds,
        ...candidates.flatMap((c) => c.targetIds),
      ]),
    ];
    return {
      type,
      providerIds,
      candidates,
      highlightIds,
    };
  });
}
