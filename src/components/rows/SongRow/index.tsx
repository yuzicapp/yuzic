import { fontScaleCap, hitSlopFor, iconSize, motion, spacing, stateLayer, statusColor, typography } from '@/constants/design';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { useListDensity } from '@/features/theme/useListDensity';
import {
  Text,
  View,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Heart, ArrowDownCircle, Ellipsis, PlayCircle } from 'lucide-react-native';

import type { Song } from '@/domain/entities/Song';
import type { PlayableCollection } from '@/features/playback/playingTypes';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useSongActionSheets } from '@/features/entity-actions/SongActionSheetContext';
import MediaListRow from '@/components/MediaListRow';
import { useTheme } from '@/features/theme/useTheme';
import { useTranslation } from 'react-i18next';
import { useDownloadState } from '@/features/offline/DownloadContext';
import { formatDuration } from '@/components/formatDuration';
import Touchable from '@/components/Touchable';
import SongOptions from '@/components/options/SongOptions';
import { useSheetRef } from '@/components/useSheetRef';
import { useLocalFirst } from '@/features/library/useLocalFirst';
import { useSourceUse } from '@/features/settings/sources/useSourceUse';
import { promptSourceUse } from '@/features/settings/sources/sourceUsePrompt';
import { PREVIEWS_USE } from '@/providers/registry/pageSources';

type SongRowSong = Song;

/** How long a tapped track waits for its clip after previews are turned on. */
const PREVIEW_WAIT_MS = 10_000;

/**
 * True when `song` came from an external catalog (Deezer/etc) rather than
 * the user's library — read off `provenance`, the one place that
 * distinction lives now that there is a single `Song` type. Mirrors
 * `isExternalSongOrigin` in `components/options/SongOptions`.
 */
export function isExternalSong(song: SongRowSong): boolean {
  return song.provenance.origin === 'integration';
}

type Props = {
  song: SongRowSong;
  collection?: PlayableCollection;
  onPress?: () => void;
  variant?: 'default' | 'albumCompact';
  showDownloadedDot?: boolean;
  isFavorite?: boolean;
  /** External-song-only: album context for its options sheet. */
  albumTitle?: string;
  /** External-song-only: album context for its options sheet. */
  albumArtist?: string;
  /** External-song-only: when provided, preview badge is shown and queue actions become available. */
  previewUrl?: string;
};

const ExternalSongRowView: React.FC<{
  song: Song;
  albumTitle: string;
  albumArtist: string;
  previewUrl?: string;
  onPress?: () => void;
}> = ({ song, albumTitle, albumArtist, previewUrl, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const samplesEnabled = useSourceUse(PREVIEWS_USE);
  const density = useListDensity();
  const hasPreview = !!previewUrl;
  const optionsSheetRef = useSheetRef();

  // Turning previews on from here was for this song, so it plays once its
  // clip arrives rather than waiting for a second tap. A track the catalogue
  // has no clip for never gets one; stop waiting instead of playing it much
  // later, out of nowhere.
  const [playWhenReady, setPlayWhenReady] = useState(false);
  useEffect(() => {
    if (!playWhenReady) return;
    if (onPress) {
      setPlayWhenReady(false);
      onPress();
      return;
    }
    const timer = setTimeout(() => setPlayWhenReady(false), PREVIEW_WAIT_MS);
    return () => clearTimeout(timer);
  }, [playWhenReady, onPress]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else if (!samplesEnabled) {
      // Ask here, beside the song that was tapped, rather than sending
      // anyone to Settings to find the switch.
      promptSourceUse(PREVIEWS_USE, { onTurnOn: () => setPlayWhenReady(true) });
    }
  }, [onPress, samplesEnabled]);

  return (
    <>
      <MediaListRow
        title={song.title}
        subtitle={song.artist.name || albumArtist}
        cover={song.cover}
        onPress={handlePress}
        showCover={false}
        variant="compact"
        rowStyle={{ paddingVertical: density.trackRowPadding }}
        trailing={
          <View style={styles.rowRight}>
            {hasPreview && (
              <PlayCircle size={iconSize.inline} color={colors.subtext} />
            )}
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={t('a11y.common.moreOptions')}
              onPress={() => optionsSheetRef.current?.present()}
              hitSlop={hitSlopFor(18)}
            >
              <Ellipsis size={iconSize.row} color={colors.secondary} />
            </Touchable>
          </View>
        }
      />

      <SongOptions
        ref={optionsSheetRef}
        selectedSong={song}
        albumTitle={albumTitle}
        albumArtist={albumArtist}
        onPlay={previewUrl ? onPress : undefined}
      />
    </>
  );
};

const SongRow: React.FC<Props> = ({
  song: browsedSong,
  collection,
  onPress,
  variant = 'default',
  showDownloadedDot = false,
  isFavorite = false,
  albumTitle,
  albumArtist,
  previewUrl,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Local first: a browsed track the library already holds is *this* library's
  // track from here down — the full recording rather than a thirty-second
  // sample, with the library's own row, options and favourite state. See
  // features/library/localFirst for the one rule this asks.
  const { preferLocalSong } = useLocalFirst();
  const song = preferLocalSong(browsedSong);
  const { playSongInCollection } = usePlayingActions();
  const { openSongOptions } = useSongActionSheets();
  const { isTrackDownloaded } = useDownloadState();
  const density = useListDensity();
  const isAlbumCompact = variant === 'albumCompact';

  // Hooks must run unconditionally in the same order on every render, so the
  // library-only bits (download state, favorite animation) still run for an
  // external song — same as they were simply absent for it before the merge,
  // just now computed and discarded rather than never mounted.
  const downloaded = !isExternalSong(song) && isTrackDownloaded(song.localId);

  /**
   * The track's position on the record.
   *
   * Only on the album variant, which is the only place the running order is
   * the point — in a playlist or a search result the number would be the
   * song's position on some other record entirely, which is worse than no
   * number at all. Null when the server didn't tag one, rather than a
   * guessed index: a gap in the numbering is information, and a made-up "7"
   * beside a track the server calls untracked is not.
   */
  const trackNumber = isAlbumCompact && !isExternalSong(song) && typeof song.trackNumber === 'number' && song.trackNumber > 0
    ? song.trackNumber
    : null;

  const heartOpacity = useSharedValue(isFavorite ? 1 : 0);
  useEffect(() => {
    heartOpacity.value = withTiming(isFavorite ? 1 : 0, { duration: motion.favorite });
  }, [isFavorite, heartOpacity]);
  const heartStyle = useAnimatedStyle(() => ({ opacity: heartOpacity.value }));

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (collection && !isExternalSong(song)) {
      playSongInCollection(song, collection, false);
    }
  }, [onPress, collection, song, playSongInCollection]);

  const openOptions = useCallback(() => {
    if (!isExternalSong(song)) openSongOptions(song);
  }, [openSongOptions, song]);

  if (isExternalSong(song)) {
    return (
      <ExternalSongRowView
        song={song}
        albumTitle={albumTitle ?? ''}
        albumArtist={albumArtist ?? ''}
        previewUrl={previewUrl}
        onPress={onPress}
      />
    );
  }

  return (
    <>
      <MediaListRow
        title={song.title}
        testID="song-row"
        subtitle={`${song.artist.name || t('songOptions.unknownArtist')}${!isAlbumCompact ? ` • ${formatDuration(song.durationSeconds)}` : ''}`}
        cover={song.cover}
        onPress={handlePress}
        disabled={!onPress && !collection}
        showCover={!isAlbumCompact}
        variant="compact"
        rowStyle={isAlbumCompact ? { paddingVertical: density.trackRowPadding } : undefined}
        leading={trackNumber !== null ? (
          <Text
            style={[styles.trackNumber, { color: colors.subtext }]}
            numberOfLines={1}
            maxFontSizeMultiplier={fontScaleCap.glyph}
          >
            {trackNumber}
          </Text>
        ) : undefined}
        trailing={
          <View style={styles.rowRight}>
            <Animated.View style={heartStyle}>
              <Heart size={iconSize.inline} color={statusColor.favorite} fill={statusColor.favorite} />
            </Animated.View>
            {downloaded && (isAlbumCompact || showDownloadedDot) && (
              <ArrowDownCircle size={iconSize.inline} color={colors.subtext} />
            )}
            <Touchable
              onPress={openOptions}
              hitSlop={hitSlopFor(18)}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.rows.options', { title: song.title })}
            >
              <Ellipsis size={iconSize.row} color={colors.secondary} />
            </Touchable>
          </View>
        }
      />
    </>
  );
};

const styles = StyleSheet.create({
  trackNumber: {
    // Smaller and quieter than the artist line beside it. At subtitle size and
    // full subtext weight the numbers read as a column of their own competing
    // with the titles, which is the opposite of what an index is for — it
    // should be findable when looked for and invisible when not.
    ...typography.caption,
    opacity: stateLayer.pressedOpacity,
    // Fixed width and right-aligned so the titles form a straight edge whether
    // the record has nine tracks or nineteen. Tabular figures keep "11" the
    // same width as "17", which proportional digits do not.
    width: 20,
    marginRight: spacing.md,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.inlineGap,
  },
});

export default memo(SongRow);
