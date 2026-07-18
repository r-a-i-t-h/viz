import type { VizNextEvent, VizNode } from './model';

/**
 * Events the active configuration can handle, including handlers on active
 * ancestors (XState bubbling). Provider ids are the states that declare `on`.
 */
export function collectNextEvents(
  root: VizNode,
  activePaths: string[],
): VizNextEvent[] {
  const active = new Set(activePaths);
  const providersByType = new Map<string, Set<string>>();

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
          providers = new Set();
          providersByType.set(event.type, providers);
        }
        providers.add(node.id);
      }
    }

    for (const child of node.children) visit(child);
  }

  visit(root);

  return [...providersByType.entries()].map(([type, providerIds]) => ({
    type,
    providerIds: [...providerIds],
  }));
}
