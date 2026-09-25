import React, { useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { DetailHeaderBar } from '@/components/DetailHeader'
import { useAlbums } from '@/features/album/useAlbums'
import LibraryList from '@/features/library/LibraryList'
import { useSortLabels } from '@/features/library/useSortLabels'
import {
  EMPTY_SORT_STATS,
  sortItems,
  type LibraryItem,
  type SortOrder,
} from '@/features/library/librarySort'
import { useTheme } from '@/features/theme/useTheme'
import { albumsForTile, type BrowseTileKind } from './browseTiles'

/**
 * Everything under one tag, as a list.
 *
 * The same screen for a genre and for a mood, because they are the same kind of
 * question asked of a different tag — and the same `LibraryList` every other
 * collection uses, so it sorts, switches to a grid and scrolls like the rest of
 * the app rather than being a bespoke list that does none of that.
 */
type Params = { kind?: BrowseTileKind; label?: string }

export default function BrowseTagScreen() {
  const { params } = useRoute<{ key: string; name: string; params: Params }>()
  const { kind = 'genre', label = '' } = params ?? {}
  const { t } = useTranslation()
  const { colors } = useTheme()
  const sortLabels = useSortLabels()
  const { albums } = useAlbums()

  const [sortOrder, setSortOrder] = useState<SortOrder>('title')

  const items = useMemo<LibraryItem[]>(() => {
    const tagged = albumsForTile(albums, kind, label)
    return sortItems(
      tagged.map(album => ({ kind: 'album' as const, data: album })),
      sortOrder,
      EMPTY_SORT_STATS
    )
  }, [albums, kind, label, sortOrder])

  // The tag names the screen; the subtitle says which kind of tag it is, since
  // "Melancholy" alone does not tell you whether it came from a genre field.
  const subtitle = `${t(`search.browse.${kind}`)} · ${t('library.count.albums', {
    count: items.length,
  })}`

  return (
    <SafeAreaView
      testID="browse-tag-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar title={label} subtitle={subtitle} />

      <LibraryList
        items={items}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        sortLabel={sortLabels[sortOrder]}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
