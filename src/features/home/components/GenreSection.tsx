import React, { useCallback, useMemo, useRef } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { Text } from '@/components/Text'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { selectHomeShelfItemCount } from '@/features/settings/home/state';
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useTheme } from '@/features/theme/useTheme'
import { useAlbums } from '@/features/album/useAlbums';
import { useArtists } from '@/features/artist/useArtists';
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers'
import { prefetchCovers } from '@/features/artwork/imageCache'
import { useSourceUse } from '@/features/settings/sources/useSourceUse'
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation'
import { useGenres } from '@/features/genre/useGenres'
import {
  SECTION_H_PADDING as H_PADDING,
  SECTION_GRID_GAP,
  STALE_DEEZER_DISCOVERY,
  HOME_SEED_ARTISTS,
} from '@/features/home/constants'
import { getSectionItemWidth } from './sectionStyles'
import { CATALOGUE_HOME_USE, fetchAlbumsForGenre } from '@/providers/registry/homeDiscovery'
import { QueryKeys } from '@/state/query/queryKeys'
import { getDayKey } from '@/features/home/hooks/useDailyLayout'
import SelectionBottomSheet from '@/components/SelectionBottomSheet'
import OptionsTile from './OptionsTile'
import SkeletonTiles from '@/components/SkeletonTiles'
import type { Album } from '@/domain/entities/Album'
import Touchable from '@/components/Touchable';
import { hitSlopFor, iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_/]+/g, ' ').trim()
}

function genreMatches(albumGenre: string, selectedGenre: string): boolean {
  const albumNeedle = normalize(albumGenre)
  const selectedNeedle = normalize(selectedGenre)
  if (!albumNeedle || !selectedNeedle) return false
  return (
    albumNeedle === selectedNeedle ||
    albumNeedle.includes(selectedNeedle) ||
    selectedNeedle.includes(albumNeedle)
  )
}

type Props = {
  genre: string
  refreshKey?: number
}

export default function GenreSection({ genre, refreshKey = 0 }: Props) {
  const { t } = useTranslation()
  const { navigateToAlbum } = useMatchedNavigation()
  const { colors } = useTheme()
  const rad = useRadius()
  const { albums: libraryAlbums } = useAlbums()
  const { artists: libraryArtists } = useArtists()
  const { genres: libraryGenres } = useGenres()
  const { width: screenWidth } = useWindowDimensions()
  const sheetRef = useRef<BottomSheetModal>(null)
  const dayKey = getDayKey()
  const itemCount = useSelector(selectHomeShelfItemCount)
  const isEnabled = useSourceUse(CATALOGUE_HOME_USE)

  const [selectedGenre, setSelectedGenre] = React.useState<string>(genre)

  const gridItemWidth = useMemo(
    () => getSectionItemWidth(screenWidth),
    [screenWidth]
  )

  const allGenres = useMemo(() => {
    const genres = new Set<string>()
    libraryGenres.forEach(g => { if (g.trim()) genres.add(g.trim()) })
    // Cap album scan at 500 — the server genre list covers most cases and
    // iterating all 9000+ albums on every library update is not worth it.
    const scanLimit = Math.min(libraryAlbums.length, 500)
    for (let i = 0; i < scanLimit; i++) {
      libraryAlbums[i].genres?.forEach(g => { if (g.trim()) genres.add(g.trim()) })
    }
    return [...genres].sort()
  }, [libraryGenres, libraryAlbums])

  const libraryArtistNames = useMemo(
    () => new Set(libraryArtists.map(a => a.name.toLowerCase())),
    [libraryArtists]
  )

  const seedArtistNames = useMemo(() => {
    const seen = new Set<string>()
    return libraryAlbums
      .filter(album => album.genres?.some(albumGenre => genreMatches(albumGenre, selectedGenre)))
      // A compilation's credit is not an artist to find more music by. This
      // used to test the credit against the literal string "various artists",
      // which missed "VA", "Verschiedene Interpreten", and a soundtrack filed
      // under its label — the server reports the fact itself now.
      .filter(album => album.releaseType !== 'compilation')
      .map(album => album.artist.name)
      .filter(name => {
        const normalized = name.trim().toLowerCase()
        if (!normalized || seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .slice(0, HOME_SEED_ARTISTS)
  }, [selectedGenre, libraryAlbums])

  const handleSelect = useCallback((value: string) => {
    setSelectedGenre(value)
    sheetRef.current?.dismiss()
  }, [])

  const handleRandomize = useCallback(() => {
    const eligible = allGenres.filter(g => g !== selectedGenre)
    const pool = eligible.length > 0 ? eligible : allGenres
    const random = pool[Math.floor(Math.random() * pool.length)]
    if (random) setSelectedGenre(random)
    sheetRef.current?.dismiss()
  }, [allGenres, selectedGenre])

  const query = useQuery<Album[]>({
    // Include libraryArtists.length so the cache busts when the user's library
    // gains or loses artists — otherwise stale results would include artists
    // that are now in the library (or exclude ones that have been removed).
    queryKey: [QueryKeys.ExploreGenreRow, dayKey, selectedGenre, seedArtistNames.join('|'), libraryArtists.length, refreshKey],
    queryFn: () => fetchAlbumsForGenre(selectedGenre, seedArtistNames, libraryArtistNames, itemCount),
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
            {t('explore.sections.genrePrefix')}
          </Text>
          <Touchable onPress={() => sheetRef.current?.present()} hitSlop={hitSlopFor(iconSize.control)}>
            <Text
              style={[styles.genreName, { color: colors.secondary, borderBottomColor: colors.secondary }]}
              numberOfLines={1}
            >
              {selectedGenre}
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
              No results — try a different genre
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
        items={allGenres}
        onSelect={handleSelect}
        onRandomize={handleRandomize}
        placeholder={t('explore.sections.searchGenres')}
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
  genreName: {
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
