/**
 * The catalog on disk, one record per resource.
 *
 * The catalog used to ride along in the TanStack Query persister's single
 * blob (`PersistQueryClientProvider` in `app/_layout.tsx`), which is what
 * `createAsyncStoragePersister` does by default: every query in the cache,
 * `JSON.stringify`'d to one key, rewritten whenever anything in the cache
 * changes, and `JSON.parse`'d whole before the app can paint.
 *
 * That is affordable for a small library and quadratic in annoyance for a
 * large one, because the *whole* blob is paid for by *any* change. Modelled
 * on the real entity shapes, an 80,000-track library serialises to ~98 MB and
 * a 300,000-track one to ~367 MB — 0.7 s and 3.3 s just to parse, on desktop
 * V8, before Hermes and a phone's memory ceiling are accounted for. Users
 * reported 10 s cold starts at 80k and an untappable UI at 300k, which is
 * that blob being rewritten on a throttle while they tried to scroll.
 *
 * So the catalog lives here instead, in its own MMKV namespace, one record
 * per resource per server:
 *
 * - **A sync writes only what it fetched.** Six small writes on a sync
 *   replace one enormous write per second of playback.
 * - **A start reads each resource separately**, after first paint, cheapest
 *   first — see `useCatalogHydration`. The tracks list is the whale and lands
 *   last, so nothing else waits behind it.
 * - **Everything else still rides the blob**, which is now small: it holds
 *   the screens' own queries, not the library.
 *
 * What this deliberately does *not* change is where the catalog lives at
 * runtime. It is still one array per resource in the query cache, read
 * through the same keys by the same hooks, so `useAlbums`'s "the persisted
 * cache is the offline story" is still true — only the shape on disk moved.
 * A library too big to hold in memory at all needs paged reads, which is a
 * different and much larger change; this one makes the common case fast
 * without touching a single call site.
 */
import type { QueryKey } from '@tanstack/react-query';

import { catalogStorage } from '@/state/mmkvStorage';
import { CATALOG_RESOURCES } from './catalogQueries';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/** Not exported: it names the parameter below, and every caller reaches it
 *  through `CATALOG_RESOURCES` rather than by naming it. */
type CatalogResourceName = (typeof CATALOG_RESOURCES)[number]['name'];

/**
 * The first element of every catalog query key, taken from the resource table
 * rather than written out again — a second list here would be a second place
 * to update when a resource joins `CATALOG_RESOURCES`, and the cost of
 * missing one is a 98 MB blob quietly coming back.
 *
 * The server id is passed as `''` only to reach the root; it is not part of
 * what is compared.
 */
const CATALOG_QUERY_ROOTS: ReadonlySet<unknown> = new Set(
  CATALOG_RESOURCES.map(resource => resource.queryKey('')[0])
);

/** Whether a key belongs to the catalog, and so is persisted here instead of
 *  in the query persister's blob. */
export function isCatalogQuery(queryKey: QueryKey): boolean {
  return CATALOG_QUERY_ROOTS.has(queryKey[0]);
}

/**
 * How many entries one stored chunk holds.
 *
 * A resource used to be one record: the whole list, `JSON.stringify`'d to a
 * single string. At 89,878 tracks that string is 91 million characters, and
 * reading it back is where cold start's memory peaks. Measured on a device:
 * handing that one string from MMKV to JavaScript took native memory from
 * about 290 MB to 553 MB for a moment, because it exists as MMKV's copy and
 * as the engine's copy at once, and the allocator does not give all of that
 * back afterwards. Writing it during a sync made the same string on the way
 * in.
 *
 * Five thousand tracks is about 5 MB of JSON, so no single allocation on
 * either path is ever more than that, and the tracks list becomes eighteen
 * small reads instead of one enormous one. Albums at this size are two.
 */
const CHUNK_SIZE = 5000;

/** Written before chunking existed: one record holding the whole value. */
const legacyKey = (serverId: string, name: CatalogResourceName): string =>
  `${serverId}:${name}`;

/** Where a resource's chunks begin; every key it owns starts with this. */
const resourcePrefix = (serverId: string, name: CatalogResourceName): string =>
  `${serverId}:${name}@`;

const headKey = (serverId: string, name: CatalogResourceName): string =>
  `${resourcePrefix(serverId, name)}head`;

const chunkKey = (serverId: string, name: CatalogResourceName, generation: string, index: number): string =>
  `${resourcePrefix(serverId, name)}${generation}#${index}`;

/**
 * Which set of chunks is the live one, and how to put it back together.
 *
 * `array` is false for the one resource that is not a list (`starred`, which
 * is an object), stored as a single chunk and returned as it was.
 */
interface Head {
  generation: string;
  count: number;
  array: boolean;
}

/** Unique per write. Time orders it; the random part keeps two writes in the
 *  same millisecond, or after the clock steps back, from sharing one. */
const nextGeneration = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Stores one resource's list.
 *
 * Callers pass only what a fetch actually returned. A resource whose fetch
 * rejected must not reach here: overwriting a good copy with nothing is how
 * an offline library empties itself after one failed sync.
 *
 * **The chunks are written under a new generation, and only then does the
 * head move to it.** Writing over the live chunks in place would mean a
 * process killed halfway through a sync leaves a head pointing at a mix of
 * old and new chunks, which reads back as a library with tracks missing and
 * others doubled, and nothing to tell anyone it happened. Here, until the
 * head is written the previous copy is untouched and still the one read; the
 * half-written generation is just keys nobody points at, and the next write
 * that completes removes them.
 */
export function writeCatalogResource(
  serverId: string,
  name: CatalogResourceName,
  data: unknown
): void {
  try {
    const generation = nextGeneration();
    const array = Array.isArray(data);
    let count = 0;
    if (array) {
      for (let start = 0; start < data.length; start += CHUNK_SIZE) {
        catalogStorage.set(chunkKey(serverId, name, generation, count++), JSON.stringify(data.slice(start, start + CHUNK_SIZE)));
      }
    } else {
      catalogStorage.set(chunkKey(serverId, name, generation, count++), JSON.stringify(data));
    }

    const head: Head = { generation, count, array };
    catalogStorage.set(headKey(serverId, name), JSON.stringify(head));

    removeStale(serverId, name, generation);
  } catch (error) {
    // A full disk or an oversized record loses this resource until the next
    // sync, which is recoverable. Failing the sync over it would not be.
    log.library.warn('could not persist catalog resource', { resource: name, detail: detailOf(error) });
  }
}

/**
 * Everything this resource owns that the head no longer points at: earlier
 * generations, one a crash left half-written, and the pre-chunking record.
 */
function removeStale(serverId: string, name: CatalogResourceName, generation: string): void {
  const prefix = resourcePrefix(serverId, name);
  const live = `${prefix}${generation}#`;
  const head = headKey(serverId, name);
  const legacy = legacyKey(serverId, name);
  for (const key of catalogStorage.getAllKeys()) {
    if (key === legacy || (key.startsWith(prefix) && key !== head && !key.startsWith(live))) {
      catalogStorage.remove(key);
    }
  }
}

/** One resource's list, or undefined when nothing is stored or it cannot be
 *  read. Undefined always means "ask the server", never "the library is
 *  empty". */
export function readCatalogResource<T>(
  serverId: string,
  name: CatalogResourceName
): T | undefined {
  try {
    const headRaw = catalogStorage.getString(headKey(serverId, name));
    if (headRaw === undefined) {
      // Stored by a version before chunking. Read as it was; the next sync
      // writes it chunked and removes this record.
      const raw = catalogStorage.getString(legacyKey(serverId, name));
      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    }

    const head = JSON.parse(headRaw) as Head;
    if (!head.array) {
      const raw = catalogStorage.getString(chunkKey(serverId, name, head.generation, 0));
      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    }

    const all: unknown[] = [];
    for (let index = 0; index < head.count; index++) {
      const raw = catalogStorage.getString(chunkKey(serverId, name, head.generation, index));
      // A missing chunk is a store that cannot be trusted, not a shorter
      // library. Handing back what did read would show a user most of their
      // tracks and no sign that the rest exist.
      if (raw === undefined) return undefined;
      // One at a time rather than spread, for the same reason as the paged
      // fetches: nothing here should depend on a chunk's size staying small.
      for (const entry of JSON.parse(raw) as unknown[]) all.push(entry);
    }
    return all as T;
  } catch (error) {
    log.library.warn('could not read catalog resource', { resource: name, detail: detailOf(error) });
    return undefined;
  }
}

/**
 * Compacts the store back down to what it actually holds.
 *
 * MMKV is append-only inside one mmap'd file: rewriting a key appends the new
 * value and leaves the old one as dead space, and when the file runs out of
 * room it doubles. The catalog's records are the largest values this app
 * writes by a wide margin, so a handful of syncs is enough for the file to
 * outgrow its contents several times over. Measured on a device at 89,878
 * tracks: a 512 MB file, 273 MB of it resident, for records that serialise to
 * roughly 130 MB. The resident part is the expensive half, because an mmap'd
 * page that has been written to counts against the app the same as a
 * malloc'd one.
 *
 * `trim()` rewrites the file at its used size and drops the memory cache. It
 * is safe to call with the catalog live: the records the screens are reading
 * already sit in the query cache, and a later read simply faults its pages
 * back in.
 */
export function compactCatalog(): void {
  try {
    catalogStorage.trim();
  } catch (error) {
    // Compaction is an optimisation. A store that would not trim is still a
    // store that reads, so this must never be what fails a sync.
    log.library.warn('could not compact catalog', { detail: detailOf(error) });
  }
}

/**
 * Drops every stored catalog.
 *
 * Signing out calls `queryClient.clear()`, which used to take the catalog
 * with it because the catalog was in the cache's blob. It is not any more, so
 * this is what keeps sign-out meaning sign-out rather than leaving the
 * previous account's library to rehydrate over the next one's.
 */
export function clearCatalog(): void {
  catalogStorage.clearAll();
}
