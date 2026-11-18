import type { Album } from "@/domain/entities/Album";
import type { Song } from "@/domain/entities/Song";
import type { Provenance } from "@/domain/identity/Provenance";
import { requireProvenance, type MediaBrowserClient } from "../client";
import { mapSong } from "../mapSong";
import { normalizeAlbum } from "../albums/getAlbums";
import type { MediaBrowserItem } from "../types";
import { fetchAllItems } from "../pagedItems";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

interface GetStarredItemsResult {
  songs: Song[];
  albums: Album[];
}

const fetchStarredSongs = (client: MediaBrowserClient, provenance: Provenance) => {
  const path =
    `/Users/${client.userId}/Items` +
    `?Recursive=true` +
    `&Filters=IsFavorite` +
    `&IncludeItemTypes=Audio` +
    `&Fields=Id,Name,Artists,AlbumId,RunTimeTicks,ImageTags,MediaSources,Genres,PremiereDate,DateCreated`;
  // Paged for the same reason the catalog is: favourites have no ceiling
  // either, and this is one of the six resources a sync fetches.
  return fetchAllItems<MediaBrowserItem, Song>(client, path, (s) =>
    mapSong(s, { provenance, brand: client.brand })
  );
};

const fetchStarredAlbums = (client: MediaBrowserClient) => {
  const path =
    `/Users/${client.userId}/Items` +
    `?Recursive=true` +
    `&Filters=IsFavorite` +
    `&IncludeItemTypes=MusicAlbum` +
    `&Fields=PrimaryImageTag,Genres,AlbumArtist,ArtistItems,Artists,DateCreated,ProviderIds,UserData`;
  return fetchAllItems<MediaBrowserItem, Album>(client, path, (a) => normalizeAlbum(a, client));
};

export async function getStarredItems(
  client: MediaBrowserClient
): Promise<GetStarredItemsResult> {
  try {
    const provenance = requireProvenance(client);
    const [songs, albums] = await Promise.all([
      fetchStarredSongs(client, provenance),
      fetchStarredAlbums(client),
    ]);

    return { songs, albums };
  } catch (error) {
    // A warning, not an error: this call has already decided how to cope, and
    // it copes by returning nothing rather than by failing. Error level says
    // something went wrong that the code could not handle — and it still
    // reaches `console.error` through the log's development sink, which puts
    // a full-screen red box over the app. For a server behind a flaky tunnel
    // answering 530 on one request in ten, that makes the app unusable for a
    // fault it is already absorbing.
    log.server.warn('request failed', { provider: client.brand.label, operation: 'getStarredItems', detail: detailOf(error) });
    return { songs: [], albums: [] };
  }
}
