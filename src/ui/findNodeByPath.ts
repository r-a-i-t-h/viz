import type { StateNodeDefinition } from '../viz';

/** Resolve a dot-path (`""` = root, `"a.b"` = nested) against a definition tree. */
export function findNodeByPath(
  root: StateNodeDefinition,
  path: string,
): StateNodeDefinition | null {
  if (path === '') return root;

  let current: StateNodeDefinition = root;
  for (const key of path.split('.')) {
    const next = current.states?.[key];
    if (!next) return null;
    current = next;
  }
  return current;
}
