import React, { useCallback, useMemo } from 'react';
import { Text, View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';

import type { Song } from '@/domain/entities/Song';

import AlbumHeader, { AlbumHeaderBar } from '../Header';
import SongRow from '@/components/rows/SongRow';
import LoadingSongRow from '@/components/rows/SongRow/Loading';
import MediaTile from '@/features/home/components/MediaTile';
import { useTheme } from '@/features/theme/useTheme';
import { useStarredSongs } from '@/features/library/useStarredSongs';
import { useSelector } from 'react-redux';
import { selectAlbumPlayCount } from '@/state/redux/selectors/statsSelectors';
import { usePreviewPlayer } from '@/features/playback/usePreviewPlayer';
import AlbumRecommendedSection from '../AlbumRecommendedSection';
import SimilarAlbumsSection from '../SimilarAlbumsSection';
import type { AlbumScreenModel } from '@/features/album/useAlbumScreenModel';
import { playableSongs } from '@/features/album/trackPlayability';
import {
  ALBUM_ESTIMATED_ROW_HEIGHT,
  ALBUM_DISC_HEADER_HEIGHT,
} from '@/features/album/constants';
import { SHELF_GAP, SHELF_INSET, shelfItemWidth } from '@/features/layout/shelf';
import { formatDuration } from '@/components/formatDuration';
import { spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { DetailScreen } from '@/components/DetailHeader';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useContentInset } from '@/features/layout/useContentInset';

type Props = {
  model: AlbumScreenModel;
};

type DiscHeader = { type: 'disc-header'; disc: number };
type SongItem = { type: 'song'; song: Song };
type SkeletonItem = { type: 'skeleton'; id: string };
type ListItem = DiscHeader | SongItem | SkeletonItem;

/**
 * One album screen, one body. The old `LocalAlbumBody`/`ExternalAlbumBody`
 * split tracked a real distinction — full server playback vs. preview-only
 * — but that distinction is now typed per track (`playability`, from
 * `trackPlayability.ts`) rather than carried by which component rendered.
 * What's left genuinely different between the two modes is disc grouping
 * and the "more by artist" / recommendations footer, which only a library
 * album has enough data for — those stay as `isLocal` branches inside one
 * component instead of two components each re-implementing the shared list
 * chrome (header, stats, `SongRow`).
 */
const AlbumContent: React.FC<Props> = ({ model }) => {
  const scrollClearance = useScrollClearance();
  const { listInset, fullBleed } = useContentInset();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const navigation = useNavigation<any>();
  const { toggleInAlbum } = usePreviewPlayer();
  const { songs: starredSongs } = useStarredSongs();
  const albumPlayCount = useSelector(selectAlbumPlayCount(model.album?.nativeId ?? ''));
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = shelfItemWidth(screenWidth);
  const starredSongIds = useMemo(() => new Set(starredSongs.map(song => song.localId)), [starredSongs]);

  const { album, songs, songsLoading, playability, isLocal, moreAlbums } = model;

  const previewCollection = useMemo(() => playableSongs(songs, playability), [songs, playability]);

  const handlePreviewPress = useCallback((song: Song) => {
    if (!album) return;
    const p = playability.get(song.localId);
    if (!p || p.kind !== 'preview') return;
    toggleInAlbum(song, p.streamId, previewCollection, album.nativeId, album.title);
  }, [album, playability, previewCollection, toggleInAlbum]);

  /**
   * How long the record is, under the last track rather than above the
   * first — a sleeve prints the running time on the back, not the front.
   */
  const stats = useMemo(() => {
    if (songsLoading || songs.length === 0) return null;
    const totalSec = songs.reduce((acc, s) => acc + s.durationSeconds, 0);
    if (!isLocal) {
      const label = songs.length === 1 ? 'song' : 'songs';
      return (
        <View style={styles.statsFooter}>
          <Text style={[styles.statsText, { color: colors.subtext }]}>
            {songs.length} {label} · {formatDuration(totalSec)}
          </Text>
        </View>
      );
    }
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const duration = hrs > 0
      ? t('album.duration.hrMin', { hrs, mins })
      : t('album.duration.min', { mins });
    const songLabel = t(songs.length === 1 ? 'common.song' : 'common.songs');
    const playLabel = t(albumPlayCount === 1 ? 'album.play' : 'album.plays');
    return (
      <View style={styles.statsHeader}>
        <Text style={[styles.statsText, { color: colors.subtext }]}>
          {songs.length} {songLabel} · {duration}{albumPlayCount > 0 ? ` · ${albumPlayCount} ${playLabel}` : ''}
        </Text>
      </View>
    );
  }, [songs, songsLoading, isLocal, albumPlayCount, colors, t]);

  const footer = useMemo(() => {
    if (!isLocal || !album) return stats;
    return (
      <View>
        {stats}
        {moreAlbums.length > 0 && (
          <View style={styles.moreSection}>
            <Text style={[styles.moreSectionTitle, { color: colors.secondary }]}>
              {t('album.moreBy', { name: album.artist.name })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moreTileRow}
            >
              {moreAlbums.map(a => (
                <MediaTile
                  key={a.localId}
                  cover={a.cover}
                  title={a.title}
                  subtitle={String(a.year ?? '')}
                  size={tileWidth}
                  radius={rad.card}
                  onPress={() => navigation.push('albumView', { id: a.nativeId })}
                />
              ))}
            </ScrollView>
          </View>
        )}
        <SimilarAlbumsSection albumId={album.nativeId} />
        {album.artist.name && (
          <AlbumRecommendedSection
            artistName={album.artist.name}
            excludeAlbumId={album.nativeId}
          />
        )}
      </View>
    );
  }, [isLocal, album, colors, moreAlbums, stats, tileWidth, navigation, t, rad.card]);

  const items = useMemo<ListItem[]>(() => {
    if (songsLoading) {
      return Array.from({ length: 8 }, (_, i) => ({ type: 'skeleton' as const, id: `sk-${i}` }));
    }
    if (!isLocal) {
      return songs.map(song => ({ type: 'song' as const, song }));
    }

    const hasMultipleDiscs = new Set(songs.map(song => song.discNumber ?? 1)).size > 1;
    if (!hasMultipleDiscs) {
      return songs.map(song => ({ type: 'song', song }));
    }

    const listItems: ListItem[] = [];
    let currentDisc: number | null = null;
    songs.forEach(song => {
      const disc = song.discNumber ?? 1;
      if (disc !== currentDisc) {
        currentDisc = disc;
        listItems.push({ type: 'disc-header', disc });
      }
      listItems.push({ type: 'song', song });
    });
    return listItems;
  }, [songs, songsLoading, isLocal]);

  // Hoisted out of `renderItem`: a fresh object there is a guaranteed miss on
  // `SongRow`'s shallow memo, so every row re-rendered whenever the list did.
  const collection = useMemo(() => (album ? { album, songs } : undefined), [album, songs]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'skeleton') {
      return <LoadingSongRow />;
    }

    if (item.type === 'disc-header') {
      return (
        <Text style={[styles.discHeader, { color: colors.subtext }]}>
          {t('album.disc', { number: item.disc })}
        </Text>
      );
    }

    const song = item.song;
    const p = album ? playability.get(song.localId) : undefined;

    if (isLocal) {
      return (
        <SongRow
          song={song}
          collection={collection}
          variant="albumCompact"
          isFavorite={starredSongIds.has(song.localId)}
        />
      );
    }

    const previewUrl = p?.kind === 'preview' ? p.streamId : undefined;
    return (
      <SongRow
        song={song}
        albumTitle={album?.title}
        albumArtist={album?.artist.name}
        previewUrl={previewUrl}
        onPress={previewUrl ? () => handlePreviewPress(song) : undefined}
      />
    );
  }, [colors, starredSongIds, collection, album, t, isLocal, playability, handlePreviewPress]);

  return (
    <DetailScreen bar={<AlbumHeaderBar model={model} />}>
      {scroll => (
      <FlashList
        data={items}
        keyExtractor={(item) =>
          item.type === 'disc-header' ? `disc-${item.disc}` :
          item.type === 'skeleton' ? item.id :
          item.song.localId
        }
        renderItem={renderItem}
        extraData={[starredSongIds, playability]}
        getItemType={(item) => item.type}
        overrideItemLayout={(layout, item) => {
          (layout as { size?: number }).size =
            item.type === 'disc-header' ? ALBUM_DISC_HEADER_HEIGHT : ALBUM_ESTIMATED_ROW_HEIGHT;
        }}
        ListHeaderComponent={
          <View style={fullBleed}>
            <AlbumHeader model={model} showNavigation={false} />
          </View>
        }
        ListFooterComponent={<View style={fullBleed}>{footer}</View>}
        contentContainerStyle={{ paddingBottom: scrollClearance, ...listInset }}
        showsVerticalScrollIndicator={false}
        {...scroll}
      />
      )}
    </DetailScreen>
  );
};

const styles = StyleSheet.create({
  discHeader: {
    ...typography.caption,
    fontWeight: '600',
    height: ALBUM_DISC_HEADER_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  statsHeader: {
    paddingHorizontal: SHELF_INSET,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  statsFooter: {
    paddingHorizontal: SHELF_INSET,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statsText: {
    ...typography.caption,
  },
  moreSection: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  moreSectionTitle: {
    ...typography.sectionTitle,
    paddingHorizontal: SHELF_INSET,
    marginBottom: spacing.md,
  },
  moreTileRow: {
    paddingHorizontal: SHELF_INSET,
    gap: SHELF_GAP,
  },
});

export default AlbumContent;
