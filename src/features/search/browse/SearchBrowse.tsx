import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { Tags } from 'lucide-react-native'

import { iconSize, spacing, typography } from '@/constants/design'
import { useAlbums } from '@/features/album/useAlbums'
import CoverMosaic from '@/features/library/CoverMosaic'
import { GRID_SPACING, gridItemWidth, libraryGutter } from '@/features/library/layout'
import { useGridColumns } from '@/features/layout/useGridColumns'
import { useWindowLayout } from '@/features/layout/useWindowLayout'
import { useTheme } from '@/features/theme/useTheme'
import { useRadius } from '@/features/theme/useRadius'
import Touchable from '@/components/Touchable'
import { browseTilesFor, MAX_TILES_PER_KIND, type BrowseTile } from './browseTiles'

/**
 * The idle Search screen: ways into the library, rather than nothing.
 *
 * Shown when the field is empty and unfocused. Focusing the field replaces
 * this with recent searches, because a list of past queries is useful with a
 * cursor in the field and clutter without one.
 *
 * Genres first, moods second where the library has them — see `browseTiles`
 * for why neither is inferred. A library with no tags at all gets nothing
 * here, which is correct: there is genuinely nothing to offer, and an invented
 * tile would be worse than the empty screen this replaces.
 */
export default function SearchBrowse() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const navigation = useNavigation<any>()
  const route = useRoute()
  const { width } = useWindowLayout()
  const columns = useGridColumns()
  const { albums } = useAlbums()

  const gutter = libraryGutter(true, GRID_SPACING, width)
  const tileSize = gridItemWidth(width, columns, GRID_SPACING, gutter)

  const genres = useMemo(() => browseTilesFor(albums, 'genre'), [albums])
  const moods = useMemo(() => browseTilesFor(albums, 'mood'), [albums])

  const open = (tile: BrowseTile) =>
    navigation.push('browseTagView', { kind: tile.kind, label: tile.label })

  const section = (titleKey: string, tiles: BrowseTile[], seeAll?: () => void) => {
    if (tiles.length === 0) return null
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{t(titleKey)}</Text>
          {seeAll && tiles.length > MAX_TILES_PER_KIND && (
            <Touchable accessibilityRole="button" onPress={seeAll}>
              <Text style={[styles.seeAll, { color: colors.subtext }]}>{t('library.seeAll')}</Text>
            </Touchable>
          )}
        </View>
        <View style={[styles.grid, { paddingHorizontal: gutter }]}>
          {tiles.slice(0, MAX_TILES_PER_KIND).map(tile => (
            <Touchable
              key={tile.key}
              testID="search-browse-tile"
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              style={[styles.tile, { width: tileSize, margin: GRID_SPACING }]}
              onPress={() => open(tile)}
            >
              <CoverMosaic
                covers={tile.covers}
                size={tileSize}
                fallback={<Tags size={iconSize.row} color={colors.subtext} />}
              />
              <View style={[styles.caption, { borderRadius: rad.md }]}>
                <Text style={[styles.tileLabel, { color: colors.secondary }]} numberOfLines={2}>
                  {tile.label}
                </Text>
                <Text style={[styles.tileCount, { color: colors.subtext }]} numberOfLines={1}>
                  {t('library.count.albums', { count: tile.albumCount })}
                </Text>
              </View>
            </Touchable>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View testID="search-browse">
      {section('search.browse.genres', genres, () =>
        navigation.push('genresView', (route.params ?? {}) as never)
      )}
      {section('search.browse.moods', moods)}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.sectionTitle,
  },
  seeAll: {
    ...typography.caption,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {},
  caption: {
    paddingTop: spacing.xs,
  },
  tileLabel: {
    ...typography.rowTitle,
  },
  tileCount: {
    ...typography.rowSubtitle,
  },
})
