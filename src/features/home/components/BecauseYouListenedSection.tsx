import React, { useCallback, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { Text } from '@/components/Text'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { selectHomeShelfItemCount } from '@/features/settings/home/state';
import { useTheme } from '@/features/theme/useTheme'
import { useArtists } from '@/features/artist/useArtists';
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers'
import { prefetchCovers } from '@/features/artwork/imageCache'
import { useSourceUse } from '@/features/settings/sources/useSourceUse'
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation'
import {
  SECTION_H_PADDING as H_PADDING,
  SECTION_GRID_GAP,
  STALE_DEEZER_DISCOVERY,
  HOME_RELATED_ARTIST_LIMIT,
} from '@/features/home/constants'
import { getSectionItemWidth } from './sectionStyles'
import { CATALOGUE_HOME_USE, fetchAlbumsLikeArtist } from '@/providers/registry/homeDiscovery'
import { QueryKeys } from '@/state/query/queryKeys'
import { getDayKey } from '@/features/home/hooks/useDailyLayout'
import SelectionBottomSheet from '@/components/SelectionBottomSheet'
import OptionsTile from './OptionsTile'
import SkeletonTiles from '@/components/SkeletonTiles'
import type { Album } from '@/domain/entities/Album';
import Touchable from '@/components/Touchable';
import { hitSlopFor, iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  artistName: string
  refreshKey?: number
}

export default function BecauseYouListenedSection({ artistName, refreshKey = 0 }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const { artists: libraryArtists } = useArtists()
  const { navigateToAlbum } = useMatchedNavigation()
  const { width: screenWidth } = useWindowDimensions()
  const sheetRef = useRef<BottomSheetModal>(null)
  const dayKey = getDayKey()
  const itemCount = useSelector(selectHomeShelfItemCount)
  const isEnabled = useSourceUse(CATALOGUE_HOME_USE)

  const [selectedArtist, setSelectedArtist] = React.useState<string>(artistName)

  const gridItemWidth = useMemo(
    () => getSectionItemWidth(screenWidth),
    [screenWidth]
  )

  const artistNames = useMemo(
    () =>
      [...new Set(
        libraryArtists
          .filter(a => a.name.trim() && a.name.toLowerCase() !== 'various artists')
          .map(a => a.name)
      )].sort(),
    [libraryArtists]
  )

  const libraryArtistNames = useMemo(
    () => new Set(libraryArtists.map(a => a.name.toLowerCase())),
    [libraryArtists]
  )

  const handleSelect = useCallback((value: string) => {
    setSelectedArtist(value)
    sheetRef.current?.dismiss()
  }, [])

  const handleRandomize = useCallback(() => {
    const eligible = artistNames.filter(n => n !== selectedArtist)
    const pool = eligible.length > 0 ? eligible : artistNames
    const random = pool[Math.floor(Math.random() * pool.length)]
    if (random) setSelectedArtist(random)
    sheetRef.current?.dismiss()
  }, [artistNames, selectedArtist])

  const query = useQuery<Album[]>({
    // Include libraryArtists.length so the exclusion set (libraryArtistNames)
    // stays fresh: new library artists should stop appearing in suggestions
    // rather than waiting out the full 12h staleTime.
    queryKey: [QueryKeys.ExploreBecauseYouListened, dayKey, selectedArtist, libraryArtists.length, refreshKey, itemCount],
    queryFn: () => fetchAlbumsLikeArtist(selectedArtist, libraryArtistNames, { relatedLimit: HOME_RELATED_ARTIST_LIMIT, targetAlbums: itemCount }),
    enabled: isEnabled,
    staleTime: STALE_DEEZER_DISCOVERY,
    networkMode: 'online',
  })

  const albums = useMemo(() => query.data ?? [], [query.data])
  const coversToPrefetch = useMemo(() => albums.map(a => a.cover), [albums])
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

  const isEmpty = !query.isLoading && albums.length === 0

  return (
    <>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={[styles.titlePrefix, { color: colors.secondary }]}>
            {t('explore.sections.becauseYouListenedLabel')}
          </Text>
          <Touchable onPress={() => sheetRef.current?.present()} hitSlop={hitSlopFor(iconSize.control)}>
            <Text
              style={[styles.artistName, { color: colors.secondary, borderBottomColor: colors.secondary }]}
              numberOfLines={1}
            >
              {selectedArtist}
            </Text>
          </Touchable>
        </View>

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
        ) : isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No results — try a different artist
            </Text>
          </View>
        ) : (
          <FlashList
            horizontal
            data={albums}
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

      <SelectionBottomSheet
        ref={sheetRef}
        items={artistNames}
        onSelect={handleSelect}
        onRandomize={handleRandomize}
        placeholder={t('explore.sections.searchArtists')}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.tight,
    marginBottom: spacing.md,
    marginLeft: H_PADDING,
    marginRight: H_PADDING,
  },
  titlePrefix: {
    ...typography.sectionTitle,
  },
  artistName: {
    ...typography.sectionTitle,
    borderBottomWidth: 1.5,
    paddingBottom: spacing.xxs,
  },
  emptyState: {
    paddingHorizontal: H_PADDING,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.rowSubtitle,
  },
})
