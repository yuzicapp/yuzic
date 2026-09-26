import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useTheme } from '@/features/theme/useTheme';
import { useApi } from '@/providers/registry/useApi';
import { notify } from '@/components/toast';
import { useSimilarityService } from '@/providers/registry/similarityService';
import { useCanGeneratePlaylist, generateSimilarPlaylistForArtist } from '@/features/playlist/generateSimilarPlaylist';
import { selectArtistPlayCount } from '@/state/redux/selectors/statsSelectors';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useDownload } from '@/features/offline/DownloadContext';
import { useEnabledExternalSources } from '@/features/sources/registry';
import { useArtistAlbums } from '@/features/artist/useArtistAlbums';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import type { Playlist } from '@/domain/entities/Playlist';
import { makeLocalId } from '@/domain/identity/LocalId';
import { useLazyArtistSongs } from '@/components/options/useLazyCollectionDetails';
import { useLocalFirst } from '@/features/library/useLocalFirst';
import { useWantToggle } from '../shared/wantActions';
import { useCollectionPlaybackActions } from '../shared/playbackActions';
import { useGeneratePlaylistAction } from '../shared/generatePlaylistAction';
import { resolveActions } from '../types';
import { artistActions, type ArtistActionContext } from '../registry/artistActions';
import { artistExternalActions, type ArtistExternalActionContext } from '../registry/artistExternalActions';
import { artistWebLink } from '@/providers/registry/sourceLinks';
import { shareItem } from '@/features/shares/share';

export function useArtistOptionsActions(
  artist: Artist | null, opts: { hideGoToArtist: boolean; isSheetOpen: boolean; close: () => void }
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const api = useApi();
  const playingActions = usePlayingActions();
  const { downloadAlbumById, getCollectionDownloadState } = useDownload();
  const enabledSources = useEnabledExternalSources();
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const similarity = useSimilarityService();
  const canGeneratePlaylist = useCanGeneratePlaylist();
  const playCount = useSelector(selectArtistPlayCount(artist?.nativeId ?? ''));

  const artistAlbums = useArtistAlbums(artist?.nativeId ?? '');
  const { songs: artistSongs, songsLoading } = useLazyArtistSongs(artist?.nativeId, artistAlbums, opts.isSheetOpen);

  const buildCollection = useCallback((songs: Song[]) => {
    if (!artist) return null;
    const playlist: Playlist = {
      localId: makeLocalId('playlist', artist.provenance, `artist:${artist.nativeId}`),
      nativeId: artist.nativeId, provenance: artist.provenance, externalIds: {}, title: artist.name, cover: artist.cover, isOwned: false, songIds: songs.map(song => song.localId),
    };
    return { playlist, songs };
  }, [artist]);

  const playback = useCollectionPlaybackActions(playingActions);
  const collection = useMemo(() => buildCollection(artistSongs), [buildCollection, artistSongs]);

  const { isDownloaded, isDownloading: isCollectionDownloading } = getCollectionDownloadState(artistSongs.map(s => s.localId));
  const isDownloading = isDownloadingAll || isCollectionDownloading;
  const playbackDisabled = songsLoading || !artistSongs.length;

  const { isGenerating: isGeneratingPlaylist, generate: generatePlaylist } = useGeneratePlaylistAction({
    run: () => {
      if (!artist) throw new Error('artist not loaded');
      if (!similarity) throw new Error('no similarity service connected');
      return generateSimilarPlaylistForArtist(api, similarity, artist, artistSongs, { size: 25 });
    },
    t, generatedKey: 'artistOptions.toasts.playlistGenerated', failedKey: 'artistOptions.toasts.playlistGenerationFailed', close: opts.close,
  });

  const inFlightDownloadRef = useRef(false);
  const downloadAll = async () => {
    if (isDownloaded || isDownloading || !artistAlbums.length || inFlightDownloadRef.current) return;
    opts.close();
    inFlightDownloadRef.current = true;
    setIsDownloadingAll(true);
    try {
      await Promise.all(artistAlbums.map(album => downloadAlbumById(album.nativeId)));
    } catch {
      notify.error(t('artistOptions.downloadAllFailed'));
    } finally {
      inFlightDownloadRef.current = false;
      setIsDownloadingAll(false);
    }
  };

  if (!artist) {
    return { actions: [], songsLoading: false, artistAlbums, playCount };
  }

  const ctx: ArtistActionContext = {
    kind: 'artist', origin: 'library', artist, t, colors, close: opts.close,
    playbackDisabled, songsLoading, isDownloaded, isDownloading, isGeneratingPlaylist, canGeneratePlaylist,
    hasExternalSources: enabledSources.length > 0, hideGoToArtist: opts.hideGoToArtist,
    handlers: {
      play: () => playback.play(collection, artistSongs, false, opts.close),
      shuffle: () => playback.play(collection, artistSongs, true, opts.close),
      addToQueue: () => playback.addToQueueOrPlay(collection, artistSongs, opts.close),
      shuffleToQueue: () => playback.shuffleToQueue(collection, artistSongs, opts.close),
      generatePlaylist: () => void generatePlaylist(),
      downloadAll: () => void downloadAll(),
      goToArtist: () => { opts.close(); router.push({ pathname: '/artistView', params: { id: artist.nativeId } }); },
      viewExternal: () => {
        opts.close();
        router.push({ pathname: '/artistView', params: { forceExternal: 'true', mbid: artist.externalIds.mbid ?? undefined, name: artist.name } });
      },
    },
  };

  return { actions: resolveActions(artistActions, ctx), songsLoading, artistAlbums, playCount };
}

/**
 * A browsed artist's actions. A separate hook rather than a branch inside the
 * one above for the usual reason — the library set calls the artist's albums,
 * songs, download and similarity hooks, and every one of those would fire a
 * server request for an artist the server has never heard of.
 */
export function useArtistExternalActions(artist: Artist, opts: { close: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const webLink = useMemo(() => artistWebLink(artist), [artist]);
  const { isWanted, toggle } = useWantToggle(artist.localId, 'artist', 'artist-page');
  // Nothing to want if they are already yours — the one rule answers that
  // here as everywhere else (features/library/localFirst).
  const { localArtist } = useLocalFirst();
  const isInLibrary = localArtist(artist) !== null;

  const ctx: ArtistExternalActionContext = {
    kind: 'artist', origin: 'external', artist, t, colors, close: opts.close,
    isWanted, isInLibrary,
    webSourceNameKey: webLink?.sourceNameKey ?? null,
    handlers: {
      // An artist want carries the artist's name in both fields: there is no
      // separate credit to record, and `arrival`/`jobStatus` both read the
      // artist off `want.artist`.
      toggleWant: () => toggle({
        externalIds: artist.externalIds, title: artist.name, artist: artist.name, cover: artist.cover,
      }),
      share: () => {
        if (!webLink) return;
        opts.close();
        void shareItem({ url: webLink.url, title: artist.name, message: artist.name });
      },
      openInSource: () => {
        if (!webLink) return;
        opts.close();
        void Linking.openURL(webLink.url);
      },
    },
  };

  return { actions: resolveActions(artistExternalActions, ctx) };
}
