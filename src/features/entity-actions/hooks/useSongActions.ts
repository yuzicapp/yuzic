import { useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useTheme } from '@/features/theme/useTheme';
import { useApi } from '@/providers/registry/useApi';
import { notify } from '@/components/toast';
import { selectSongPlayCount } from '@/state/redux/selectors/statsSelectors';
import { useIsOffline } from '@/features/connectivity/useIsOffline';
import { useSimilarityService } from '@/providers/registry/similarityService';
import { generateSimilarPlaylistForSong } from '@/features/playlist/generateSimilarPlaylist';
import { usePlayingState, usePlayingActions } from '@/features/playback/PlayingContext';
import { useLocalFirst } from '@/features/library/useLocalFirst';
import { useStarredSongs } from '@/features/library/useStarredSongs';
import { useStarSong } from '@/features/library/useStarSong';
import { useUnstarSong } from '@/features/library/useUnstarSong';
import { useDownload } from '@/features/offline/DownloadContext';
import { useAnyDownloaderConnected, useAnyTrackDownloaderConnected } from '@/features/downloaders/registry';
import type { Song } from '@/domain/entities/Song';
import type { Album } from '@/domain/entities/Album';
import { toggleFavorite, confirmDestructive } from '../shared/starActions';
import { useWantToggle } from '../shared/wantActions';
import { useGeneratePlaylistAction } from '../shared/generatePlaylistAction';
import { useSleepTimer } from '@/features/player/sleepTimer';
import { resolveActions } from '../types';
import { songLibraryActions, type SongLibraryActionContext } from '../registry/songLibraryActions';
import { songExternalActions, type SongExternalActionContext } from '../registry/songExternalActions';

export function useSongLibraryActions(
  song: Song,
  opts: { onAddToPlaylist: () => void; onSleepTimer?: () => void; onNavigate?: () => void; close: () => void }
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isOffline = useIsOffline();
  const router = useRouter();
  const api = useApi();
  const similarity = useSimilarityService();
  const similarPlaylistAvailable = similarity !== null;
  const { currentSong } = usePlayingState();
  const sleepTimer = useSleepTimer();
  const { addToQueue, playNext, playSimilar } = usePlayingActions();
  const instantMixInFlightRef = useRef(false);

  const { songs: starredSongs } = useStarredSongs();
  const starSong = useStarSong();
  const unstarSong = useUnstarSong();
  const isStarred = starredSongs.some(s => s.localId === song.localId);

  const { downloadTrack, deleteDownloadedTrack, isTrackDownloaded, isTrackDownloading } = useDownload();
  const isDownloaded = isTrackDownloaded(song.localId);
  const isDownloading = isTrackDownloading(song.localId);
  const playCount = useSelector(selectSongPlayCount(song.nativeId));

  const { isGenerating: isGeneratingPlaylist, generate: generatePlaylist } = useGeneratePlaylistAction({
    run: () => {
      if (!similarity) throw new Error('no similarity service connected');
      return generateSimilarPlaylistForSong(api, similarity, song, { size: 25 });
    },
    t, generatedKey: 'songOptions.toasts.playlistGenerated', failedKey: 'songOptions.toasts.playlistGenerationFailed',
    close: opts.close,
  });

  const ctx: SongLibraryActionContext = {
    kind: 'song', origin: 'library', song, t, colors, close: opts.close,
    isStarred, isDownloaded, isDownloading, isGeneratingPlaylist, similarPlaylistAvailable,
    sleepTimer, sleepTimerAvailable: Boolean(opts.onSleepTimer),
    handlers: {
      toggleFavorite: () => void toggleFavorite({
        isStarred, star: () => starSong.mutateAsync(song.nativeId), unstar: () => unstarSong.mutateAsync(song.nativeId),
        t, title: song.title, offlineAware: true, isOffline,
        addedKey: 'songOptions.toasts.addedToFavorites', removedKey: 'songOptions.toasts.removedFromFavorites',
        addedOfflineKey: 'songOptions.toasts.addedToFavoritesOffline', removedOfflineKey: 'songOptions.toasts.removedFromFavoritesOffline',
        failedKey: 'songOptions.toasts.updateFavoritesFailed', close: opts.close,
      }),
      addToQueue: async () => {
        if (!currentSong) { notify.error(t('songOptions.toasts.nothingPlaying')); return; }
        if (song.localId === currentSong.localId) { notify.error(t('songOptions.toasts.alreadyPlaying', { title: song.title })); return; }
        try {
          await playNext(song);
          notify.success(t('songOptions.toasts.playNext', { title: song.title }));
        } catch { notify.error(t('songOptions.toasts.playNextFailed')); } finally { opts.close(); }
      },
      addToEndQueue: async () => {
        if (!currentSong) { notify.error(t('songOptions.toasts.nothingPlaying')); return; }
        if (song.localId === currentSong.localId) { notify.error(t('songOptions.toasts.alreadyPlaying', { title: song.title })); return; }
        try {
          await addToQueue(song);
          notify.success(t('songOptions.toasts.addedToQueue', { title: song.title }));
        } catch { notify.error(t('songOptions.toasts.addToQueueFailed')); } finally { opts.close(); }
      },
      addToPlaylist: () => { opts.close(); requestAnimationFrame(opts.onAddToPlaylist); },
      sleepTimer: () => { opts.close(); if (opts.onSleepTimer) requestAnimationFrame(opts.onSleepTimer); },
      download: async () => {
        if (isDownloading) return;
        if (isDownloaded) {
          confirmDestructive({
            title: t('settings.library.downloads.removeTitle'),
            body: t('settings.library.downloads.removeBody', { title: song.title }),
            cancelLabel: t('common.cancel'), confirmLabel: t('common.delete'),
            onConfirm: async () => {
              try { await deleteDownloadedTrack(song.localId); } catch { notify.error(t('settings.library.downloads.removeFailedBody')); }
            },
          });
          return;
        }
        try { await downloadTrack(song); } catch { notify.error(t('songOptions.toasts.downloadFailed', { title: song.title })); }
      },
      goToAlbum: () => { opts.close(); opts.onNavigate?.(); router.push({ pathname: '/albumView', params: { id: song.album.nativeId } }); },
      goToArtist: () => { opts.close(); opts.onNavigate?.(); router.push({ pathname: '/artistView', params: { id: song.artist.nativeId } }); },
      instantMix: async () => {
        if (instantMixInFlightRef.current) return;
        instantMixInFlightRef.current = true;
        try { await playSimilar(song); } catch { notify.error(t('songOptions.toasts.instantMixFailed')); } finally {
          instantMixInFlightRef.current = false; opts.close();
        }
      },
      generatePlaylist: () => void generatePlaylist(),
    },
  };

  return { actions: resolveActions(songLibraryActions, ctx), playCount };
}

export function useSongExternalActions(
  song: Song,
  opts: { albumTitle: string; albumArtist: string; onPlay?: () => void; close: () => void; openAlbumGet: () => void; openTrackGet: () => void }
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const canDownload = useAnyDownloaderConnected();
  const canDownloadTrack = useAnyTrackDownloaderConnected();
  const { isWanted, toggle } = useWantToggle(song.localId, 'track', 'search');
  // Nothing to want or get if it is already yours — the one rule answers that
  // here as everywhere else (features/library/localFirst).
  const { localSong } = useLocalFirst();
  const isInLibrary = localSong(song) !== null;

  const ctx: SongExternalActionContext = {
    kind: 'song', origin: 'external', song, t, colors, close: opts.close, onPlay: opts.onPlay,
    isWanted, isInLibrary, canDownload, canDownloadTrack,
    handlers: {
      play: () => { opts.close(); opts.onPlay?.(); },
      // The album's cover, not the song's own: a track want is looked up as
      // the record it is on, which is the only thing an artwork archive has a
      // picture of.
      toggleWant: () => toggle({
        externalIds: song.externalIds,
        title: song.title,
        artist: song.artist.name || opts.albumArtist,
        cover: song.album.cover.kind === 'none' ? song.cover : song.album.cover,
      }),
      openAlbumGet: opts.openAlbumGet,
      openTrackGet: opts.openTrackGet,
    },
  };

  return { actions: resolveActions(songExternalActions, ctx), isWanted };
}

/** Builds the `Album` stub `GetReviewSheet` needs for an external song's album/track Get flows. */
export function useExternalSongAlbumStub(song: Song, albumTitle: string): Album {
  return useMemo<Album>(() => ({
    localId: song.album.localId, nativeId: song.album.nativeId, provenance: song.provenance,
    externalIds: song.album.externalIds, libraryState: 'external', title: albumTitle, cover: song.album.cover,
    artist: song.artist, year: song.year, releaseDate: song.releaseDate, releaseType: 'album',
    genres: song.genres, songIds: [],
  }), [song, albumTitle]);
}

export function useExternalSongTrack(song: Song, albumArtist: string) {
  return useMemo(() => ({ title: song.title, artist: song.artist.name || albumArtist }), [song.title, song.artist, albumArtist]);
}
