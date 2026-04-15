import { atom, useAtom, useAtomValue } from 'jotai';
import KvStore from '../database/kv';
import {
  defaultLocale,
  detectInitialLocale,
  Locale,
  resolveLocale,
  setRuntimeLocale,
  t,
  TranslationKey,
} from '../i18n';
import { store } from '.';

export const localeAtom = atom<Locale>(defaultLocale);

const localeInitPromise = KvStore.locale.get().then((saved) => {
  const locale = resolveLocale(saved) || detectInitialLocale();
  store.set(localeAtom, locale);
  setRuntimeLocale(locale);

  store.sub(localeAtom, () => {
    const current = store.get(localeAtom);
    setRuntimeLocale(current);
    KvStore.locale.setDebounced(current);
  });

  return locale;
});

export function ensureLocaleReady() {
  return localeInitPromise;
}

export function useLocale() {
  return useAtom(localeAtom);
}

export function useT() {
  const locale = useAtomValue(localeAtom);
  return (key: TranslationKey, params?: Record<string, string | number>) =>
    t(locale, key, params);
}
