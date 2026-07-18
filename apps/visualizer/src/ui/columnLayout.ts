/** Shared side-column sizing for watch + current-state panels. */

export const COLLAPSED_COLUMN_WIDTH = 0;
export const MIN_COLUMN_WIDTH = 200;
export const MAX_COLUMN_WIDTH = 560;
export const DEFAULT_WATCH_WIDTH = 288;
export const DEFAULT_SIDE_WIDTH = 320;

export function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}
