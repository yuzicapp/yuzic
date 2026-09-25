import React, { useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { DetailHeaderBar } from '@/components/DetailHeader'
import LibraryList from '@/features/library/LibraryList'
import { useSortLabels } from '@/features/library/useSortLabels'
import { EMPTY_SORT_STATS, sortItems, type LibraryItem, type SortOrder } from '@/features/library/librarySort'
import { useTheme } from '@/features/theme/useTheme'
import { useArtistScreenModel, type ArtistRouteParams } from './useArtistScreenModel'

/**
 * One artist's releases, as a list.
 *
 * The artist screen shows three of each kind and used to grow by five a tap,
 * which is fine for most artists and miserable for a prolific one: forty
 * albums took eight presses before the last of them was on screen. The list
 * every other collection already uses answers that better — it sorts, it
 * switches to a grid, and it scrolls.
 *
 * Which releases is decided by the caller rather than here, because the artist
 * screen deliberately keeps what you own apart from what you don't: a "see
 * all" opens the group it was sitting under, not a merge of both.
 */
type ReleaseGroup = 'albums' | 'singles'
type ReleaseScope = 'owned' | 'external'

type Params = ArtistRouteParams & { group?: ReleaseGroup; scope?: ReleaseScope }

export default function ArtistReleasesScreen() {
  const { params } = useRoute<{ key: string; name: string; params: Params }>()
  const { group = 'albums', scope = 'owned', ...artistParams } = params ?? {}
  const { t } = useTranslation()
  const { colors } = useTheme()
  const sortLabels = useSortLabels()

  // Newest first: a discography is read by era, and the artist screen orders
  // it that way too, so opening the full list should not reshuffle it.
  const [sortOrder, setSortOrder] = useState<SortOrder>('year')

  const model = useArtistScreenModel(artistParams)
  const { ownedAlbums, ownedSingles, unownedAlbums, unownedSingles } = model.discography

  const releases = useMemo(() => {
    if (scope === 'external') return group === 'albums' ? unownedAlbums : unownedSingles
    return group === 'albums' ? ownedAlbums : ownedSingles
  }, [group, scope, ownedAlbums, ownedSingles, unownedAlbums, unownedSingles])

  const items = useMemo<LibraryItem[]>(
    () => sortItems(releases.map(album => ({ kind: 'album' as const, data: album })), sortOrder, EMPTY_SORT_STATS),
    [releases, sortOrder]
  )

  // The artist names the screen; the section says which half of their work
  // this is, which is what the caller came from.
  const title = model.artist?.name ?? t(`artist.sections.${group}`)
  const subtitle = `${t(`artist.sections.${group}`)} · ${
    group === 'albums'
      ? t('library.count.albums', { count: items.length })
      : t('library.count.items', { count: items.length })
  }`

  return (
    <SafeAreaView
      testID="artist-releases-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar title={title} subtitle={subtitle} />

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
