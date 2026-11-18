import type { Song } from '@/domain/entities/Song';
import type { Provenance } from '@/domain/identity/Provenance';
import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import { mapSong } from '../mapSong';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Server-ranked "top songs" for an artist. Subsonic's getTopSongs is backed by
 * Last.fm playcount data on the server side — the ranking is authoritative
 * and comes from the world's play history, not the user's own.
 *
 * Named by artist string, not id: Subsonic's endpoint takes the artist name.
 */
export async function getTopSongs(
  client: NavidromeClient,
  provenance: Provenance,
  artistName: string,
  count = 20
): Promise<Song[]> {
  if (!artistName.trim()) return [];
  try {
    const raw = await client.request<SubsonicResponse>('getTopSongs.view', {
      artist: artistName,
      count,
    });
    const rows = raw?.['subsonic-response']?.topSongs?.song ?? [];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((s): s is typeof s & { id: string } => !!s?.id)
      .map((s) => mapSong(s, { provenance }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getTopSongs', detail: detailOf(error) });
    throw error;
  }
}
