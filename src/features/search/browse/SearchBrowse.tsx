import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { spacing, typography } from '@/constants/design'
import { useAlbums } from '@/features/album/useAlbums'
import { GRID_SPACING, gridItemWidth, libraryGutter } from '@/features/library/layout'
import { useGridColumns } from '@/features/layout/useGridColumns'
import { useWindowLayout } from '@/features/layout/useWindowLayout'
import { useTheme } from '@/features/theme/useTheme'
import Touchable from '@/components/Touchable'
import BrowseTile from './BrowseTile'
import { tileSpan, tileWidth } from './browseLayout'
import { browseTilesFor, MAX_TILES_PER_KIND } from './browseTiles'

/**
 * The idle Search screen: ways into the library, rather than nothing.
 *
 * Shown when the field is empty and unfocused. Focusing replaces it with
 * recent searches, because past queries are useful with a cursor in the field
 * and clutter without one.
 *
 * One grid, no headers and no filter. A genre and a mood are the same kind of
 * thing here — a tag your files carry, and a way in — so they are ranked
 * together by how much of the library sits behind each rather than being
 * separated by a control that made the screen about its own categories. Most
 * libraries have no mood tags at all, and those that do get them in the same
 * list without being asked to switch.
 *
 * Sizing comes from the library's own grid, so this sits at the same scale as
 * every other grid in the app and follows the density the listener chose.
 */
export default function SearchBrowse() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const route = useRoute()
  const { width } = useWindowLayout()
  const columns = useGridColumns()
  const { albums } = useAlbums()

  const tiles = useMemo(() => {
    const tagged = [...browseTilesFor(albums, 'genre'), ...browseTilesFor(albums, 'mood')]
    return tagged
      .sort((a, b) => b.albumCount - a.albumCount || a.label.localeCompare(b.label))
      .slice(0, MAX_TILES_PER_KIND)
  }, [albums])

  const gutter = libraryGutter(true, GRID_SPACING, width)
  const cell = gridItemWidth(width, columns, GRID_SPACING, gutter)

  if (tiles.length === 0) return null

  return (
    <View testID="search-browse">
      <View style={[styles.grid, { paddingHorizontal: gutter }]}>
        {tiles.map((tile, rank) => {
          const span = tileSpan(rank, columns)
          return (
            <View key={tile.key} style={styles.cell}>
              <BrowseTile
                tile={tile}
                width={tileWidth(span, cell, GRID_SPACING)}
                height={cell}
                onPress={() =>
                  navigation.push('browseTagView', { kind: tile.kind, label: tile.label })
                }
              />
            </View>
          )
        })}
      </View>

      {/*
        The tail, as a row rather than a tile: everything above is a place to
        go, and this is the way to the rest — a different kind of thing, so it
        does not pretend to be one of them.
      */}
      <Touchable
        accessibilityRole="button"
        style={styles.allRow}
        onPress={() => navigation.push('genresView', (route.params ?? {}) as never)}
      >
        <Text style={[styles.allText, { color: colors.subtext }]}>
          {t('search.browse.allGenres')}
        </Text>
      </Touchable>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    margin: GRID_SPACING,
  },
  allRow: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  allText: {
    ...typography.rowSubtitle,
    fontWeight: '500',
  },
})
