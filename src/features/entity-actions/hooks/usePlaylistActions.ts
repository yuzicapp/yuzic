import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useTheme } from '@/features/theme/useTheme';
import { notify } from '@/components/toast';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useDownload } from '@/features/offline/DownloadContext';
import { useDeletePlaylist } from '@/features/playlist/useDeletePlaylist';
import { FAVORITES_ID } from '@/constants/favorites';
import type { Playlist } from '@/domain/entities/Playlist';
import { useLazyPlaylistDetail } from '@/components/options/useLazyCollectionDetails';
import { useShareAction } from '../shared/shareActions';
import { useCollectionPlaybackActions } from '../shared/playbackActions';
import { resolveActions } from '../types';
import { canEditPlaylist, playlistActions, type PlaylistActionContext } from '../registry/playlistActions';
import { confirmDestructive } from '../shared/starActions';

export function usePlaylistOptionsActions(
  playlist: Playlist | null,
  opts: {
    hideGoToPlaylist: boolean;
    isSheetOpen: boolean;
    close: () => void;
    /** Opens the screen's edit mode; absent where there is no playlist screen to edit on. */
    onEditSongs?: () => void;
  }
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const playingActions = usePlayingActions();
  const { downloadPlaylistById, removeDownloadByCollectionId, getCollectionDownloadState } = useDownload();
  const deletePlaylist = useDeletePlaylist();
  const [isRenaming, setIsRenaming] = useState(false);

  const { playlistWithSongs, songs, songsLoading } = useLazyPlaylistDetail(playlist, opts.isSheetOpen);
  const songIds = useMemo(() => songs.map(s => s.localId), [songs]);
  const { isDownloaded, isDownloading } = getCollectionDownloadState(songIds);
  const playbackDisabled = songsLoading || !songs.length;
  const isFavorites = playlist?.nativeId === FAVORITES_ID;

  const playback = useCollectionPlaybackActions(playingActions);
  const { isSharing, share, canShare } = useShareAction({
    itemId: playlist?.nativeId, title: playlist?.title ?? '', message: playlist?.title ?? '',
    failedKey: 'playlistOptions.toasts.shareFailed', close: opts.close,
  });

  const renaming = { isOpen: isRenaming, close: () => setIsRenaming(false) };

  if (!playlist) {
    return { actions: [], songsLoading: false, playlistWithSongs: null, songs: [], renaming };
  }

  const onEditSongs = opts.onEditSongs;
  // The detail knows who may change the playlist where a list row cannot, so
  // it decides what is offered once it has loaded.
  const current = playlistWithSongs?.playlist ?? playlist;
  const ctx: PlaylistActionContext = {
    kind: 'playlist', origin: 'library', playlist: current, t, colors, close: opts.close,
    playbackDisabled, songsLoading, isDownloaded, isDownloading, isSharing, canShare,
    isFavorites, isDeleting: deletePlaylist.isPending, hideGoToPlaylist: opts.hideGoToPlaylist,
    canEditSongs: !!onEditSongs && !isFavorites && canEditPlaylist(current),
    handlers: {
      editSongs: () => {
        opts.close();
        onEditSongs?.();
      },
      play: () => playback.play(playlistWithSongs, songs, false, opts.close),
      shuffle: () => playback.play(playlistWithSongs, songs, true, opts.close),
      addToQueue: () => playback.addToQueueOrPlay(playlistWithSongs, songs, opts.close),
      shuffleToQueue: () => playback.shuffleToQueue(playlistWithSongs, songs, opts.close),
      goToPlaylist: () => {
        opts.close();
        router.push({ pathname: '/playlistView', params: { id: playlist.nativeId } });
      },
      download: async () => {
        if (isDownloading) return;
        opts.close();
        if (isDownloaded) {
          confirmDestructive({
            title: t('settings.library.downloads.removeTitle'),
            body: t('settings.library.downloads.removeBody', { title: playlist.title }),
            cancelLabel: t('common.cancel'), confirmLabel: t('common.delete'),
            onConfirm: async () => {
              try {
                await removeDownloadByCollectionId(playlist.nativeId, songIds);
              } catch {
                notify.error(t('settings.library.downloads.removeFailedBody'));
              }
            },
          });
          return;
        }
        await downloadPlaylistById(playlist.nativeId, songs);
      },
      share: () => void share(),
      rename: () => {
        if (isFavorites) return;
        opts.close();
        setIsRenaming(true);
      },
      delete: () => {
        if (isFavorites) return;
        Alert.alert(
          t('playlistOptions.delete.title'), t('playlistOptions.delete.body', { title: playlist.title }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'), style: 'destructive',
              onPress: async () => {
                try {
                  await deletePlaylist.mutateAsync(playlist.nativeId);
                  opts.close();
                  if (opts.hideGoToPlaylist) navigation.goBack();
                  notify.success(t('playlistOptions.toasts.deleted'));
                } catch { notify.error(t('playlistOptions.toasts.deleteFailed')); }
              },
            },
          ]
        );
      },
    },
  };

  return { actions: resolveActions(playlistActions, ctx), songsLoading, playlistWithSongs, songs, renaming };
}
