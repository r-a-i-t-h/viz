/** Strip leading `#` from XState state node ids for Viz* id matching. */
export function normalizeStateNodeId(id: string): string {
  return id.replace(/^#/, '');
}
