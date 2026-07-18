/**
 * Top-level context key ages: events since each key last changed (0 = this frame).
 */
export function computeContextKeyAges(
  context: unknown,
  previousContext: unknown | undefined,
  previousAges: Record<string, number> | undefined,
): Record<string, number> {
  if (context == null || typeof context !== 'object' || Array.isArray(context)) {
    return {};
  }

  const next = context as Record<string, unknown>;
  const prev =
    previousContext != null &&
    typeof previousContext === 'object' &&
    !Array.isArray(previousContext)
      ? (previousContext as Record<string, unknown>)
      : undefined;

  const ages: Record<string, number> = {};
  for (const key of Object.keys(next)) {
    if (!prev || !Object.is(prev[key], next[key])) {
      ages[key] = 0;
    } else {
      ages[key] = (previousAges?.[key] ?? 0) + 1;
    }
  }
  return ages;
}
