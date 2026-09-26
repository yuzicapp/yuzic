import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import ReorderableList, {
  type ReorderableListReorderEvent,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { GripVertical, MinusCircle } from 'lucide-react-native';

import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { PlaylistChangedError } from '@/providers/contracts/ServerAdapter';
import { movedOrder } from '@/providers/server/playlistEntries';
import MediaListRow from '@/components/MediaListRow';
import Touchable from '@/components/Touchable';
import SectionEmptyState from '@/features/home/components/SectionEmptyState';
import { DetailHeaderBar } from '@/components/DetailHeader';
import { notify } from '@/components/toast';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useIsOffline } from '@/features/connectivity/useIsOffline';
import { QueryKeys } from '@/state/query/queryKeys';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { hitSlopFor, spacing, statusColor, typography } from '@/constants/design';
import { useRemoveSongFromPlaylist } from '../../useRemoveSongFromPlaylist';
import { useMoveSongInPlaylist } from '../../useMoveSongInPlaylist';

type Props = {
  playlist: Playlist;
  songs: Song[];
  onDone: () => void;
};

/** A song at its place in the playlist; `key` survives the song being in twice. */
type Entry = { key: string; song: Song };

function toEntries(songs: Song[]): Entry[] {
  const seen = new Map<string, number>();
  return songs.map(song => {
    const nth = seen.get(song.localId) ?? 0;
    seen.set(song.localId, nth + 1);
    return { key: `${song.localId}#${nth}`, song };
  });
}

type RowProps = {
  item: Entry;
  index: number;
  isOffline: boolean;
  onRemove: (entry: Entry, position: number) => void;
};

/**
 * One row. Its own component because `useReorderableDrag` and `useIsActive`
 * read the list's context, which only exists inside what `renderItem` renders.
 */
function EditRow({ item, index, isOffline, onRemove }: RowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <View
      testID="playlist-edit-row"
      style={[styles.row, isActive && { backgroundColor: colors.card }]}
    >
      <Touchable
        testID="playlist-edit-remove"
        accessibilityRole="button"
        accessibilityLabel={t('a11y.playlist.removeSong', { title: item.song.title })}
        hitSlop={hitSlopFor(icons.row)}
        onPress={() => onRemove(item, index)}
        style={styles.remove}
      >
        <MinusCircle size={icons.row} color={statusColor.destructive} />
      </Touchable>
      <MediaListRow
        title={item.song.title}
        subtitle={item.song.artist.name}
        cover={item.song.cover}
        style={styles.song}
      />
      {!isOffline && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.playlist.reorderSong', { title: item.song.title })}
          hitSlop={hitSlopFor(icons.row)}
          onPressIn={drag}
          disabled={isActive}
          style={styles.grip}
        >
          <GripVertical size={icons.row} color={colors.subtext} />
        </Touchable>
      )}
    </View>
  );
}

/**
 * The playlist's songs, to remove and drag into a new order.
 *
 * The list keeps its own order while edits are on their way to the server, so
 * a dropped row stays where it was dropped and a removed row goes at once.
 * Whatever the server refuses puts the list back to the playlist as last
 * loaded, and the playlist is reloaded. Reordering needs a connection;
 * removing does not, since a removal queues like every other offline edit.
 */
export default function PlaylistEditList({ playlist, songs, onDone }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollClearance = useScrollClearance();
  const isOffline = useIsOffline();
  const queryClient = useQueryClient();
  const activeServer = useSelector(selectActiveServer);
  const removeSong = useRemoveSongFromPlaylist();
  const moveSong = useMoveSongInPlaylist();

  const [entries, setEntries] = useState(() => toEntries(songs));
  const loadedSongs = useRef(songs);
  useEffect(() => {
    loadedSongs.current = songs;
    setEntries(toEntries(songs));
  }, [songs]);

  // Back ends editing rather than leaving the playlist.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => subscription.remove();
  }, [onDone]);

  const reportFailure = useCallback((error: unknown, failedKey: string) => {
    if (error instanceof PlaylistChangedError) notify.error(t('playlist.edit.changed'));
    else if (error instanceof Error && error.message === 'offline') notify.error(t('playlist.edit.offlineReorder'));
    else notify.error(t(failedKey));
    setEntries(toEntries(loadedSongs.current));
    void queryClient.invalidateQueries({ queryKey: [QueryKeys.Playlist, activeServer?.id, playlist.nativeId] });
  }, [t, queryClient, activeServer?.id, playlist.nativeId]);

  const handleRemove = useCallback((entry: Entry, position: number) => {
    setEntries(current => current.filter(item => item.key !== entry.key));
    removeSong.mutate(
      { playlistId: playlist.nativeId, songId: entry.song.nativeId, position },
      { onError: error => reportFailure(error, 'playlist.edit.removeFailed') }
    );
  }, [removeSong, playlist.nativeId, reportFailure]);

  const handleReorder = useCallback(({ from, to }: ReorderableListReorderEvent) => {
    if (from === to) return;
    const moved = entries[from];
    if (!moved) return;
    setEntries(current => movedOrder(current, from, to));
    moveSong.mutate(
      { playlistId: playlist.nativeId, songId: moved.song.nativeId, from, to },
      { onError: error => reportFailure(error, 'playlist.edit.moveFailed') }
    );
  }, [entries, moveSong, playlist.nativeId, reportFailure]);

  const renderItem = useCallback(({ item, index }: { item: Entry; index: number }) => (
    <EditRow item={item} index={index} isOffline={isOffline} onRemove={handleRemove} />
  ), [handleRemove, isOffline]);

  const doneButton = useMemo(() => (
    <Touchable
      testID="playlist-edit-done"
      accessibilityRole="button"
      onPress={onDone}
      hitSlop={hitSlopFor(32)}
      style={styles.done}
    >
      <Text style={[styles.doneText, { color: colors.themeColor }]}>{t('common.done')}</Text>
    </Touchable>
  ), [onDone, colors.themeColor, t]);

  return (
    <View testID="playlist-edit" style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <DetailHeaderBar
        title={playlist.title}
        subtitle={isOffline ? t('playlist.edit.offlineReorder') : t('playlist.edit.title')}
        rightAction={doneButton}
      />
      <ReorderableList
        data={entries}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        onReorder={handleReorder}
        // Offline, a reorder cannot reach the server, so dragging is off
        // outright rather than started and then refused.
        dragEnabled={!isOffline}
        // `useIsActive` in the row only re-renders when this is set.
        shouldUpdateActiveItem
        ListEmptyComponent={<SectionEmptyState message={t('playlist.empty')} />}
        contentContainerStyle={{ paddingBottom: scrollClearance }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
  },
  remove: {
    paddingRight: spacing.sm,
  },
  song: {
    flex: 1,
  },
  grip: {
    paddingHorizontal: spacing.lg,
  },
  done: {
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  doneText: {
    ...typography.button,
  },
});
