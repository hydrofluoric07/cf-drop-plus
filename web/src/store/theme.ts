import { atom, useAtom } from 'jotai';
import KvStore from '../database/kv';
import { store } from '.';

export const themeModes = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof themeModes)[number];
const THEME_STORAGE_KEY = 'cf-drop:theme-mode';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

export const themeModeAtom = atom<ThemeMode>('system');

const themeInitPromise = (async () => {
  const localTheme = readThemeFromLocalStorage();
  const persistedTheme = localTheme ?? normalizeThemeMode(await KvStore.themeMode.get());

  store.set(themeModeAtom, persistedTheme);
  applyTheme(persistedTheme);
  writeThemeToLocalStorage(persistedTheme);

  store.sub(themeModeAtom, () => {
    const current = store.get(themeModeAtom);
    applyTheme(current);
    writeThemeToLocalStorage(current);
    KvStore.themeMode.setDebounced(current);
  });
  bindSystemThemeListener();

  return persistedTheme;
})();

export function ensureThemeReady() {
  return themeInitPromise;
}

export function useThemeMode() {
  return useAtom(themeModeAtom);
}

function normalizeThemeMode(input?: string | null): ThemeMode {
  if (input === 'system' || input === 'light' || input === 'dark') {
    return input;
  }
  return 'system';
}

function applyTheme(themeMode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(themeMode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = themeMode;
  root.style.colorScheme = resolved;
}

function readThemeFromLocalStorage(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'system' || value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function writeThemeToLocalStorage(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage access errors
  }
}

function resolveTheme(themeMode: ThemeMode): 'light' | 'dark' {
  if (themeMode === 'light' || themeMode === 'dark') return themeMode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light';
}

function bindSystemThemeListener() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const media = window.matchMedia(SYSTEM_THEME_QUERY);
  const onSystemThemeChange = () => {
    if (store.get(themeModeAtom) !== 'system') return;
    applyTheme('system');
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onSystemThemeChange);
    return;
  }
  if (typeof media.addListener === 'function') {
    media.addListener(onSystemThemeChange);
  }
}
