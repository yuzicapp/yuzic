import { useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';

import { useApi } from '@/providers/registry/useApi';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { getDayKey, getDailySeed, seededShuffle } from '@/features/home/hooks/useDailyLayout';
import { selectSongPlayCounts } from '@/state/redux/selectors/statsSelectors';
import { useSongsById } from '@/features/song/useSongsById';
import type { Song } from '@/domain/entities/Song';

const SEED_POOL_SIZE = 20;
const SEED_COUNT = 2;
const LOCAL_MIX_MAX_TRACKS = 10;

type DailySeeds = { key: string; seeds: Song[] };

/**
 * Keep the day's seeds until there is a reason to pick again.
 *
 * The seeds come from play counts, and a scrobble changes those at the end of
 * every song — which re-ranked the pool, reshuffled it, often picked different
 * seeds, and so changed the query key. Every track change then dropped the
 * shelf to a skeleton, fetched a new mix and wrote the whole query cache to
 * disk: measured as a second Home commit half a second after each song ended,
 * on top of the first. A "daily" mix should not change with every song.
 *
 * Picked again when the day or the manual refresh changes, when nothing had
 * been picked yet, or when a held seed has left the library (a server switch,
 * or a removal), since a mix seeded from a song the library no longer has is
 * not one the server can answer for.
 */
export function chooseDailySeeds(
  previous: DailySeeds | null,
  candidates: Song[],
  key: string,
  songsById: ReadonlyMap<string, Song>,
): DailySeeds {
  if (
    previous
    && previous.key === key
    && previous.seeds.length > 0
    && previous.seeds.every(seed => songsById.has(seed.localId))
  ) {
    return previous;
  }
  if (previous && previous.key === key && previous.seeds === candidates) return previous;
  return { key, seeds: candidates };
}

/**
 * The device-local daily mix used by both Home and its complete screen.
 *
 * The request intentionally stays within the configured music server: local
 * play history chooses the seeds, then the server's existing similarity graph
 * supplies the songs. Keeping it here prevents the preview and full screen
 * from drifting into two differently generated "Your Mix" lists.
 */
export function useLocalMix(refreshKey = 0) {
  const api = useApi();
  const songsById = useSongsById();
  const playCounts = useSelector(selectSongPlayCounts);
  const serverReachable = useServerReachable();
  const dayKey = getDayKey();

  const candidateSeeds = useMemo<Song[]>(() => {
    const played = Object.entries(playCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, SEED_POOL_SIZE)
      .map(([id]) => songsById.get(id))
      .filter((song): song is Song => Boolean(song));

    return seededShuffle(played, getDailySeed(`${dayKey}:localMix:${refreshKey}`)).slice(0, SEED_COUNT);
  }, [dayKey, playCounts, refreshKey, songsById]);

  // The day's seeds, held rather than re-picked on every play-count change —
  // see `chooseDailySeeds`.
  const chosen = useRef<DailySeeds | null>(null);
  chosen.current = chooseDailySeeds(chosen.current, candidateSeeds, `${dayKey}:${refreshKey}`, songsById);
  const seeds = chosen.current.seeds;

  const hasSimilarity = typeof api.similar?.getSimilarSongs === 'function';
  const enabled = hasSimilarity && serverReachable && seeds.length > 0;

  const query = useQuery<Song[]>({
    // The cache key is identity: the same seed reached from two servers is
    // two different mixes.
    queryKey: [QueryKeys.LocalMix, dayKey, refreshKey, seeds.map(song => song.localId).join(',')],
    queryFn: async () => {
      // Seeds are excluded from their own mix by identity, but asked for by
      // the id the server knows them under.
      const seedIds = new Set(seeds.map(song => song.localId));
      const batches = await Promise.all(
        seeds.map(seed => api.similar.getSimilarSongs(seed.nativeId).catch(() => []))
      );
      const seen = new Set<string>();
      const mix: Song[] = [];
      for (const batch of batches) {
        for (const song of batch) {
          if (seedIds.has(song.localId) || seen.has(song.localId)) continue;
          seen.add(song.localId);
          mix.push(song);
        }
      }
      return mix.slice(0, LOCAL_MIX_MAX_TRACKS);
    },
    enabled,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const songs = useMemo(() => query.data ?? [], [query.data]);
  return {
    songs,
    isLoading: enabled && query.isLoading,
    hasContent: enabled && (query.isLoading || songs.length > 0),
  };
}
