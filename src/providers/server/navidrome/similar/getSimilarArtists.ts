import type { Artist } from '@/domain/entities/Artist';
import type { Provenance } from '@/domain/identity/Provenance';
import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import { mapArtist } from '../mapArtist';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Navidrome's Subsonic `getArtistInfo2.view` returns a Last.fm-derived
 * biography and a list of similar artists (with library ids where the artist
 * is present, or names only where not). `includeNotPresent: false` keeps only
 * artists the server already has an id for — a full domain artist carrying
 * the server's own provenance, since matching relates it to library records
 * rather than the caller needing a second, thinner type.
 */
export async function getSimilarArtists(
  client: NavidromeClient,
  provenance: Provenance,
  artistId: string,
  count = 20
): Promise<Artist[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getArtistInfo2.view', {
      id: artistId,
      count,
      includeNotPresent: 'false',
    });
    const similar = raw?.['subsonic-response']?.artistInfo2?.similarArtist ?? [];
    if (!Array.isArray(similar)) return [];

    return similar
      .filter((s): s is typeof s & { id: string; name: string } => !!s?.id && !!s?.name)
      .map((s) => mapArtist(s, provenance));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getSimilarArtists', detail: detailOf(error) });
    throw error;
  }
}
