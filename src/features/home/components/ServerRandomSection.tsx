import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useApi } from '@/providers/registry/useApi';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { QueryKeys } from '@/state/query/queryKeys';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { getDayKey, getDailySeed, seededShuffle } from '@/features/home/hooks/useDailyLayout';
import { presentableGenres } from '@/features/home/genres';
import { onePerAlbum } from '@/features/home/randomDraw';
import { useGenres } from '@/features/genre/useGenres';
import {
  SECTION_H_PADDING as H_PADDING,
  SECTION_GRID_GAP,
  SECTION_VISIBLE_ITEMS,
} from '@/features/home/constants';
import OptionsTile from './OptionsTile';
import SkeletonTiles from '@/components/SkeletonTiles';
import { useSourceSectionPresence } from './SourceGroup';
import type { Song } from '@/domain/entities/Song';
import { spacing, typography } from '@/constants/design';

type Props = {
  /** This shelf's key in the home layout, so the source group above it knows
   * which of its sections has just gone quiet. */
  sectionKey: string;
  refreshKey?: number;
};

/**
 * How many the shelf shows once one-per-album has thinned the draw, and how
 * many to ask for so that thinning still leaves enough. A themed draw over a
 * narrow genre often comes back as one album's tracklist, so the request has
 * to be several times the target to survive it.
 */
const TARGET_ITEMS = 12;
const REQUEST_SIZE = 40;
/** Below this the shelf isn't a draw, it's a leftover — better to show nothing. */
const MIN_ITEMS = 4;

/** The rail, plus whether the genre theme survived to describe it. */
type Draw = { songs: Song[]; themed: boolean };

/**
 * Server-random draw shelf — cheap discovery that changes on every daily
 * seed. Only useful for library-heavy users where "surprise me" beats
 * looking through their own shelves.
 */
export default function ServerRandomSection({ sectionKey, refreshKey = 0 }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const api = useApi();
  // The shelf is server-backed, so it needs the server to be reachable, not
  // merely supported. Offline (or with the server unreachable) it hides
  // instead of holding a skeleton over a request that cannot land.
  const serverReachable = useServerReachable();
  const discoveryAvailable = Boolean(api.discovery) && serverReachable;
  const { playSongs } = usePlayingActions();
  const { width: screenWidth } = useWindowDimensions();
  const { genres } = useGenres();
  const dayKey = getDayKey();

  // Genre-of-the-day rotation: pick one library genre from the daily
  // shuffled order and use it as the seed for the random draw. Turns a
  // pure-dice shelf into a themed one that reads differently each day
  // ("today's Ambient", "today's Post-punk") without any user config.
  // Placeholder tags are filtered out first — the untagged bucket is the
  // biggest genre in most libraries, and "Today's Unknown" is not a theme.
  const themeGenre = useMemo(() => {
    const usable = presentableGenres(genres ?? []);
    if (usable.length === 0) return null;
    const seed = getDailySeed(`${dayKey}:${refreshKey}`);
    return seededShuffle(usable, seed)[0] ?? null;
  }, [dayKey, refreshKey, genres]);

  const gridItemWidth = useMemo(
    () => (screenWidth - H_PADDING * 2 - SECTION_GRID_GAP * 2) / SECTION_VISIBLE_ITEMS,
    [screenWidth]
  );

  const query = useQuery<Draw>({
    queryKey: [QueryKeys.ServerRandom, dayKey, refreshKey, themeGenre ?? ''],
    queryFn: async () => {
      const draw = async (genre?: string) => {
        const songs = (await api.discovery?.getRandomSongs({
          size: REQUEST_SIZE,
          ...(genre ? { genre } : {}),
        })) ?? [];
        return onePerAlbum(songs).slice(0, TARGET_ITEMS);
      };

      if (themeGenre) {
        const themed = await draw(themeGenre);
        if (themed.length >= MIN_ITEMS) return { songs: themed, themed: true };
      }
      // A narrow genre can hold two albums, and one per album then leaves a
      // rail too thin to be a draw. Falling back to the whole library keeps
      // the shelf — an untinted "Surprise me" beats no shelf at all, and the
      // heading drops the genre so it still describes what is under it.
      return { songs: await draw(), themed: false };
    },
    enabled: discoveryAvailable,
    staleTime: 1000 * 60 * 60 * 4,
  });

  const data = useMemo(() => query.data?.songs ?? [], [query.data]);
  const isLoading = discoveryAvailable && query.isLoading;
  const hasEnough = data.length >= MIN_ITEMS;
  const isThemed = Boolean(themeGenre) && (query.data?.themed ?? false);

  useSourceSectionPresence(sectionKey, discoveryAvailable && (isLoading || hasEnough));

  const handlePlay = useCallback((index: number) => {
    if (data.length === 0) return;
    void playSongs(data, { startIndex: index });
  }, [data, playSongs]);

  const renderSong = useCallback(({ item, index }: { item: Song; index: number }) => (
    <OptionsTile
      entity={{ kind: 'song', song: item }}
      cover={item.cover}
      title={item.title}
      subtitle={item.artist.name}
      size={gridItemWidth}
      radius={rad.card}
      onPress={() => handlePlay(index)}
    />
  ), [gridItemWidth, handlePlay, rad.card]);

  if (!api.discovery) return null;
  // A themed heading with an empty rail under it is worse than no shelf: the
  // heading promises today's draw and then there isn't one.
  if (!isLoading && !hasEnough) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {isThemed
          ? t('explore.sections.serverRandomThemed', { genre: themeGenre })
          : t('explore.sections.serverRandom')}
      </Text>
      {isLoading ? (
        <SkeletonTiles
          itemSize={gridItemWidth}
          gap={SECTION_GRID_GAP}
          horizontalPadding={H_PADDING}
          variant="album"
        />
      ) : (
        <FlashList
          horizontal
          data={data}
          keyExtractor={(item) => item.localId}
          overrideItemLayout={(layout) => { (layout as { size?: number }).size = gridItemWidth; }}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: H_PADDING }}
          ItemSeparatorComponent={() => <View style={{ width: SECTION_GRID_GAP }} />}
          renderItem={renderSong}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.sectionTitle, marginBottom: spacing.md, marginLeft: H_PADDING },
});
