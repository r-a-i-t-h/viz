/**
 * Two-level zoom neighborhood around a focused state path.
 *
 * A path is "large" when it lies on the same ancestor/descendant line as the
 * focus and is within `radius` parent/child levels in either direction.
 */

/** Default neighborhood radius (± levels). Overridable via UI / props. */
export const DEFAULT_ZOOM_RADIUS = 2;

export const MIN_ZOOM_RADIUS = 0;
export const MAX_ZOOM_RADIUS = 8;

export function clampZoomRadius(radius: number): number {
  if (!Number.isFinite(radius)) return DEFAULT_ZOOM_RADIUS;
  return Math.min(MAX_ZOOM_RADIUS, Math.max(MIN_ZOOM_RADIUS, Math.round(radius)));
}

export function pathHopDistance(a: string, b: string): number | null {
  const aParts = a === '' ? [] : a.split('.');
  const bParts = b === '' ? [] : b.split('.');

  let i = 0;
  while (i < aParts.length && i < bParts.length && aParts[i] === bParts[i]) {
    i += 1;
  }

  // Diverged into different branches — not on the same lineage.
  if (i < aParts.length && i < bParts.length) return null;

  return Math.abs(aParts.length - bParts.length);
}

export function isZoomLarge(
  path: string,
  focusPath: string | null,
  radius: number = DEFAULT_ZOOM_RADIUS,
): boolean {
  if (focusPath === null) return false;
  const distance = pathHopDistance(path, focusPath);
  return distance !== null && distance <= radius;
}
