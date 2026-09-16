import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import type { Song } from '@/domain/entities/Song';
import type { LocalId } from '@/domain/identity/LocalId';
import { resourceFromBookmarkSnapshot } from '@/features/playback/bookmarkSnapshot';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { useTracks } from '@/features/song/useTracks';
import { selectPersistedPlaybackBookmarks } from '@/state/redux/selectors/playbackSelectors';
import {
  SECTION_H_PADDING as H_PADDING,
  SECTION_GRID_GAP,
  SECTION_VISIBLE_ITEMS,
} from '@/features/home/constants';
import OptionsTile from './OptionsTile';
import { spacing, typography } from '@/constants/design';

type Entry = { song: Song; positionMs: number };

/**
 * Home shelf that surfaces long-form tracks with a saved resume position —
 * the local bookmark map now feeds every provider (Navidrome via server
 * bookmarks, Jellyfin/Emby via PlaybackPositionTicks), so this row is a
 * genuine "pick back up" surface regardless of what backs the app.
 *
 * Ordered by most-recently-paused; tapping a tile plays the track (auto-
 * resume is already wired into PlayingContext, so it lands at the saved
 * position without this component having to seek explicitly).
 */
const MAX_ENTRIES = 8;

export default function ContinuePlayingSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const { width: screenWidth } = useWindowDimensions();
  const { playSong } = usePlayingActions();
  const { tracks } = useTracks();
  const bookmarks = useSelector(selectPersistedPlaybackBookmarks);

  const itemSize = useMemo(
    () => (screenWidth - H_PADDING * 2 - SECTION_GRID_GAP * 2) / SECTION_VISIBLE_ITEMS,
    [screenWidth]
  );

  // Bookmarks map is keyed by `song.localId` (see useBookmarkManager) and
  // ordered by most-recent updatedAt.
  //
  // Two sources, because there are two kinds of entry. A library track is
  // joined against the synced library, which stays authoritative for
  // re-tagging and artwork — and a bookmark for a track no longer there is
  // dropped, since a row with no title is worse than a shorter shelf.
  //
  // A podcast episode is never in that library: its `localId` cannot collide
  // with a real track's, so the join can never match and every podcast
  // bookmark falls through to the snapshot branch. Those carry a snapshot
  // written beside the position, which is what draws them here —
  // `resourceFromBookmarkSnapshot` rebuilds the domain Song from it (the
  // stream URL is irrelevant here since `playSong` resolves a fresh one
  // itself, so this passes an empty placeholder).
  const entries = useMemo<Entry[]>(() => {
    const byId = new Map(tracks.map((track) => [track.localId, track]));
    return Object.entries(bookmarks)
      .map(([songId, entry]) => {
        const song = byId.get(songId as LocalId);
        if (song) return { song, positionMs: entry.positionMs, updatedAt: entry.updatedAt };
        if (!entry.snapshot) return null;
        const resource = resourceFromBookmarkSnapshot(songId as LocalId, entry.snapshot, '');
        if (!resource) return null;
        return { song: resource.song, positionMs: entry.positionMs, updatedAt: entry.updatedAt };
      })
      .filter((e): e is Entry & { updatedAt: number } => e !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ENTRIES);
  }, [bookmarks, tracks]);

  const handlePress = useCallback((entry: Entry) => {
    // Player auto-resumes to the saved position when it loads (see
    // useBookmarkManager wiring in PlayingContext) and resolves a fresh
    // stream URL from the song's own provenance/streamId internally — no
    // credentialled URL needs building here.
    void playSong(entry.song);
  }, [playSong]);

  const renderEntry = useCallback(({ item }: { item: Entry }) => (
    <OptionsTile
      entity={{ kind: 'song', song: item.song }}
      cover={item.song.cover}
      title={item.song.title}
      subtitle={item.song.artist.name}
      size={itemSize}
      radius={rad.card}
      onPress={() => handlePress(item)}
    />
  ), [handlePress, itemSize, rad.card]);

  if (entries.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {t('explore.sections.continuePlaying')}
      </Text>
      <FlashList
        horizontal
        data={entries}
        keyExtractor={(e) => e.song.localId}
        overrideItemLayout={(layout) => { (layout as { size?: number }).size = itemSize; }}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: H_PADDING }}
        ItemSeparatorComponent={() => <View style={{ width: SECTION_GRID_GAP }} />}
        renderItem={renderEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.sectionTitle, marginBottom: spacing.md, marginLeft: H_PADDING },
});
