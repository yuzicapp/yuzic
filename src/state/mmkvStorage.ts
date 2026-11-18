import { createMMKV } from 'react-native-mmkv';
import { Storage } from 'redux-persist';

/**
 * Four stores, deliberately separate.
 *
 * Redux holds small durable client state — playback resume position, settings,
 * wants. TanStack Query holds the screens' own queries. The catalog — albums,
 * artists, tracks — holds its own, one record per resource. The diagnostics
 * log holds its own too. They have different sizes, different lifetimes and
 * different reasons to be cleared: dropping a stale catalog should never risk
 * a user's settings, and one instance made that a single blast radius.
 *
 * The log is separate for the clearing rather than the size. A user who has
 * just sent a failure report is entitled to delete what it held without that
 * touching their settings or costing them a re-sync, and the diagnostics
 * screen offers exactly that — so the log needs a `clearAll` of its own. It is
 * also the one store written during a crash, which is a poor moment to be
 * sharing an instance with the user's library.
 *
 * The catalog is separate from the query cache for size rather than for
 * lifetime. The persister rewrites its blob whenever anything in the cache
 * changes, and a catalog inside it made every one of those writes cost the
 * whole library — see `features/library/catalogPersistence`, which owns this
 * store's records.
 *
 * All three live in a namespace of their own for this architecture. Nothing
 * reads the previous namespace: the rewrite changed what every persisted
 * record looks like, so a value carried over would be a value in a shape no
 * reader now understands. Users reconnect and re-sync once, and the old
 * namespace is left untouched so a rollback finds its state exactly as it was.
 */
const NAMESPACE = 'yuzic-v2';

const reduxMmkv = createMMKV({ id: `${NAMESPACE}-redux` });
const queryMmkv = createMMKV({ id: `${NAMESPACE}-query` });
const catalogMmkv = createMMKV({ id: `${NAMESPACE}-catalog` });
const logMmkv = createMMKV({ id: `${NAMESPACE}-log` });

/** Kept for the few modules that store their own small values directly. */
export const mmkv = reduxMmkv;

const storageFor = (store: ReturnType<typeof createMMKV>) => ({
  setItem: (key: string, value: string): Promise<void> => {
    store.set(key, value);
    return Promise.resolve();
  },
  getItem: (key: string): Promise<string | null> =>
    Promise.resolve(store.getString(key) ?? null),
  removeItem: (key: string): Promise<void> => {
    store.remove(key);
    return Promise.resolve();
  },
});

export const reduxStorage: Storage = {
  ...storageFor(reduxMmkv),
  // redux-persist wants a truthy resolution from setItem.
  setItem: (key: string, value: string) => {
    reduxMmkv.set(key, value);
    return Promise.resolve(true);
  },
};

/** The persister for the query cache. Named for what it is, not for AsyncStorage. */
export const queryCacheStorage = storageFor(queryMmkv);

/**
 * The catalog store, handed out raw rather than behind `storageFor`.
 *
 * Its reader is not a persister — it addresses one resource at a time by key,
 * and it needs `clearAll` for sign-out — so the promise-returning shape the
 * other two wear for their libraries' sake would only be something to unwrap.
 */
export const catalogStorage = catalogMmkv;

/**
 * The diagnostics log's store, handed out raw for the same reasons as the
 * catalog's: it addresses its own key and needs `clearAll`, so a
 * promise-returning wrapper would only be something to unwrap. See
 * `features/diagnostics/store` for what it holds.
 */
export const logStorage = logMmkv;
