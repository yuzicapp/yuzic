import type { Album } from "@/domain/entities/Album";
import type { Song } from "@/domain/entities/Song";
import type { Provenance } from "@/domain/identity/Provenance";
import { requireProvenance, type MediaBrowserClient } from "../client";
import { mapSong } from "../mapSong";
import { normalizeAlbum } from "../albums/getAlbums";
import type { MediaBrowserItem } from "../types";
import { fetchAllItems } from "../pagedItems";

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
    // it copes by returning nothing rather than by failing. `console.error`
    // says something went wrong that the code could not handle, and in
    // development it puts a full-screen red box over the app — which, for a
    // server behind a flaky tunnel answering 530 on one request in ten, means
    // the app is unusable for a fault it is already absorbing.
    console.warn(`Could not read ${client.brand.label} starred items:`, error);
    return { songs: [], albums: [] };
  }
}
