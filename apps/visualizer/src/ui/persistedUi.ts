import {
  clampColumnWidth,
  DEFAULT_SIDE_WIDTH,
  DEFAULT_WATCH_WIDTH,
} from './columnLayout';

export const LAYOUT_STORAGE_KEY = 'viz.layout';
export const WATCHES_STORAGE_KEY = 'viz.watches';

export type VizLayoutPrefs = {
  watchPanelOpen: boolean;
  sidePanelOpen: boolean;
  watchWidth: number;
  sideWidth: number;
};

const DEFAULT_LAYOUT: VizLayoutPrefs = {
  watchPanelOpen: true,
  sidePanelOpen: true,
  watchWidth: DEFAULT_WATCH_WIDTH,
  sideWidth: DEFAULT_SIDE_WIDTH,
};

let layoutCache: VizLayoutPrefs | undefined;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredLayout(): VizLayoutPrefs {
  if (layoutCache) return layoutCache;

  const stored = readJson(LAYOUT_STORAGE_KEY);
  if (!stored || typeof stored !== 'object') {
    layoutCache = { ...DEFAULT_LAYOUT };
    return layoutCache;
  }

  const record = stored as Record<string, unknown>;
  layoutCache = {
    watchPanelOpen:
      typeof record.watchPanelOpen === 'boolean'
        ? record.watchPanelOpen
        : DEFAULT_LAYOUT.watchPanelOpen,
    sidePanelOpen:
      typeof record.sidePanelOpen === 'boolean'
        ? record.sidePanelOpen
        : DEFAULT_LAYOUT.sidePanelOpen,
    watchWidth:
      typeof record.watchWidth === 'number'
        ? clampColumnWidth(record.watchWidth)
        : DEFAULT_LAYOUT.watchWidth,
    sideWidth:
      typeof record.sideWidth === 'number'
        ? clampColumnWidth(record.sideWidth)
        : DEFAULT_LAYOUT.sideWidth,
  };
  return layoutCache;
}

export function persistLayout(prefs: VizLayoutPrefs): void {
  layoutCache = {
    watchPanelOpen: prefs.watchPanelOpen,
    sidePanelOpen: prefs.sidePanelOpen,
    watchWidth: clampColumnWidth(prefs.watchWidth),
    sideWidth: clampColumnWidth(prefs.sideWidth),
  };
  writeJson(LAYOUT_STORAGE_KEY, layoutCache);
}

/** Watched node paths keyed by machine name/`label` (order preserved). */
export function readStoredWatches(): Record<string, string[]> {
  const stored = readJson(WATCHES_STORAGE_KEY);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return {};
  }

  const out: Record<string, string[]> = {};
  for (const [machineName, paths] of Object.entries(
    stored as Record<string, unknown>,
  )) {
    if (!Array.isArray(paths)) continue;
    const cleaned = paths.filter((path): path is string => typeof path === 'string');
    if (cleaned.length > 0) out[machineName] = cleaned;
  }
  return out;
}

export function persistWatches(watchedByName: Record<string, string[]>): void {
  const out: Record<string, string[]> = {};
  for (const [machineName, paths] of Object.entries(watchedByName)) {
    if (paths.length > 0) out[machineName] = paths;
  }
  writeJson(WATCHES_STORAGE_KEY, out);
}
