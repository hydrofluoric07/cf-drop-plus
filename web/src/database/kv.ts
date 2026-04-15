import { debounce } from "../utils/debounce";
import { createPromise } from "../utils/promise";
import { connect, TableName } from "./connect";

const KvDefaults = {
  password: '',
  inputText: '',
  locale: '',
  themeMode: 'light',
}

export type KvKey = keyof typeof KvDefaults;
export type KvValues = typeof KvDefaults;

async function kvGet<K extends KvKey>(key: K): Promise<KvValues[K]> {
  const db = await connect();
  const transaction = db.transaction(TableName.KV, 'readonly');
  const store = transaction.objectStore(TableName.KV);
  const request = store.get(key);

  const p = createPromise();
  request.onerror = p.reject;
  request.onsuccess = p.resolve;
  await p.promise;

  const val = request.result?.value;
  return (val === undefined ? KvDefaults[key] : val);
}

async function kvSet<K extends KvKey>(key: K, value: KvValues[K]) {
  const db = await connect();
  const transaction = db.transaction(TableName.KV, 'readwrite');
  const store = transaction.objectStore(TableName.KV);
  const request = store.put({ key, value });

  const p = createPromise();
  request.onerror = p.reject;
  request.onsuccess = p.resolve;
  await p.promise;
}

interface KvStoreItem<T> {
  get(): Promise<T>;
  set(value: T): Promise<void>;
  setDebounced(value: T): void;
  flush(): void | Promise<void>;
}

const KvStore = Object.fromEntries(
  Object.keys(KvDefaults).map((key) => [key, createKvItem(key as KvKey)])
) as { [K in KvKey]: KvStoreItem<KvValues[K]> };

export default KvStore;

function createKvItem<K extends KvKey>(key: K): KvStoreItem<KvValues[K]> {
  const debouncedSet = debounce((value: KvValues[K]) => kvSet(key, value), 1000);

  return {
    get: () => kvGet(key),
    setDebounced: debouncedSet,
    set(value) {
      debouncedSet.cancel();
      return kvSet(key, value);
    },
    flush: debouncedSet.flush,
  };
}
