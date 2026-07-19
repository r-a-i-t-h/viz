export type VizTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'viz.theme';

export function readStoredTheme(): VizTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore quota / private mode */
  }
  return 'dark';
}

export function applyDocumentTheme(theme: VizTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function persistTheme(theme: VizTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}
