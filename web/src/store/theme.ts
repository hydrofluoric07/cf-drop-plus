import { atom, useAtom } from 'jotai';
import KvStore from '../database/kv';
import { store } from '.';

export const themeModes = ['light', 'dark'] as const;
export type ThemeMode = (typeof themeModes)[number];

export const themeModeAtom = atom<ThemeMode>('light');

const themeInitPromise = KvStore.themeMode.get().then((saved) => {
  const mode = normalizeThemeMode(saved);
  store.set(themeModeAtom, mode);
  applyTheme(mode);

  store.sub(themeModeAtom, () => {
    const current = store.get(themeModeAtom);
    applyTheme(current);
    KvStore.themeMode.setDebounced(current);
  });

  return mode;
});

export function ensureThemeReady() {
  return themeInitPromise;
}

export function useThemeMode() {
  return useAtom(themeModeAtom);
}

function normalizeThemeMode(input?: string | null): ThemeMode {
  if (input === 'light' || input === 'dark') {
    return input;
  }
  return 'light';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
