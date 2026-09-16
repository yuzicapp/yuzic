import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { selectAlbumLastPlayedAt, selectPlaylistLastPlayedAt } from '@/state/redux/selectors/statsSelectors';
import { useAlbums } from '@/features/album/useAlbums';
import { usePlaylists } from '@/features/playlist/usePlaylists';
import MediaTile from '../MediaTile';
import SectionShelfHeader from '../SectionShelfHeader';
import { SECTION_H_PADDING } from '../sectionStyles';
import { useTranslation } from 'react-i18next';
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers';
import type { Album } from '@/domain/entities/Album';
import type { Playlist } from '@/domain/entities/Playlist';
import AlbumOptions from '@/components/options/AlbumOptions';
import PlaylistOptions from '@/components/options/PlaylistOptions';
import { useSheetRef } from '@/components/useSheetRef';
import { spacing } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useStableList } from '@/features/home/hooks/useStableList';

// The shelf's own inset has to be the shared one: its heading comes from
// SectionShelfHeader, which is inset with every other shelf on the screen.
const H_PADDING = SECTION_H_PADDING;
const GAP = 10;
const VISIBLE_ITEMS = 3.2;
const MAX_ITEMS = 12;
const MIN_ITEMS = 1;

const getItemWidth = (width: number) => {
  const availableWidth = width - H_PADDING * 2;
  return (availableWidth - GAP * (VISIBLE_ITEMS - 1)) / VISIBLE_ITEMS;
};

type RecentItem =
  | { kind: 'album'; data: Album; ts: number }
  | { kind: 'playlist'; data: Playlist; ts: number };

type TileProps = {
  item: RecentItem;
  itemWidth: number;
};

/**
 * The same tile, for as long as it shows the same album or playlist.
 *
 * `ts` is not drawn, and it moves at the end of every song: the scrobble
 * stamps the album just played. Compared by default, every tile on the shelf
 * re-rendered at every track change for a number nobody sees.
 */
const sameTile = (prev: TileProps, next: TileProps) =>
  prev.itemWidth === next.itemWidth && sameRecentItem(prev.item, next.item);

const sameRecentItem = (a: RecentItem, b: RecentItem) => a.kind === b.kind && a.data === b.data;

const RecentTile = memo(function RecentTile({ item, itemWidth }: TileProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const sheetRef = useSheetRef();
  const [optionsMounted, setOptionsMounted] = useState(false);
  const rad = useRadius();

  const handlePress = useCallback(() => {
    // Server adapter identity — the album or playlist screen resolves it by id.
    if (item.kind === 'album') {
      navigation.navigate('albumView', { id: item.data.nativeId });
    } else {
      navigation.navigate('playlistView', { id: item.data.nativeId });
    }
  }, [item, navigation]);

  const handleLongPress = useCallback(() => {
    if (!optionsMounted) {
      setOptionsMounted(true);
      requestAnimationFrame(() => sheetRef.current?.present());
    } else {
      sheetRef.current?.present();
    }
  }, [optionsMounted, sheetRef]);

  // A shelf that mixes albums and playlists needs the type prefix on every
  // row — it's the only thing telling the two apart (see LibraryList's
  // `showTypeLabel`).
  const subtitle = item.kind === 'album'
    ? t('library.albumTypeLabel', { artist: item.data.artist.name })
    : t('playlist.subtext', { count: item.data.songIds.length });

  return (
    <>
      <View style={[styles.item, { width: itemWidth }]}>
        <MediaTile
          cover={item.data.cover}
          title={item.data.title}
          subtitle={subtitle}
          size={itemWidth}
          radius={rad.card}
          onPress={handlePress}
          onLongPress={handleLongPress}
        />
      </View>
      {optionsMounted && (item.kind === 'album' ? (
        <AlbumOptions ref={sheetRef} album={item.data} hideGoToAlbum={false} />
      ) : (
        <PlaylistOptions ref={sheetRef} playlist={item.data} />
      ))}
    </>
  );
}, sameTile);

export default function RecentlyPlayed() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const itemWidth = getItemWidth(width);

  const albumLastPlayedAt = useSelector(selectAlbumLastPlayedAt);
  const playlistLastPlayedAt = useSelector(selectPlaylistLastPlayedAt);
  const { albums } = useAlbums();
  const { playlists } = usePlaylists();

  // Stable while the same albums and playlists are listed in the same order;
  // see `useStableList`.
  const items = useStableList(useMemo<RecentItem[]>(() => {
    // `selectAlbumLastPlayedAt`/`selectPlaylistLastPlayedAt` key by the
    // origin's own id (see `useScrobbling`'s `incrementPlay` dispatch), so
    // these maps look albums/playlists up by `nativeId`, not `localId`.
    const albumMap = new Map(albums.map(a => [a.nativeId, a]));
    const playlistMap = new Map(playlists.map(p => [p.nativeId, p]));
    const result: RecentItem[] = [];

    for (const [id, ts] of Object.entries(albumLastPlayedAt)) {
      if (ts <= 0) continue;
      const album = albumMap.get(id);
      if (album) result.push({ kind: 'album', data: album, ts });
    }

    for (const [id, ts] of Object.entries(playlistLastPlayedAt)) {
      if (ts <= 0) continue;
      const playlist = playlistMap.get(id);
      if (playlist) result.push({ kind: 'playlist', data: playlist, ts });
    }

    return result.sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
  }, [albumLastPlayedAt, playlistLastPlayedAt, albums, playlists]), sameRecentItem);

  const coversToPrefetch = useMemo(() => items.map(i => i.data.cover), [items]);
  usePrefetchCovers(coversToPrefetch, 'grid');

  // The shelf stops at twelve. "Most recently played first" is a sort order
  // the library list already has, so the heading leads there rather than to a
  // screen built for this one shelf — the whole library in that order, not
  // just the dozen that fit. The list keeps its own name; the sort control is
  // what says how it is ordered.
  const openAll = useCallback(
    () => navigation.push('libraryCollectionView', {
      sort: 'recent',
    }),
    [navigation]
  );

  // Hide the section entirely until there's play history to surface.
  if (items.length < MIN_ITEMS) return null;

  return (
    <View style={styles.container}>
      <SectionShelfHeader
        testID="home-recently-played-see-all"
        title={t('explore.sections.recentlyPlayed')}
        seeAllLabel={t('library.seeAll')}
        onSeeAll={openAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {items.map(item => (
          <RecentTile key={`${item.kind}-${item.data.localId}`} item={item} itemWidth={itemWidth} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    gap: GAP,
  },
  item: {
    minWidth: 0,
  },
});
