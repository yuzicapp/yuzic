import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { controlSize, spacing, tinted, typography } from '@/constants/design'
import { useAlbums } from '@/features/album/useAlbums'
import { GRID_SPACING } from '@/features/library/layout'
import { useWindowLayout } from '@/features/layout/useWindowLayout'
import { useTheme } from '@/features/theme/useTheme'
import { useRadius } from '@/features/theme/useRadius'
import Touchable from '@/components/Touchable'
import BrowseTile from './BrowseTile'
import { tileShape, tileSize } from './browseLayout'
import { browseTilesFor, MAX_TILES_PER_KIND, type BrowseTileKind } from './browseTiles'

/**
 * The idle Search screen: ways into the library, rather than nothing.
 *
 * Shown when the field is empty and unfocused. Focusing replaces it with
 * recent searches, because past queries are useful with a cursor in the field
 * and clutter without one.
 *
 * There are no section headers. "Genres" over a grid is the grammar of a shelf
 * on Home — one row among many — and here it sat above the whole screen, under
 * a title that already said Search. Two kinds of tag became two stacked
 * shelves. A chip row says the same thing in one line and lets the grid have
 * the screen, and it disappears entirely for a library with only genres, which
 * is most of them.
 */
export default function SearchBrowse() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const navigation = useNavigation<any>()
  const route = useRoute()
  const { width } = useWindowLayout()
  const { albums } = useAlbums()

  const genres = useMemo(() => browseTilesFor(albums, 'genre'), [albums])
  const moods = useMemo(() => browseTilesFor(albums, 'mood'), [albums])

  const [kind, setKind] = useState<BrowseTileKind>('genre')
  // A library with no mood tags is never offered the choice — see `browseTiles`
  // for why nothing here is inferred.
  const kinds: BrowseTileKind[] = moods.length > 0 ? ['genre', 'mood'] : ['genre']
  const active = kind === 'mood' && moods.length > 0 ? moods : genres

  const contentWidth = width - spacing.page * 2
  const tiles = active.slice(0, MAX_TILES_PER_KIND)

  if (genres.length === 0 && moods.length === 0) return null

  return (
    <View testID="search-browse">
      {kinds.length > 1 && (
        <View style={styles.chipRow}>
          {kinds.map(option => {
            const selected = option === kind
            return (
              <Touchable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? tinted(colors.themeColor, 'selected') : colors.muted,
                    borderRadius: rad.pillFor(controlSize.inlineControl),
                  },
                ]}
                onPress={() => setKind(option)}
              >
                <Text
                  style={[styles.chipText, { color: selected ? colors.themeColor : colors.secondary }]}
                >
                  {t(`search.browse.${option}s`)}
                </Text>
              </Touchable>
            )
          })}
        </View>
      )}

      <View style={styles.grid}>
        {tiles.map((tile, rank) => {
          const { width: w, height } = tileSize(tileShape(rank), contentWidth, GRID_SPACING)
          return (
            <View key={tile.key} style={styles.cell}>
              <BrowseTile
                tile={tile}
                width={w}
                height={height}
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
      {kind === 'genre' && genres.length > MAX_TILES_PER_KIND && (
        <Touchable
          accessibilityRole="button"
          style={styles.allRow}
          onPress={() => navigation.push('genresView', (route.params ?? {}) as never)}
        >
          <Text style={[styles.allText, { color: colors.subtext }]}>
            {t('search.browse.allGenres')}
          </Text>
        </Touchable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...typography.rowSubtitle,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.page - GRID_SPACING,
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
