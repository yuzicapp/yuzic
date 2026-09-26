import { useMemo } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useTheme } from '@/features/theme/useTheme';
import { useApi } from '@/providers/registry/useApi';
import { useRating } from '@/features/ratings/useRatings';
import { useRatingsAvailable } from '@/features/ratings/useRatingsAvailable';
import { notify } from '@/components/toast';
import { useSimilarityService } from '@/providers/registry/similarityService';
import { useCanGeneratePlaylist, generateSimilarPlaylistForAlbum } from '@/features/playlist/generateSimilarPlaylist';
import { selectAlbumPlayCount } from '@/state/redux/selectors/statsSelectors';
import { usePlaying } from '@/features/playback/PlayingContext';
import { useDownload } from '@/features/offline/DownloadContext';
import { useEnabledExternalSources } from '@/features/sources/registry';
import { useAnyAlbumDownloaderConnected } from '@/features/downloaders/registry';
import { useStarredAlbums } from '@/features/library/useStarredAlbums';
import { useStarAlbum } from '@/features/library/useStarAlbum';
import { useUnstarAlbum } from '@/features/library/useUnstarAlbum';
import { useExternalAlbumStatus } from '@/features/downloaders/useExternalAlbumStatus';
import type { Album } from '@/domain/entities/Album';
import { useLazyAlbumDetail } from '@/components/options/useLazyCollectionDetails';
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation';
import { albumWebLink } from '@/providers/registry/sourceLinks';
import { shareItem } from '@/features/shares/share';
import { toggleFavorite, confirmDestructive } from '../shared/starActions';
import { useWantToggle } from '../shared/wantActions';
import { useShareAction } from '../shared/shareActions';
import { useCollectionPlaybackActions } from '../shared/playbackActions';
import { useGeneratePlaylistAction } from '../shared/generatePlaylistAction';
import { resolveActions } from '../types';
import { albumLibraryActions, type AlbumLibraryActionContext } from '../registry/albumLibraryActions';
import { albumExternalActions, type AlbumExternalActionContext } from '../registry/albumExternalActions';

export function useAlbumLibraryActions(
  album: Album | null,
  opts: { hideGoToAlbum: boolean; isSheetOpen: boolean; onRating: () => void; close: () => void }
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const api = useApi();
  const ratingsAvailable = useRatingsAvailable();
  const rating = useRating(album);
  const enabledSources = useEnabledExternalSources();
  const playing = usePlaying();
  const { downloadAlbumById, removeDownloadByCollectionId, getCollectionDownloadState } = useDownload();
  const { albums: starredAlbums } = useStarredAlbums();
  const starAlbum = useStarAlbum();
  const unstarAlbum = useUnstarAlbum();
  const isStarred = starredAlbums.some(a => a.localId === album?.localId);
  const similarity = useSimilarityService();
  const canGeneratePlaylist = useCanGeneratePlaylist();
  const playCount = useSelector(selectAlbumPlayCount(album?.nativeId ?? ''));

  const { albumWithSongs, songs, songsLoading } = useLazyAlbumDetail(album, opts.isSheetOpen);
  const songIds = useMemo(() => songs.map(s => s.localId), [songs]);
  const { isDownloaded, isDownloading } = getCollectionDownloadState(songIds);
  const playbackDisabled = songsLoading || !songs.length;

  const playback = useCollectionPlaybackActions(playing);
  const { isSharing, share, canShare } = useShareAction({
    itemId: album?.nativeId, title: album?.title ?? '', message: `${album?.title ?? ''}${album?.artist?.name ? ` — ${album.artist.name}` : ''}`,
    failedKey: 'albumOptions.toasts.shareFailed', close: opts.close,
  });
  const { isGenerating: isGeneratingPlaylist, generate: generatePlaylist } = useGeneratePlaylistAction({
    run: async () => {
      if (!albumWithSongs) throw new Error('album detail not loaded');
      if (!similarity) throw new Error('no similarity service connected');
      return generateSimilarPlaylistForAlbum(api, similarity, albumWithSongs, { size: 25 });
    },
    t, generatedKey: 'albumOptions.toasts.playlistGenerated', failedKey: 'albumOptions.toasts.playlistGenerationFailed', close: opts.close,
  });

  if (!album) {
    return { actions: [], songsLoading: false, albumWithSongs: null, songs: [], playCount: 0 };
  }

  const ctx: AlbumLibraryActionContext = {
    kind: 'album', origin: 'library', album, t, colors, close: opts.close,
    isStarred, ratingsAvailable, rating,
    playbackDisabled, songsLoading, isDownloaded, isDownloading, isSharing, canShare,
    isGeneratingPlaylist, canGeneratePlaylist, hasExternalSources: enabledSources.length > 0, hideGoToAlbum: opts.hideGoToAlbum,
    handlers: {
      toggleFavorite: () => void toggleFavorite({
        isStarred, star: () => starAlbum.mutateAsync(album), unstar: () => unstarAlbum.mutateAsync(album),
        t, title: album.title, addedKey: 'albumOptions.toasts.addedToFavorites', removedKey: 'albumOptions.toasts.removedFromFavorites',
        failedKey: 'albumOptions.toasts.updateFavoritesFailed', close: opts.close,
      }),
      rating: () => { opts.close(); requestAnimationFrame(opts.onRating); },
      play: () => playback.play(albumWithSongs, songs, false, opts.close),
      shuffle: () => playback.play(albumWithSongs, songs, true, opts.close),
      addToNext: () => playback.addToNext(
        albumWithSongs, songs, !!playing.currentSong, opts.close,
        () => notify.error(t('songOptions.toasts.nothingPlaying')),
        () => notify.success(t('albumOptions.toasts.addedNext', { title: albumWithSongs?.album.title ?? album.title }))
      ),
      addToEnd: () => playback.addToQueueOrPlay(albumWithSongs, songs, opts.close,
        () => notify.success(t('albumOptions.toasts.addedToEnd', { title: albumWithSongs?.album.title ?? album.title }))),
      shuffleToQueue: () => playback.shuffleToQueue(albumWithSongs, songs, opts.close,
        () => notify.success(t('albumOptions.toasts.shuffledToQueue', { title: albumWithSongs?.album.title ?? album.title }))),
      generatePlaylist: () => void generatePlaylist(),
      goToAlbum: () => { opts.close(); router.push({ pathname: '/albumView', params: { id: album.nativeId } }); },
      viewExternal: () => {
        if (!album.artist?.name) return;
        opts.close();
        router.push({ pathname: '/albumView', params: { forceExternal: 'true', artist: album.artist.name, title: album.title } });
      },
      share: () => void share(),
      download: async () => {
        if (isDownloading) return;
        // Close first, like every other row here. A download runs for minutes
        // and reports itself in Downloads and on the row it came from, so
        // leaving the sheet sitting over the screen buys nothing and hides
        // the thing being downloaded.
        opts.close();
        if (isDownloaded) {
          confirmDestructive({
            title: t('settings.library.downloads.removeTitle'),
            body: t('settings.library.downloads.removeBody', { title: album.title }),
            cancelLabel: t('common.cancel'), confirmLabel: t('common.delete'),
            onConfirm: async () => {
              try {
                await removeDownloadByCollectionId(album.nativeId, songIds);
              } catch {
                notify.error(t('settings.library.downloads.removeFailedBody'));
              }
            },
          });
          return;
        }
        await downloadAlbumById(album.nativeId, songs);
      },
    },
  };

  return { actions: resolveActions(albumLibraryActions, ctx), songsLoading, albumWithSongs, songs, playCount };
}

export function useAlbumExternalActions(album: Album, opts: { close: () => void; openGet: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useExternalAlbumStatus(album);
  const canDownload = useAnyAlbumDownloaderConnected();
  const { isWanted, toggle } = useWantToggle(album.localId, 'album', 'artist-page');
  const { navigateToArtist } = useMatchedNavigation();
  const webLink = useMemo(() => albumWebLink(album), [album]);

  const ctx: AlbumExternalActionContext = {
    kind: 'album', origin: 'external', album, t, colors, close: opts.close, status, isWanted, canDownload,
    webSourceNameKey: webLink?.sourceNameKey ?? null,
    canGoToArtist: Boolean(album.artist.name),
    handlers: {
      toggleWant: () => toggle({
        externalIds: album.externalIds, title: album.title, artist: album.artist.name, cover: album.cover,
      }),
      openGet: opts.openGet,
      // The album carries a thin `ArtistRef`, not a full `Artist` — the same
      // minimal-but-valid build the external header's meta row does, so both
      // ways to the artist land on the same screen.
      goToArtist: () => {
        opts.close();
        navigateToArtist({
          localId: album.artist.localId,
          nativeId: album.artist.nativeId,
          provenance: album.provenance,
          externalIds: album.artist.externalIds,
          name: album.artist.name,
          cover: album.artist.cover,
          tags: [],
          albumIds: [],
        });
      },
      share: () => {
        if (!webLink) return;
        opts.close();
        void shareItem({
          url: webLink.url,
          title: album.title,
          message: album.artist.name ? `${album.title} — ${album.artist.name}` : album.title,
        });
      },
      openInSource: () => {
        if (!webLink) return;
        opts.close();
        void Linking.openURL(webLink.url);
      },
    },
  };

  return { actions: resolveActions(albumExternalActions, ctx), status };
}
