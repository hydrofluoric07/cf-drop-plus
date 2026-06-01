import { atom, useAtom } from 'jotai';
import KvStore from '../database/kv';
import { store } from '.';

const LIGHT_BG_STORAGE_KEY = 'cf-drop:light-bg-color';
const DARK_BG_STORAGE_KEY = 'cf-drop:dark-bg-color';
export const DEFAULT_LIGHT_BG_COLOR = '#f4f4f5';
export const DEFAULT_DARK_BG_COLOR = '#1a1a17';

export const lightBgColorAtom = atom(DEFAULT_LIGHT_BG_COLOR);
export const darkBgColorAtom = atom(DEFAULT_DARK_BG_COLOR);

const backgroundInitPromise = (async () => {
  const lightBgColor = normalizeHexColor(
    readColorFromLocalStorage(LIGHT_BG_STORAGE_KEY)
    ?? await KvStore.lightBgColor.get(),
    DEFAULT_LIGHT_BG_COLOR,
  );
  const darkBgColor = normalizeHexColor(
    readColorFromLocalStorage(DARK_BG_STORAGE_KEY)
    ?? await KvStore.darkBgColor.get(),
    DEFAULT_DARK_BG_COLOR,
  );

  store.set(lightBgColorAtom, lightBgColor);
  store.set(darkBgColorAtom, darkBgColor);
  applyBackgroundColors(lightBgColor, darkBgColor);
  writeColorToLocalStorage(LIGHT_BG_STORAGE_KEY, lightBgColor);
  writeColorToLocalStorage(DARK_BG_STORAGE_KEY, darkBgColor);

  store.sub(lightBgColorAtom, () => {
    const current = store.get(lightBgColorAtom);
    applyBackgroundColors(current, store.get(darkBgColorAtom));
    writeColorToLocalStorage(LIGHT_BG_STORAGE_KEY, current);
    KvStore.lightBgColor.setDebounced(current);
  });

  store.sub(darkBgColorAtom, () => {
    const current = store.get(darkBgColorAtom);
    applyBackgroundColors(store.get(lightBgColorAtom), current);
    writeColorToLocalStorage(DARK_BG_STORAGE_KEY, current);
    KvStore.darkBgColor.setDebounced(current);
  });

  return { lightBgColor, darkBgColor };
})();

export function ensureBackgroundReady() {
  return backgroundInitPromise;
}

export function useBackgroundColors() {
  const [lightBgColor, setLightBgColor] = useAtom(lightBgColorAtom);
  const [darkBgColor, setDarkBgColor] = useAtom(darkBgColorAtom);
  return {
    lightBgColor,
    darkBgColor,
    setLightBgColor,
    setDarkBgColor,
  };
}

function applyBackgroundColors(lightBgColor: string, darkBgColor: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--custom-light-bg', lightBgColor);
  root.style.setProperty('--custom-dark-bg', darkBgColor);
}

export function normalizeHexColor(input: unknown, fallback: string) {
  const value = String(input || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function readColorFromLocalStorage(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeColorToLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage access errors
  }
}
