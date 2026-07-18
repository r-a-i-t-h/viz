import {
  normalizeStateNodeId,
  type ContextDepGraph,
  type VizSymbol,
} from '@viz/protocol';

/** State node ids that assign vs only consume a context key (assign wins on overlap). */
export function stateIdsForContextKey(
  graph: ContextDepGraph | undefined,
  key: string,
): { assignIds: Set<string>; consumeIds: Set<string> } {
  const assignIds = new Set<string>();
  const consumeIds = new Set<string>();
  if (!graph) return { assignIds, consumeIds };

  const ctxId = `ctx:${key}`;
  for (const edge of graph.edges) {
    if (edge.to !== ctxId) continue;
    const stateId = normalizeStateNodeId(edge.at.stateId);
    if (edge.relation === 'writes') {
      assignIds.add(stateId);
    } else {
      consumeIds.add(stateId);
    }
  }

  for (const id of assignIds) {
    consumeIds.delete(id);
  }

  return { assignIds, consumeIds };
}

/**
 * Context keys touched by a dep-graph entity (action / guard / invoke).
 * Assign (writes) wins when the same entity both writes and reads a key.
 */
export function contextKeysForEntity(
  graph: ContextDepGraph | undefined,
  entityId: string,
): { assignKeys: Set<string>; consumeKeys: Set<string> } {
  return contextKeysForEntities(graph, [entityId]);
}

/** Union of context keys touched by any of the given entities. */
export function contextKeysForEntities(
  graph: ContextDepGraph | undefined,
  entityIds: Iterable<string>,
): { assignKeys: Set<string>; consumeKeys: Set<string> } {
  const assignKeys = new Set<string>();
  const consumeKeys = new Set<string>();
  if (!graph) return { assignKeys, consumeKeys };

  const fromIds = new Set(entityIds);
  if (fromIds.size === 0) return { assignKeys, consumeKeys };

  for (const edge of graph.edges) {
    if (!fromIds.has(edge.from)) continue;
    const key = contextKeyFromEdgeTo(edge.to);
    if (!key) continue;
    if (edge.relation === 'writes') {
      assignKeys.add(key);
    } else {
      consumeKeys.add(key);
    }
  }

  for (const key of assignKeys) {
    consumeKeys.delete(key);
  }

  return { assignKeys, consumeKeys };
}

/** Dep-graph node id for a projected symbol (`action:…` / `guard:…`). */
export function depEntityId(symbol: VizSymbol): string | null {
  if (symbol.kind === 'action') return `action:${symbol.name}`;
  if (symbol.kind === 'guard') return `guard:${symbol.name}`;
  if (symbol.kind === 'actor') return `invoke:${symbol.name}`;
  return null;
}

function contextKeyFromEdgeTo(to: string): string | null {
  if (to.startsWith('ctx:')) return to.slice(4);
  return null;
}
