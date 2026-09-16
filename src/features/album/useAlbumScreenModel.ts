/**
 * Route params -> one canonical album.
 *
 * Replaces the album screen's old `localAlbum`/`externalAlbum` pair and the
 * two body components (`LocalAlbumBody`/`ExternalAlbumBody`) that branched
 * on which was present. The real difference between them — full server
 * playback vs. preview-only — is now a typed per-track decision
 * (`trackPlayability.ts`), not two component types.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Album } from '@/domain/entities/Album';
import type { Song } from '@/domain/entities/Song';
import type { TrackPlayability } from './trackPlayability';
import { classifyTrackPlayability } from './trackPlayability';
import { useAlbum } from '@/features/album/useAlbum';
import { useAlbums } from '@/features/album/useAlbums';
import { useArtistAlbums } from '@/features/artist/useArtistAlbums';
import { useExternalAlbumPreviews } from '@/features/album/useExternalAlbumPreviews';
import { useExternalAlbumStatus, type ExternalAlbumStatus } from '@/features/downloaders/useExternalAlbumStatus';
import { matchAlbumToLibrary } from '@/features/library/matchToLibrary';
import { preferLocalSong } from '@/features/library/localFirst';
import { useLocalFirst } from '@/features/library/useLocalFirst';
import { ALL_SOURCES, useEnabledExternalSources } from '@/features/sources/registry';
import { QueryKeys } from '@/state/query/queryKeys';

export type AlbumRouteParams = {
  id?: string;
  source?: string;
  albumId?: string;
  artist?: string;
  title?: string;
  forceExternal?: string;
};

export type AlbumScreenModel = {
  status: 'loading' | 'not-found' | 'error' | 'ready';
  isLocal: boolean;
  album: Album | null;
  degraded: boolean;
  songs: Song[];
  songsLoading: boolean;
  /** Per-track playback-availability decision, keyed by `Song.localId` —
   *  see `trackPlayability.ts`. */
  playability: ReadonlyMap<string, TrackPlayability>;
  /** Other albums by this artist already in the library — local mode only. */
  moreAlbums: Album[];
  /** Get/Want status against the user's downloaders — external mode only. */
  externalStatus: ExternalAlbumStatus;
};

/** Moved out of the deleted `useExternalAlbum` hook — same resolution order
 *  (direct source+id, then a name search across every enabled source), now
 *  living alongside the rest of album identity resolution. */
function useExternalAlbumLookup(input: {
  enabled: boolean;
  source?: string;
  albumId?: string;
  artist?: string;
  title?: string;
}) {
  const { enabled, source, albumId, artist, title } = input;
  const enabledSources = useEnabledExternalSources();

  return useQuery({
    queryKey: [
      QueryKeys.ExternalAlbum,
      source ?? 'unknown',
      albumId || `${artist}::${title}`,
      enabledSources.map(s => s.id).join(','),
    ],
    enabled,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const sourceDef = ALL_SOURCES.find(s => s.id === source);
      if (sourceDef && albumId) return sourceDef.fetchAlbum(albumId);

      if (artist && title) {
        for (const s of enabledSources) {
          const resolvedRef = await s.resolveAlbum(artist, title).catch(() => null);
          if (!resolvedRef) continue;
          const album = await s.fetchAlbum(resolvedRef.id).catch(() => null);
          if (album) return album;
        }
        throw new Error(`Unable to resolve album "${title}"`);
      }

      return null;
    },
  });
}

/** One empty list for every render, so an album with no songs yet keeps memos below stable. */
const NO_SONGS: Song[] = [];

export function useAlbumScreenModel(params: AlbumRouteParams): AlbumScreenModel {
  const { id, source, albumId, artist, title, forceExternal } = params;
  const { albums } = useAlbums();

  const resolvedLocalId = useMemo(() => {
    if (id) return id;
    if (forceExternal === 'true') return null;
    if (!artist || !title) return null;
    const match = matchAlbumToLibrary({ externalIds: {}, title, artistName: artist }, albums);
    return match?.nativeId ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, forceExternal, artist, title, albumId]);

  const isLocal = !!resolvedLocalId;
  const local = useAlbum(resolvedLocalId ?? '');
  const externalEnabled = !isLocal && !!(albumId || (artist && title));
  const external = useExternalAlbumLookup({ enabled: externalEnabled, source, albumId, artist, title });

  const album: Album | null = isLocal ? local.album : (external.data?.album ?? null);
  const browsedSongs: Song[] = isLocal ? local.songs : (external.data?.songs ?? NO_SONGS);
  const songsLoading = isLocal ? local.songsLoading : external.isLoading;

  // Local first: a browsed album's track list is resolved against the library
  // once, here, so every consumer below — the rows, the preview queue, the
  // play button — is holding the library's own recording wherever there is
  // one. One rule, asked in one place: features/library/localFirst.
  const { index: libraryIndex } = useLocalFirst();
  const songs = useMemo(
    () => (isLocal ? browsedSongs : browsedSongs.map(song => preferLocalSong(libraryIndex, song))),
    [isLocal, browsedSongs, libraryIndex]
  );

  const previews = useExternalAlbumPreviews(isLocal ? null : album, songs);
  const playability = useMemo(
    () => classifyTrackPlayability(songs, isLocal, previews),
    [songs, isLocal, previews]
  );

  const artistAlbums = useArtistAlbums(isLocal ? (album?.artist.nativeId ?? '') : '');
  const moreAlbums = useMemo(
    () => (isLocal && album ? artistAlbums.filter(a => a.localId !== album.localId) : []),
    [isLocal, album, artistAlbums]
  );

  const externalStatus = useExternalAlbumStatus(isLocal ? null : album);

  const status: AlbumScreenModel['status'] = (() => {
    if (isLocal) {
      if (local.isLoading) return 'loading';
      if (!local.album) return local.error ? 'error' : 'not-found';
      return 'ready';
    }
    if (!albumId && !(artist && title)) return 'not-found';
    if (external.isLoading) return 'loading';
    if (external.error || !external.data) return 'error';
    return 'ready';
  })();

  return {
    status,
    isLocal,
    album,
    degraded: isLocal ? local.degraded : false,
    songs,
    songsLoading,
    playability,
    moreAlbums,
    externalStatus,
  };
}
