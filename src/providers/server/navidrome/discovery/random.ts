import type { Song } from '@/domain/entities/Song';
import type { Provenance } from '@/domain/identity/Provenance';
import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import { mapSong } from '../mapSong';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/** A random slice of the user's library. Optional genre/year filters route to
 * a themed shelf (a random draw of 80s tracks, jazz picks, etc.). */
export async function getRandomSongs(
  client: NavidromeClient,
  provenance: Provenance,
  opts: { size?: number; genre?: string; fromYear?: number; toYear?: number } = {}
): Promise<Song[]> {
  try {
    const params: Record<string, string | number> = {};
    if (opts.size) params.size = opts.size;
    if (opts.genre) params.genre = opts.genre;
    if (opts.fromYear) params.fromYear = opts.fromYear;
    if (opts.toYear) params.toYear = opts.toYear;
    const raw = await client.request<SubsonicResponse>('getRandomSongs.view', params);
    const songs = raw?.['subsonic-response']?.randomSongs?.song ?? [];
    if (!Array.isArray(songs)) return [];
    return songs
      .filter((s): s is typeof s & { id: string } => !!s?.id)
      .map((s) => mapSong(s, { provenance }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getRandomSongs', detail: detailOf(error) });
    throw error;
  }
}
