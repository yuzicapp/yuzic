import React, { useCallback, useMemo } from 'react';
import { Ellipsis, Shuffle, Play } from 'lucide-react-native';

import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import PlaylistOptions from '@/components/options/PlaylistOptions';
import { resolvePlaylistOrigin } from '@/features/playlist/playlistOrigin';

import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useDownload } from '@/features/offline/DownloadContext';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useTranslation } from 'react-i18next';
import { useSheetRef } from '@/components/useSheetRef';
import { formatDuration } from '@/components/formatDuration';
import DownloadStateIcon from '@/components/DownloadStateIcon';
import { useCollectionDownloadProgress } from '@/features/downloads/useCollectionDownloadProgress';
import {
  DetailActionRow,
  DetailCircleAction,
  DetailHeader,
  DetailHeaderBar,
  DetailHeaderIconButton,
  DetailMetaDot,
  DetailMetaRow,
  DetailMetaText,
  DetailPlayAction,
} from '@/components/DetailHeader';
import { iconSize, spacing } from '@/constants/design';

type Props = {
  playlist: Playlist;
  songs?: Song[];
  showNavigation?: boolean;
  onOptions?: () => void;
};

const PlaylistHeader: React.FC<Props> = ({ playlist, songs = [], showNavigation = true, onOptions }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const optionsSheetRef = useSheetRef();

  const { playSongInCollection } = usePlayingActions();
  const { downloadPlaylistById, cancelCollectionDownloads, getCollectionDownloadState } = useDownload();

  const songIds = useMemo(() => songs.map(s => s.localId), [songs]);
  const { isDownloaded: isPlaylistDownloaded, isDownloading: isPlaylistDownloading } =
    getCollectionDownloadState(songIds);
  const downloadFraction = useCollectionDownloadProgress(songIds);

  const totalDuration = useMemo(
    () => songs.reduce((sum, song) => sum + song.durationSeconds, 0),
    [songs]
  );

  // The entity's own provenance/isOwned answer "where did this come from" —
  // see `playlistOrigin.ts` — rather than the screen inferring it from the
  // title. Owned playlists (the common case) add nothing here; a shared or
  // externally-sourced one gets a third meta item naming it.
  const origin = useMemo(() => resolvePlaylistOrigin(playlist), [playlist]);
  const originLabel = origin.kind === 'shared'
    ? t('playlist.originShared')
    : origin.kind === 'external'
      ? t('playlist.originExternal', { provider: origin.providerId })
      : null;

  const metadataItems = useMemo(
    () => [
      `${songs.length} ${songs.length === 1 ? t('common.song') : t('common.songs')}`,
      formatDuration(totalDuration),
      ...(originLabel ? [originLabel] : []),
    ],
    [songs.length, totalDuration, t, originLabel]
  );

  const toggleDownload = useCallback(async () => {
    if (isPlaylistDownloading) {
      await cancelCollectionDownloads(playlist.nativeId);
      return;
    }
    if (!songs.length || isPlaylistDownloaded) return;
    await downloadPlaylistById(playlist.nativeId, songs);
  }, [songs, isPlaylistDownloading, isPlaylistDownloaded, downloadPlaylistById, cancelCollectionDownloads, playlist.nativeId]);

  // No play is counted here. Pressing play is not listening: these used to
  // credit songs[0] — and its album and artist — the instant the button was
  // hit, so the first track of every playlist was counted twice once the real
  // listen scrobbled, and shuffling credited a track that usually never
  // played at all. The player attributes the playlist itself when a listen
  // actually passes the threshold, which is also what finally made playlists
  // started from anywhere else count.
  const handleShuffle = useCallback(() => {
    if (!songs.length) return;
    playSongInCollection(songs[0], { playlist, songs }, true);
  }, [songs, playlist, playSongInCollection]);

  const handlePlay = useCallback(() => {
    if (!songs.length) return;
    playSongInCollection(songs[0], { playlist, songs });
  }, [songs, playlist, playSongInCollection]);

  return (
    <>
      <DetailHeader
        title={playlist.title}
        cover={playlist.cover}
        rightAction={
          <DetailHeaderIconButton
            accessibilityLabel={t('a11y.common.moreOptions')}
            onPress={onOptions ?? (() => optionsSheetRef.current?.present())}
          >
            <Ellipsis size={iconSize.header} color={colors.secondary} />
          </DetailHeaderIconButton>
        }
        meta={
          <DetailMetaRow>
            {metadataItems.map((item, index) => (
              <React.Fragment key={`${item}-${index}`}>
                {index > 0 && <DetailMetaDot />}
                <DetailMetaText>{item}</DetailMetaText>
              </React.Fragment>
            ))}
          </DetailMetaRow>
        }
        actions={
          <DetailActionRow style={{ marginBottom: spacing.lg }}>
            <DetailCircleAction onPress={handleShuffle} accessibilityLabel={t('a11y.detail.shuffle')}>
              <Shuffle size={icons.row} color={colors.secondary} />
            </DetailCircleAction>

            <DetailPlayAction onPress={handlePlay} accessibilityLabel={t('a11y.detail.play')}>
              <Play size={iconSize.header} color={colors.onThemeColor} fill={colors.onThemeColor} />
            </DetailPlayAction>

            <DetailCircleAction
              onPress={() => void toggleDownload()}
              accessibilityLabel={t(
                isPlaylistDownloading
                  ? 'a11y.detail.cancelDownload'
                  : isPlaylistDownloaded
                    ? 'a11y.detail.downloaded'
                    : 'a11y.detail.download'
              )}
            >
              <DownloadStateIcon
                isDownloaded={isPlaylistDownloaded}
                isDownloading={isPlaylistDownloading}
                progress={downloadFraction}
                color={colors.secondary}
              />
            </DetailCircleAction>
          </DetailActionRow>
        }
        showNavigation={showNavigation}
      />
      {!onOptions && <PlaylistOptions ref={optionsSheetRef} playlist={playlist} hideGoToPlaylist />}
    </>
  );
};

export const PlaylistHeaderBar: React.FC<Props> = ({ playlist, onOptions }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <DetailHeaderBar
      title={playlist.title}
      rightAction={
        <DetailHeaderIconButton
          accessibilityLabel={t('a11y.common.moreOptions')}
          onPress={onOptions}
        >
          <Ellipsis size={iconSize.header} color={colors.secondary} />
        </DetailHeaderIconButton>
      }
    />
  );
};

export default PlaylistHeader;
