import type { Song } from '@/domain/entities/Song';
import { parseLocalId, type LocalId } from '@/domain/identity/LocalId';
import type { ApiAdapter } from '@/providers/contracts/ServerAdapter';
import shuffleArray from '@/features/playback/shuffleArray';
import type { SimilarityService } from '@/providers/registry/similarityService';

// Tiered source for Smart Shuffle's one-shot injection and Autoplay's
// queue-end extension: a similarity service's acoustic extension when one is
// connected, then the app's existing native similar-songs capability
// (Navidrome's getSimilarSongs.view or Jellyfin/Emby's InstantMix, already
// unified behind api.similar), then the library itself.
export interface QueueFillProvider {
  id: 'similarity-service' | 'native-similarity' | 'library';
  isAvailable(): boolean;
  fetchExtension(opts: {
    /**
     * Seeds, identified the way the server that will be asked about them
     * identifies them. Both providers hand these straight back to a server —
     * the similarity service indexes the active server's own item ids, and `getSimilarSongs`
     * queries the adapter — so this is `nativeId`, not identity.
     */
    recentSongs: { nativeId: string; artistName?: string }[];
    /**
     * What is already queued, keyed by identity rather than by native id. A
     * queue can hold tracks from more than one origin at once — imported local
     * files alongside server tracks — and two origins can easily both call
     * something `42`. Excluding on native id would drop the wrong track.
     */
    excludeIds: Set<LocalId>;
    count: number;
  }): Promise<Song[]>;
}

export function createSimilarityServiceQueueFillProvider(similarity: SimilarityService, api: ApiAdapter): QueueFillProvider {
  return {
    id: 'similarity-service',
    isAvailable: () => true,
    fetchExtension: async ({ recentSongs, excludeIds, count }) => {
      // The service ranks results deterministically by similarity, so asking
      // for exactly `count` would return the same tracks in the same order
      // every time the same seed (e.g. a favorite replayed as the starting
      // track) comes up. Over-fetch a larger pool and randomly sample from
      // it — same pattern the native provider uses — so repeat plays vary.
      const poolSize = Math.max(count * 3, 30);
      // The exclusion set is keyed by identity, but this list is sent to
      // the service, which only knows the media server's own item ids — so it has
      // to be read back down to native ids. Ids from another origin (an
      // imported local file) survive the translation and simply match nothing
      // there, which is the correct outcome: the service was never going to
      // return them anyway.
      const excludeItemIds = [...excludeIds]
        .map(id => parseLocalId(id)?.nativeId)
        .filter((id): id is string => id !== undefined);
      const itemIds = await similarity.similarTrackIds({
        seedItemIds: recentSongs.map(s => s.nativeId),
        excludeItemIds,
        limit: poolSize,
      });
      // The service returns the active media server's native item ids, not
      // full Song objects — resolve each one, dropping any that fail rather
      // than failing the whole batch.
      const resolved = await Promise.allSettled(itemIds.map(itemId => api.songs.get(itemId)));
      const songs = resolved
        .filter((r): r is PromiseFulfilledResult<Song | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((s): s is Song => s !== null && !excludeIds.has(s.localId));
      return shuffleArray(songs).slice(0, count);
    },
  };
}

export function createNativeSimilarityQueueFillProvider(api: ApiAdapter): QueueFillProvider {
  return {
    id: 'native-similarity',
    isAvailable: () => true,
    fetchExtension: async ({ recentSongs, excludeIds, count }) => {
      const seed = recentSongs[recentSongs.length - 1];
      if (!seed) return [];
      const similar = await api.similar.getSimilarSongs(seed.nativeId);
      return shuffleArray(similar.filter(s => !excludeIds.has(s.localId))).slice(0, count);
    },
  };
}

/**
 * The last tier: more by the same artist, then anything from the library.
 *
 * Similar-songs is empty far more often than it looks. Navidrome answers it
 * from Last.fm and returns nothing for a track Last.fm does not know, and a
 * similarity service returns nothing for a track it has not analysed. With
 * only those two tiers, one song played with Autoplay on was one song played:
 * the fill came back empty and nothing asked again. This is what stops that.
 * It is not similarity, which is why `relatedTo` never reaches it.
 */
export function createLibraryQueueFillProvider(api: ApiAdapter): QueueFillProvider {
  return {
    id: 'library',
    isAvailable: () => Boolean(api.artists.getTopSongs || api.discovery),
    fetchExtension: async ({ recentSongs, excludeIds, count }) => {
      const artistName = recentSongs[recentSongs.length - 1]?.artistName;
      // Each source failing on its own is fine; the other may still answer.
      const [byArtist, anything] = await Promise.all([
        artistName && api.artists.getTopSongs
          ? api.artists.getTopSongs(artistName, count * 2).catch(() => [])
          : Promise.resolve([]),
        api.discovery
          ? api.discovery.getRandomSongs({ size: count * 2 }).catch(() => [])
          : Promise.resolve([]),
      ]);
      // Half the batch at most from the artist, so a long session drifts
      // outward instead of playing one discography end to end.
      const seen = new Set<LocalId>(excludeIds);
      const take = (songs: Song[], limit: number): Song[] => {
        const picked: Song[] = [];
        for (const song of shuffleArray(songs)) {
          if (picked.length >= limit) break;
          if (seen.has(song.localId)) continue;
          seen.add(song.localId);
          picked.push(song);
        }
        return picked;
      };
      const fromArtist = take(byArtist, Math.ceil(count / 2));
      return [...fromArtist, ...take(anything, count - fromArtist.length)];
    },
  };
}

// Returns the first available provider in priority order (the similarity
// service first, native fallback last), or null if none are available.
export function resolveQueueFillProvider(providers: QueueFillProvider[]): QueueFillProvider | null {
  return providers.find(p => p.isAvailable()) ?? null;
}
