import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { CheckCircle, CirclePlus, CloudDownload } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { notify } from '@/components/toast';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import MediaListRow from '@/components/MediaListRow';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { usePreviewPlayer } from '@/features/playback/usePreviewPlayer';
import { useAddSongToPlaylist } from '@/features/playlist/useAddSongToPlaylist';
import { usePlayableSongResolver } from '@/features/song/usePlayableSongResolver';
import { useLocalFirst } from '@/features/library/useLocalFirst';
import Touchable from '@/components/Touchable';
import { formatDuration } from '@/components/formatDuration';
import { hitSlopFor, spacing } from '@/constants/design';
import type { Song } from '@/domain/entities/Song';

// ── Local song row ─────────────────────────────────────────────────────────────

type LocalRowProps = {
  song: Song;
  playlistId: string;
};

export const LocalRow: React.FC<LocalRowProps> = ({ song, playlistId }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const { playSimilar } = usePlayingActions();
  const { resolvePlayableSong } = usePlayableSongResolver();
  const addToPlaylist = useAddSongToPlaylist();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handlePress = useCallback(async () => {
    try {
      const full = await resolvePlayableSong(song.nativeId);
      if (full) await playSimilar(full.song);
      else notify.error(t('common.playbackError'));
    } catch {
      notify.error(t('common.playbackError'));
    }
  }, [playSimilar, resolvePlayableSong, song, t]);

  const handleAdd = useCallback(async () => {
    if (adding || added) return;
    setAdding(true);
    try {
      await addToPlaylist.mutateAsync({ playlistId, songId: song.nativeId });
      setAdded(true);
      notify.success(t('playlist.recommended.added'));
    } catch {
      notify.error(t('playlist.recommended.addFailed'));
    } finally {
      setAdding(false);
    }
  }, [adding, added, addToPlaylist, playlistId, song.nativeId, t]);

  return (
    <MediaListRow
      title={song.title}
      subtitle={`${song.artist.name}${song.durationSeconds ? ` · ${formatDuration(song.durationSeconds)}` : ''}`}
      cover={song.cover}
      onPress={() => void handlePress()}
      variant="compact"
      trailing={
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t(added ? 'a11y.playlist.songAdded' : 'a11y.playlist.addSong', { title: song.title })}
          accessibilityState={{ disabled: adding || added }}
          onPress={() => void handleAdd()}
          hitSlop={hitSlopFor(icons.row)}
          style={styles.actionBtn}
          disabled={adding || added}
        >
          {added
            ? <CheckCircle size={icons.secondary} color={colors.placeholder} />
            : <CirclePlus size={icons.secondary} color={(adding || added) ? colors.placeholder : colors.subtext} />
          }
        </Touchable>
      }
    />
  );
};

// ── External song row ──────────────────────────────────────────────────────────

type ExternalRowProps = {
  song: Song;
  hasDownloader: boolean;
  onDownload: (song: Song) => void;
};

export const ExternalRow: React.FC<ExternalRowProps> = ({ song: browsedSong, hasDownloader, onDownload }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const { toggle } = usePreviewPlayer();
  const { localSong } = useLocalFirst();
  // Local first: a recommendation the library already holds is played in full
  // from the library, not sampled — see features/library/localFirst.
  const owned = localSong(browsedSong);
  const song = owned ?? browsedSong;
  // `streamId` carries a resolved preview URL — see `Song.streamId` and
  // `usePreviewPlayer`'s `attachPreviewUrl`.
  const hasPreview = !!song.streamId;

  return (
    <MediaListRow
      title={song.title}
      subtitle={`${song.artist.name}${song.durationSeconds ? ` · ${formatDuration(song.durationSeconds)}` : ''}`}
      cover={song.cover}
      onPress={() => song.streamId && void toggle(song, song.streamId)}
      disabled={!hasPreview}
      variant="compact"
      trailing={
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.playlist.downloadSong', { title: song.title })}
          accessibilityState={{ disabled: !hasDownloader }}
          onPress={() => hasDownloader && onDownload(song)}
          disabled={!hasDownloader}
          hitSlop={hitSlopFor(icons.row)}
          style={styles.actionBtn}
        >
          <CloudDownload
            size={icons.secondary}
            color={hasDownloader ? colors.subtext : colors.muted}
          />
        </Touchable>
      }
    />
  );
};

const styles = StyleSheet.create({
  actionBtn: { padding: spacing.xs },
});
