/**
 * Why a resolved `PlayableResource` is the one thing in the query cache that
 * may not be written to disk.
 *
 * `usePlayableSongResolver` caches what it resolved under the key below, so
 * that playing the same song twice does not rebuild it. The value holds
 * `streamUrl`, and on every server backend that URL *is* the credential: a
 * Subsonic-family stream URL carries the username and either a token/salt
 * pair or the password itself, and a Jellyfin one carries the access token.
 *
 * The query persister writes the whole dehydrated cache to MMKV, and
 * `createMMKV` is called without an `encryptionKey` (see `state/mmkvStorage`),
 * so until this exclusion existed those URLs sat in plaintext in the app's
 * data directory for up to `QUERY_CACHE_MAX_AGE` — thirty days. Nothing in
 * the app needed them there:
 *
 * - **A downloaded track never consults this cache.** The resolver checks
 *   `getLocalPath` first and returns the file path, which is why offline
 *   playback of downloads does not depend on any of this.
 * - **A synced track is resolvable from nothing but local state.**
 *   `useSongsById` supplies the song and `buildStreamUrl` builds the URL in
 *   process, with no round trip, so a cold start reconstructs the entry the
 *   first time it is asked for.
 * - **An unsynced track needs the network anyway**, and a thirty-day-old URL
 *   is the one thing that cannot help: the token in it went stale long
 *   before. That staleness is not hypothetical — it is what
 *   `playbackEvents`' retry path exists to recover from, since a URL restored
 *   from disk after a JavaScript context restart fails to open and the retry
 *   has to rebuild the whole queue to get past it.
 *
 * So excluding these keys removes a credential from disk *and* removes a
 * class of playback failure. What it costs is one local URL rebuild per song
 * per app start.
 *
 * **Existing blobs heal themselves, but not quite immediately.** The
 * persister rewrites its single key whenever anything in the cache changes,
 * so the first write after this ships drops the stored URLs. The first *read*
 * still happens before that: the start right after upgrading hydrates from
 * the old blob, and would otherwise serve those URLs — stale tokens and all —
 * for one more session. So `_layout`'s `onSuccess` removes them once
 * hydration has run. Afterwards nothing persists them and there is nothing
 * for it to remove.
 */
import type { QueryKey } from '@tanstack/react-query';

import { QueryKeys } from '@/state/query/queryKeys';

/**
 * The key a resolved `PlayableResource` is held under.
 *
 * Built here rather than inline at the three call sites, because
 * `holdsStreamCredentials` below has to recognise exactly this shape: a key
 * written one way and matched another is a credential back on disk with every
 * test still green.
 */
export function playableResourceKey(serverId: string | undefined, songId: string): QueryKey {
  return [QueryKeys.Song, serverId, songId];
}

/**
 * Whether a key's value carries stream credentials, and so must not be
 * persisted. Composed into the persister's `shouldDehydrateQuery` in
 * `app/_layout.tsx` — the predicate is inert unless it is wired in there,
 * which `playableResourcePersistence.test.ts` asserts.
 */
export function holdsStreamCredentials(queryKey: QueryKey): boolean {
  return queryKey[0] === QueryKeys.Song;
}
