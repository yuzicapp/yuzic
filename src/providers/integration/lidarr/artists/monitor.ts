/**
 * Putting an artist under Lidarr's watch — what an *artist* want's Get means.
 *
 * Its own module rather than a function in `./index`, because deciding which
 * Lidarr artist a name means lives in `../albums/resolution`, and that module
 * already reads its artist types back from `./index`. Adding the import the
 * other way round closed the loop into an import cycle; this file sits below
 * both instead and imports from each.
 *
 * Reusing that resolution is the point. "Kanye West" has to land on the same
 * Lidarr artist whether it arrives as an album request or as a followed
 * artist, and a second, looser name match written here is exactly how those
 * two answers drift apart.
 */
import type { LidarrClient } from '../client';
import { resolveArtistCandidate, type LidarrAlbumRequest } from '../albums/resolution';
import { ensureArtist, getArtists, lookupArtist } from './index';

export type MonitorArtistRequest = { name: string; mbid?: string };

type MonitorArtistResult =
  | { success: true; artistId: number; created: boolean }
  | { success: false; code: string; message: string };

/**
 * Follow an artist, adding them to Lidarr if it has never heard of them.
 *
 * `searchForMissingAlbums` is deliberately false, and `monitor: 'future'`
 * with it. Get on an artist is a request to *follow* them, not a request for
 * their back catalogue — a Lidarr that immediately went looking for every
 * album an artist ever released would turn one tap into hundreds of downloads
 * nobody asked for, which is the same reason wanting something never starts a
 * download by itself. Their existing releases stay unmonitored and can each
 * be had the normal way, one album Get at a time.
 */
export async function monitorArtist(
  client: LidarrClient,
  request: MonitorArtistRequest
): Promise<MonitorArtistResult> {
  const term = request.name?.trim();
  if (!term) {
    return { success: false, code: 'missing_album_identity', message: 'Missing artist name' };
  }

  // An album request's shape, carrying only the artist half — which is all
  // `resolveArtistCandidate` reads.
  const asRequest: LidarrAlbumRequest = {
    albumTitle: '',
    artistName: term,
    artistMbid: request.mbid ?? null,
  };

  // Artists Lidarr already holds first, same order an album request uses: one
  // it has is resolved without a metadata lookup at all.
  let resolution = resolveArtistCandidate(await getArtists(client), asRequest);
  if (!resolution.ok) {
    resolution = resolveArtistCandidate(await lookupArtist(client, term), asRequest);
  }
  if (!resolution.ok) {
    return { success: false, code: resolution.code, message: `Artist could not be resolved: ${resolution.code}` };
  }

  const ensured = await ensureArtist(client, resolution.artist, {
    monitored: true,
    searchForMissingAlbums: false,
    monitor: 'future',
  });
  if (!ensured.success) {
    return { success: false, code: 'lidarr_metadata_unavailable', message: ensured.message };
  }
  return ensured;
}
