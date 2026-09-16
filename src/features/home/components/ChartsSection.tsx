import React, { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/features/theme/useTheme'
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers'
import { prefetchCovers } from '@/features/artwork/imageCache'
import { CATALOGUE_HOME_USE, fetchChartAlbums } from '@/providers/registry/homeDiscovery'
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
import type { Album } from '@/domain/entities/Album'
import { spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'

type Props = { refreshKey?: number }

export default function ChartsSection({ refreshKey = 0 }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const { width: screenWidth } = useWindowDimensions()
  const dayKey = getDayKey()
  const isEnabled = useSourceUse(CATALOGUE_HOME_USE)
  const { navigateToAlbum } = useMatchedNavigation()

  const gridItemWidth = useMemo(
    () => (screenWidth - H_PADDING * 2 - SECTION_GRID_GAP * 2) / SECTION_VISIBLE_ITEMS,
    [screenWidth]
  )

  const query = useQuery<Album[]>({
    queryKey: [QueryKeys.ExploreCharts, dayKey, refreshKey],
    queryFn: () => fetchChartAlbums(10),
    enabled: isEnabled,
    staleTime: STALE_DEEZER_CHARTS,
    networkMode: 'online',
  })

  const data = useMemo(() => query.data ?? [], [query.data])
  const coversToPrefetch = useMemo(() => data.map(a => a.cover), [data])
  usePrefetchCovers(coversToPrefetch, 'grid')

  const renderAlbum = useCallback(({ item }: { item: Album }) => (
    <OptionsTile
      entity={{ kind: 'album', album: item }}
      cover={item.cover}
      title={item.title}
      subtitle={item.artist.name}
      size={gridItemWidth}
      radius={rad.card}
      onPress={() => {
        prefetchCovers([item.cover], 'detail')
        navigateToAlbum(item)
      }}
    />
  ), [navigateToAlbum, gridItemWidth, rad.card])

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {t('explore.sections.charts')}
      </Text>
      {query.isLoading ? (
        <SkeletonTiles
          itemSize={gridItemWidth}
          gap={SECTION_GRID_GAP}
          horizontalPadding={H_PADDING}
          variant="album"
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
            No charts available
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
          renderItem={renderAlbum}
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
