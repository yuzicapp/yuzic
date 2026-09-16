import React, { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/features/theme/useTheme'
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers'
import { prefetchCovers } from '@/features/artwork/imageCache'
import { CATALOGUE_HOME_USE, fetchChartArtists } from '@/providers/registry/homeDiscovery'
import { QueryKeys } from '@/state/query/queryKeys'
import { getDayKey } from '@/features/home/hooks/useDailyLayout'
import { useSourceUse } from '@/features/settings/sources/useSourceUse'
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation'
import {
  SECTION_H_PADDING as H_PADDING,
  SECTION_GRID_GAP,
  SECTION_VISIBLE_ITEMS,
  STALE_DEEZER_CHARTS,
} from '@/features/home/constants'
import OptionsTile from './OptionsTile'
import SkeletonTiles from '@/components/SkeletonTiles'
import type { Artist } from '@/domain/entities/Artist'
import { spacing, typography } from '@/constants/design'

type Props = { refreshKey?: number }

export default function TopArtistsSection({ refreshKey = 0 }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { width: screenWidth } = useWindowDimensions()
  const dayKey = getDayKey()
  const isEnabled = useSourceUse(CATALOGUE_HOME_USE)
  const { navigateToArtist } = useMatchedNavigation()

  const gridItemWidth = useMemo(
    () => (screenWidth - H_PADDING * 2 - SECTION_GRID_GAP * 2) / SECTION_VISIBLE_ITEMS,
    [screenWidth]
  )

  const query = useQuery<Artist[]>({
    queryKey: [QueryKeys.ExploreTopArtists, dayKey, refreshKey],
    queryFn: () => fetchChartArtists(10),
    enabled: isEnabled,
    staleTime: STALE_DEEZER_CHARTS,
    networkMode: 'online',
  })

  const data = useMemo(() => query.data ?? [], [query.data])
  const coversToPrefetch = useMemo(() => data.map(a => a.cover), [data])
  usePrefetchCovers(coversToPrefetch, 'grid')

  const renderArtist = useCallback(({ item }: { item: Artist }) => (
    <OptionsTile
      entity={{ kind: 'artist', artist: item }}
      cover={item.cover}
      title={item.name}
      subtitle={t('common.artist')}
      size={gridItemWidth}
      radius={gridItemWidth / 2}
      onPress={() => {
        prefetchCovers([item.cover], 'detail')
        navigateToArtist(item)
      }}
    />
  ), [navigateToArtist, gridItemWidth, t])

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {t('explore.sections.topArtists')}
      </Text>
      {query.isLoading ? (
        <SkeletonTiles
          itemSize={gridItemWidth}
          gap={SECTION_GRID_GAP}
          horizontalPadding={H_PADDING}
          variant="artist"
        />
      ) : query.isError ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Unable to load — try again later
          </Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            No artists available
          </Text>
        </View>
      ) : (
        <FlashList
          horizontal
          data={data}
          keyExtractor={item => item.localId}
          overrideItemLayout={layout => { (layout as { size?: number }).size = gridItemWidth }}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: H_PADDING }}
          ItemSeparatorComponent={() => <View style={{ width: SECTION_GRID_GAP }} />}
          renderItem={renderArtist}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
    marginLeft: H_PADDING,
  },
  emptyState: {
    paddingHorizontal: H_PADDING,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.rowSubtitle,
  },
})
