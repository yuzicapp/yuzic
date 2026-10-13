/**
 * Route params -> one canonical playlist -> one `PlaylistScreenModel`.
 *
 * Mirrors `useArtistScreenModel`/`useAlbumScreenModel`: identity resolution
 * (`playlistRepository.getPlaylist`, which relates the fetched playlist to
 * whatever is already loaded in the library — same reasoning as
 * `songRepository.getSong`) and the offline-first fallback both happen here,
 * once, instead of the screen re-deriving them. `origin` is the answer to
 * "where did this playlist come from" — see `playlistOrigin.ts` — computed
 * from the entity's own `provenance`/`isOwned` rather than inferred from its
 * title.
 */
import { useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import type { PlaylistDetail } from '@/domain/entities/Detail';
import { useApi } from '@/providers/registry/useApi';
import { QueryKeys } from '@/state/query/queryKeys';
import { staleTime } from '@/state/query/staleTime';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { hasValue, useOfflineFirstQuery } from '@/state/query/useOfflineFirstQuery';
import { usePlaylists } from '@/features/playlist/usePlaylists';
import { useCatalogStore } from '@/features/library/useCatalogStore';
import { songsByTrackIds } from '@/features/library/catalogStore';
import { useDownloadState } from '@/features/offline/DownloadContext';
import { getPlaylist } from './playlistRepository';
import { resolvePlaylistOrigin, type PlaylistOrigin } from './playlistOrigin';

export type PlaylistRouteParams = {
  id: string;
};

export type PlaylistScreenModel = {
  status: 'loading' | 'not-found' | 'error' | 'ready';
  playlist: Playlist | null;
  /** The playlist's tracks, in playlist order — see `PlaylistDetail`. */
  songs: Song[];
  songsLoading: boolean;
  /** A playlist's membership was never synced list-wide — only its metadata
   *  is, so a degraded playlist that was never opened online goes to the
   *  local reconstruction: the playlist's own `songIds`, or the downloaded
   *  collection's tracks, both against the catalog. */
  degraded: boolean;
  /** Where this playlist came from — `null` until the playlist itself is
   *  known. */
  origin: PlaylistOrigin | null;
};

export function usePlaylistScreenModel(params: PlaylistRouteParams): PlaylistScreenModel {
  const { id } = params;
  const api = useApi();
  const activeServer = useSelector(selectActiveServer);
  const serverId = activeServer?.id;
  const { playlists: libraryPlaylists } = usePlaylists();
  const store = useCatalogStore();
  const { getAllDownloadedCollections } = useDownloadState();
  const downloadedCollections = getAllDownloadedCollections();

  const fallbackPlaylist = useMemo(() => {
    const playlist = store.playlistByNativeId.get(id);
    if (!playlist) return undefined;
    // The playlist without a server fetch of its tracks. A server playlist's
    // membership is not in the catalog's playlist record — a listing maps no
    // tracks — so an offline open used to show the playlist and an empty
    // list. Two local sources put the songs back: the playlist's own
    // `songIds` when it has them (a generated or favorites playlist), and
    // otherwise the downloaded collection's `trackIds` in playlist order,
    // each resolved against the catalog, which holds every track — so a
    // fully downloaded playlist keeps its songs visible with the server
    // unreachable. Same shape as `useAlbum`, whose songs come out of the
    // catalog by album id instead.
    const songs = playlist.songIds.length
      ? songsByTrackIds(store, playlist.songIds)
      : songsByTrackIds(
          store,
          downloadedCollections.find(entry => entry.type === 'playlist' && entry.id === id)?.trackIds ?? [],
        );
    return { playlist, songs };
  }, [store, id, downloadedCollections]);

  const query = useOfflineFirstQuery<PlaylistDetail | null>({
    queryKey: [QueryKeys.Playlist, serverId, id],
    queryFn: () => getPlaylist({ kind: 'server', nativeId: id }, { api: api.playlists, libraryPlaylists }),
    enabled: !!serverId && !!id,
    staleTime: staleTime.playlists,
    emptyValue: null,
    hasData: hasValue,
    // The playlist with the songs reconstructed locally — `fallbackPlaylist`
    // — for a screen opened while the server cannot be asked.
    fallbackValue: fallbackPlaylist,
  });

  // Ask the server again each time the screen is opened.
  //
  // The list of playlists is refreshed on focus by the route (`syncPlaylists`),
  // but a playlist's *tracks* live in this query, at the catalog's
  // `staleTime: Infinity` — so a song added from another client, or from the
  // server's own web UI, never appeared until the half-hourly sync came round.
  // Offline the refetch is skipped: the cached detail is already the answer.
  const { refetch } = query.query;
  const offline = query.isOffline || query.serverUnreachable;
  useFocusEffect(
    useCallback(() => {
      if (!offline && serverId && id) void refetch();
    }, [offline, serverId, id, refetch]),
  );

  const playlist = query.data?.playlist ?? null;
  const songs = query.data?.songs ?? [];

  const origin = useMemo(() => (playlist ? resolvePlaylistOrigin(playlist) : null), [playlist]);

  const status: PlaylistScreenModel['status'] = (() => {
    if (query.isLoading) return 'loading';
    if (!playlist) return query.error ? 'error' : 'not-found';
    return 'ready';
  })();

  return {
    status,
    playlist,
    songs,
    songsLoading: query.query.isFetching && songs.length === 0,
    degraded: query.degraded,
    origin,
  };
}
