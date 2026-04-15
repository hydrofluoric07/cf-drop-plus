import { atom } from 'jotai';
import { store } from '.';
import KvStore from '../database/kv';

export const passwordAtom = atom('');
export const passwordInvalidAtom = atom(false);

const passwordInitPromise = KvStore.password.get().then((password) => {
  store.set(passwordAtom, password);
  store.sub(passwordAtom, () => KvStore.password.setDebounced(store.get(passwordAtom)));
  return password;
});

export async function fetchAPI(input: RequestInfo | URL, init?: RequestInit) {
  await passwordInitPromise;
  const password = store.get(passwordAtom);
  if (password) {
    init = {
      ...init,
      headers: {
        ...init?.headers,
        'x-password': password,
      },
    };
  }

  const res = await fetch(input, init);
  if (res.status === 401) {
    store.set(passwordInvalidAtom, true);
    throw new Error('error.passwordRequired');
  }

  store.set(passwordInvalidAtom, false);
  return res;
}

export async function logout() {
  store.set(passwordAtom, '');
  store.set(passwordInvalidAtom, true);
  await KvStore.password.set('');
}
