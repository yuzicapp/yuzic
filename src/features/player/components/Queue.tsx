import React, { useState, useCallback, memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';
import { GripVertical, ChevronLeft, Pause, Play, SkipForward } from 'lucide-react-native';
import { usePlayingState, usePlayingActions, usePlayingQueueVersion } from '@/features/playback/PlayingContext';
import { MediaImage } from '@/components/MediaImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlbumsById } from '@/features/album/useAlbumsById';
import type { Song } from '@/domain/entities/Song';
import Touchable from '@/components/Touchable';
import { iconSize, onDark, spacing, typography, veil } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useListDensity } from '@/features/theme/useListDensity';

type QueueItemProps = {
  item: Song;
  index: number;
  isCurrent: boolean;
  onPress: (index: number) => void;
};

function queueItemPropsAreEqual(prev: QueueItemProps, next: QueueItemProps) {
  return (
    prev.item.localId === next.item.localId &&
    prev.item.title === next.item.title &&
    prev.item.artist.name === next.item.artist.name &&
    prev.index === next.index &&
    prev.isCurrent === next.isCurrent &&
    prev.onPress === next.onPress
  );
}

const QueueItem = memo(
  ({ item, index, isCurrent, onPress }: QueueItemProps) => {
    const rad = useRadius();
    const density = useListDensity();
    // The drag handle comes from the list rather than being threaded down as a
    // prop, so it stays out of the memo comparison above.
    const drag = useReorderableDrag();
    return (
    <Touchable
      onPress={() => onPress(index)}
      onLongPress={drag}
      style={[
        styles.queueItem,
        { borderRadius: rad.md, paddingVertical: density.trackRowPadding },
        isCurrent && styles.activeQueueItem,
      ]}
    >
      <MediaImage
        cover={item.cover}
        size="thumb"
        style={[styles.artwork, { borderRadius: rad.md }]}
      />

      <View style={styles.metadata}>
        <Text
          style={[styles.title, isCurrent && styles.titleActive]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist.name}
        </Text>
      </View>

      <GripVertical color={onDark.mutedText} />
    </Touchable>
    );
  },
  queueItemPropsAreEqual
);

QueueItem.displayName = 'QueueItem';

const Queue: React.FC<{ onBack: () => void; width: number }> = ({
  onBack,
  width,
}) => {
  const { t } = useTranslation();
  const rad = useRadius();
  const { currentSong, isPlaying } = usePlayingState();
  const { getQueue, skipTo, moveTrack, pauseSong, resumeSong, skipToNext } = usePlayingActions();
  const queueVersion = usePlayingQueueVersion();

  const albumsById = useAlbumsById();
  const insets = useSafeAreaInsets();

  const [queue, setQueue] = useState<Song[]>([]);

  useEffect(() => {
    setQueue(getQueue());
  }, [getQueue, queueVersion]);

  const currentAlbum = currentSong?.album.nativeId ? albumsById.get(currentSong.album.nativeId) : undefined;

  const handleSongClick = useCallback(
    (index: number) => {
      skipTo(index);
    },
    [skipTo]
  );

  const handleReorder = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      setQueue(current => reorderItems(current, from, to));
      moveTrack(from, to);
    },
    [moveTrack]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <QueueItem
        item={item}
        index={index}
        isCurrent={item.localId === currentSong?.localId}
        onPress={handleSongClick}
      />
    ),
    [currentSong?.localId, handleSongClick]
  );

  return (
    <View testID="playing-queue" style={[styles.container, { width }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Touchable
          testID="queue-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('a11y.queueBackToPlayer')}
          onPress={onBack}
          style={styles.backButton}
        >
          <ChevronLeft size={iconSize.large} color={onDark.text} />
        </Touchable>

        {currentSong && (
          <MediaImage
            cover={currentSong.cover}
            size="thumb"
            style={[styles.headerImage, { borderRadius: rad.md }]}
          />
        )}

        <View style={styles.headerTextContainer}>
          <Text
            style={styles.nowPlayingTitle}
            numberOfLines={1}
          >
            {currentSong?.title}
          </Text>
          <Text
            style={styles.nowPlayingArtist}
            numberOfLines={1}
          >
            {currentSong?.artist.name}
          </Text>
        </View>

        <View style={styles.playControls}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t('a11y.player.pause') : t('a11y.player.play')}
            onPress={isPlaying ? pauseSong : resumeSong}
            style={[styles.controlButton, { borderRadius: rad.md }]}
          >
            {isPlaying
              ? <Pause size={iconSize.control} color={onDark.text} fill={onDark.text} />
              : <Play size={iconSize.control} color={onDark.text} fill={onDark.text} />
            }
          </Touchable>

          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.player.next')}
            onPress={skipToNext}
            style={[styles.controlButton, { borderRadius: rad.md }]}
          >
            <SkipForward size={iconSize.control} color={onDark.text} fill={onDark.text} />
          </Touchable>
        </View>
      </View>

      <Text style={styles.sectionLabel}>{t('playing.queue.title')}</Text>
      <Text style={styles.subLabel}>
        {currentAlbum
          ? t('playing.queue.playingFromAlbum', { album: currentAlbum.title })
          : t('playing.queue.playingFromQueue')}
      </Text>

      {/* List */}
      <ReorderableList
        data={queue}
        keyExtractor={item => item.localId}
        onReorder={handleReorder}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 160,
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
    marginLeft: -8,
  },

  playControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },

  controlButton: {
    padding: spacing.tight,
    marginLeft: spacing.tight,
    backgroundColor: veil.rowSelected,
  },

  headerImage: {
    width: 60,
    height: 60,
    marginRight: spacing.md,
  },

  headerTextContainer: {
    flex: 1,
  },

  nowPlayingTitle: {
    ...typography.navigationTitle,
    fontWeight: '500',
    color: onDark.text,
  },

  nowPlayingArtist: {
    ...typography.rowSubtitle,
    color: onDark.subtext,
  },

  sectionLabel: {
    ...typography.rowTitle,
    color: onDark.text,
    marginBottom: spacing.xxs,
  },

  subLabel: {
    ...typography.caption,
    color: onDark.mutedText,
    marginBottom: spacing.md,
  },

  // Vertical padding comes from the density setting at render, not from here:
  // the queue is a whole record's worth of track rows and was the one primary
  // list in the app that held still when the setting changed.
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },

  activeQueueItem: {
    backgroundColor: veil.row,
  },

  artwork: {
    width: 50,
    height: 50,
    marginRight: spacing.md,
  },

  metadata: {
    flex: 1,
  },

  title: {
    ...typography.body,
    color: onDark.text,
  },

  titleActive: {
    fontWeight: '500',
  },

  artist: {
    ...typography.rowSubtitle,
    color: onDark.subtext,
  },
});

export default Queue;
