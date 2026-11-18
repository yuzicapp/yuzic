import type { Song } from "@/domain/entities/Song";
import { requireProvenance, type MediaBrowserClient } from "../client";
import { mapSong } from "../mapSong";
import type { MediaBrowserItemsResponse } from "../types";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * An artist's most-played songs, as this server knows them.
 *
 * A weaker claim than Subsonic's `getTopSongs.view`, and deliberately a
 * different one: Subsonic is backed by Last.fm playcounts, so it ranks the
 * artist's records the way the world plays them. MediaBrowser has no such
 * graph — `PlayCount` lives in per-user data — so what comes back here is
 * what *this account* has played most. The contract has always said so; it
 * simply had no implementation behind it on Jellyfin and Emby until now.
 *
 * Zero-play tracks are dropped rather than returned in whatever order the
 * server happened to sort them. `SortBy=PlayCount` on a library nobody has
 * played yet is a list with no ranking in it at all, and the section that
 * reads this hides itself on an empty result — which is the honest outcome
 * for an account with nothing to rank.
 */
export async function getTopSongs(
  client: MediaBrowserClient,
  artistName: string,
  limit = 10
): Promise<Song[]> {
  if (!artistName) return [];

  // Matched by name rather than id because the contract is given a name: the
  // artist page knows what it is showing, not which of the server's artist
  // records the track credits. `Artists` is the name-matching filter;
  // `ArtistIds` would need a lookup this call has no id for.
  const path =
    `/Users/${encodeURIComponent(client.userId)}/Items` +
    `?IncludeItemTypes=Audio` +
    `&Recursive=true` +
    `&Artists=${encodeURIComponent(artistName)}` +
    `&SortBy=PlayCount&SortOrder=Descending` +
    `&Limit=${encodeURIComponent(String(limit))}` +
    `&Fields=RunTimeTicks,ArtistItems,AlbumId,ProductionYear,PremiereDate,DateCreated,UserData,IndexNumber,ParentIndexNumber,MediaSources,Genres`;

  try {
    const raw = await client.request<MediaBrowserItemsResponse>(path);
    const provenance = requireProvenance(client);

    return (raw?.Items ?? [])
      .filter(item => item?.Id && (item.UserData?.PlayCount ?? 0) > 0)
      .map(item => mapSong(item, { provenance, brand: client.brand }));
  } catch (error) {
    // One empty shelf, not a failed artist page: every other section on it
    // answers from a different call and none of them depend on this one.
    log.server.error('request failed', { provider: 'media-browser', operation: 'getTopSongs', detail: detailOf(error) });
    return [];
  }
}
