import {
  normalizeStateNodeId,
  type ContextDepGraph,
} from '../viz';

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
