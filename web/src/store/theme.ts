import { atom, useAtom } from 'jotai';
import KvStore from '../database/kv';
import { store } from '.';

export const themeModes = ['classic', 'light', 'dark', 'system'] as const;
export type ThemeMode = (typeof themeModes)[number];
const THEME_STORAGE_KEY = 'cf-drop:theme-mode';
const APPEARANCE_STORAGE_KEY = 'cf-drop:appearance-v1';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

export const themeModeAtom = atom<ThemeMode>('classic');

const themeInitPromise = (async () => {
  // A new appearance preference defaults everyone to Classic once. Subsequent
  // choices (including the original Light/Dark/System modes) are preserved.
  const localTheme = readThemeFromLocalStorage();
  const savedAppearance = await KvStore.appearance.get();
  const persistedTheme = localTheme ?? (isThemeMode(savedAppearance) ? savedAppearance : 'classic');

  store.set(themeModeAtom, persistedTheme);
  applyTheme(persistedTheme);
  writeThemeToLocalStorage(persistedTheme);

  store.sub(themeModeAtom, () => {
    const current = store.get(themeModeAtom);
    applyTheme(current);
    writeThemeToLocalStorage(current);
    KvStore.themeMode.setDebounced(current);
    KvStore.appearance.setDebounced(current);
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

function isThemeMode(input: unknown): input is ThemeMode {
  return themeModes.some((mode) => mode === input);
}

function applyTheme(themeMode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(themeMode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = themeMode;
  root.dataset.skin = themeMode === 'classic' ? 'classic' : 'plus';
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', themeMode === 'classic' ? '#859F3D' : resolved === 'dark' ? '#1a1a17' : '#ffffff',
  );
}

function readThemeFromLocalStorage(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

function writeThemeToLocalStorage(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage access errors; the current session still has its theme.
  }
}

function resolveTheme(themeMode: ThemeMode): 'light' | 'dark' {
  if (themeMode === 'classic' || themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light';
}

function bindSystemThemeListener() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const media = window.matchMedia(SYSTEM_THEME_QUERY);
  const onSystemThemeChange = () => {
    if (store.get(themeModeAtom) === 'system') applyTheme('system');
  };
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onSystemThemeChange);
    return;
  }
  if (typeof media.addListener === 'function') media.addListener(onSystemThemeChange);
}
