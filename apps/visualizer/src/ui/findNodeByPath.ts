import type { VizNode } from '@viz/protocol';

/** Resolve a dot-path (`""` = root, `"a.b"` = nested) against a VizNode tree. */
export function findNodeByPath(
  root: VizNode,
  path: string,
): VizNode | null {
  if (path === '') return root;
  const parts = path.split('.');
  let current: VizNode = root;
  for (const part of parts) {
    const next = current.children.find((child) => child.key === part);
    if (!next) return null;
    current = next;
  }
  return current;
}
