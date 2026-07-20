/**
 * Pure scaling + pan for the state-graph viewport.
 *
 * Separate from neighborhood “attention” zoom (`zoom.ts` / `node--zoom-*`):
 * this only applies a CSS transform over the whole tree.
 */

export const DEFAULT_VIEWPORT_SCALE = 1;
export const MIN_VIEWPORT_SCALE = 0.25;
export const MAX_VIEWPORT_SCALE = 4;

/** Multiplicative step per wheel notch / pinch tick (tuned for trackpads). */
export const VIEWPORT_ZOOM_SENSITIVITY = 0.0025;

export interface GraphViewportTransform {
  /** Translation in viewport pixels (applied before scale at origin 0,0). */
  x: number;
  y: number;
  scale: number;
}

export const IDENTITY_VIEWPORT: GraphViewportTransform = {
  x: 0,
  y: 0,
  scale: DEFAULT_VIEWPORT_SCALE,
};

export function clampViewportScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_VIEWPORT_SCALE;
  return Math.min(MAX_VIEWPORT_SCALE, Math.max(MIN_VIEWPORT_SCALE, scale));
}

/** Pan by wheel/trackpad deltas (CSS pixels). */
export function panViewport(
  current: GraphViewportTransform,
  deltaX: number,
  deltaY: number,
): GraphViewportTransform {
  return {
    ...current,
    x: current.x - deltaX,
    y: current.y - deltaY,
  };
}

/**
 * Scale about a point in viewport coordinates (e.g. cursor relative to the
 * viewport element). Keeps that screen point fixed over the same graph content.
 */
export function zoomViewportAt(
  current: GraphViewportTransform,
  /** Cursor X relative to viewport left. */
  pointerX: number,
  /** Cursor Y relative to viewport top. */
  pointerY: number,
  /** Multiplicative scale factor (>1 zoom in, <1 zoom out). */
  factor: number,
): GraphViewportTransform {
  const nextScale = clampViewportScale(current.scale * factor);
  if (nextScale === current.scale) return current;

  const worldX = (pointerX - current.x) / current.scale;
  const worldY = (pointerY - current.y) / current.scale;

  return {
    scale: nextScale,
    x: pointerX - worldX * nextScale,
    y: pointerY - worldY * nextScale,
  };
}

/**
 * Convert a wheel deltaY into a zoom factor. Negative deltaY (scroll up /
 * pinch out on many trackpads) zooms in.
 */
export function zoomFactorFromWheelDelta(deltaY: number): number {
  return Math.exp(-deltaY * VIEWPORT_ZOOM_SENSITIVITY);
}

export function viewportTransformStyle(
  transform: GraphViewportTransform,
): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}
