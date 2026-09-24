import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { notify } from '@/components/toast';
import { ArrowDownToLine, Disc3, ListMusic, Music2, Users } from 'lucide-react-native'

import { DetailHeaderBar } from '@/components/DetailHeader'
import EmptyState from '@/components/EmptyState'
import { usePlayingActions } from '@/features/playback/PlayingContext'
import { useTheme } from '@/features/theme/useTheme'
import { iconSize, spacing } from '@/constants/design'
import CollectionActions from './CollectionActions'
import DownloadedHeader from '@/features/downloads/DownloadedHeader'
import LibraryList from './LibraryList'
import { useLibraryRefresh } from './useLibraryRefresh'
import LoadingLibraryList from './Loading'
import { useLibraryItems } from './useLibraryItems'
import { useSortLabels } from './useSortLabels'
import type { LibraryCollectionType, SortOrder } from './librarySort'

/** Default order per type: releases read best newest-first, names alphabetically. */
const DEFAULT_SORT: Record<LibraryCollectionType, SortOrder> = {
  playlists: 'recent',
  albums: 'recentlyAdded',
  artists: 'title',
  tracks: 'title',
  downloaded: 'recentlyAdded',
}

const TITLE_KEY: Record<LibraryCollectionType, string> = {
  playlists: 'home.filters.playlists',
  albums: 'home.filters.albums',
  artists: 'home.filters.artists',
  tracks: 'home.filters.tracks',
  downloaded: 'home.filters.downloaded',
}

/** The same icon each collection's row carries in the library index. */
const EMPTY_ICON: Record<LibraryCollectionType, React.ComponentType<{ size?: number; color?: string }>> = {
  playlists: ListMusic,
  albums: Disc3,
  artists: Users,
  tracks: Music2,
  downloaded: ArrowDownToLine,
}

const COUNT_KEY: Record<LibraryCollectionType, string> = {
  playlists: 'library.count.playlists',
  albums: 'library.count.albums',
  artists: 'library.count.artists',
  tracks: 'library.count.tracks',
  downloaded: 'library.count.items',
}

/**
 * What this screen shows: which slice of the library, and ordered how.
 *
 * A caller that wants a particular order — Home's "Recently added", "Most
 * played" and "Recents" shelves all do — asks for a `sort` rather than for a
 * screen of its own. That is what a sort order is, and the sort control says
 * so once you arrive, which a bespoke screen never did.
 *
 * The title names the slice, never the order. A shelf's own name would be a
 * promise the list doesn't keep: `userplays` and `recent` order the albums by
 * play data, they don't filter to what has any, so a screen headed "Most
 * played" would be listing every album you own — and would still say so after
 * the reader changed the sort to A–Z.
 */
type CollectionParams = {
  type?: LibraryCollectionType
  sort?: SortOrder
}

const LibraryCollectionScreen: React.FC = () => {
  const route = useRoute<any>()
  const params = (route.params ?? {}) as CollectionParams
  const { type, sort } = params
  const { t } = useTranslation()
  const { colors } = useTheme()
  const refresh = useLibraryRefresh()
  const sortLabels = useSortLabels()

  const [sortOrder, setSortOrder] = useState<SortOrder>(
    sort ?? (type ? DEFAULT_SORT[type] : 'recent')
  )

  const { items, isLoading } = useLibraryItems(type ?? null, sortOrder)
  const { playSongs } = usePlayingActions()

  const title = type ? t(TITLE_KEY[type]) : t('library.title')

  // Only a list of tracks is a queue. A screen of albums or artists is a list
  // of collections, each with its own play action already.
  const playableTracks = useMemo(
    () => (type === 'tracks'
      ? items.flatMap(item => (item.kind === 'track' ? [item.data] : []))
      : []),
    [type, items]
  )

  const play = useCallback(async (shuffle: boolean) => {
    if (!playableTracks.length) return
    try {
      await playSongs(playableTracks, { shuffle, contextId: 'library-tracks' })
    } catch {
      notify.error(t('library.collection.playFailed'))
    }
  }, [playableTracks, playSongs, t])

  const count = items.length > 0
    ? t(type ? COUNT_KEY[type] : 'library.count.items', { count: items.length })
    : undefined

  // The bar above already names the screen, so there is no heading here — only
  // the actions, where the collection is actually a queue.
  const header = type === 'downloaded' ? (
    <DownloadedHeader />
  ) : playableTracks.length > 0 ? (
    <View style={styles.actions}>
      <CollectionActions
        onPlay={() => { void play(false) }}
        onShuffle={() => { void play(true) }}
      />
    </View>
  ) : null

  return (
    <SafeAreaView
      testID="library-collection-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <DetailHeaderBar title={title} subtitle={count} />

      {isLoading && items.length === 0 ? (
        <LoadingLibraryList collection={type ?? null} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={React.createElement(type ? EMPTY_ICON[type] : Music2, { size: iconSize.emptyState, color: colors.subtext })}
          // "Nothing here yet" says nothing about how Downloaded fills up.
          message={t(type === 'downloaded' ? 'library.collection.downloadedEmpty' : 'library.collection.empty')}
        />
      ) : (
        <LibraryList
          items={items}
          collection={type ?? null}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          sortLabel={sortLabels[sortOrder]}
          header={header}
          refresh={refresh}
        />
      )}
    </SafeAreaView>
  )
}

export default LibraryCollectionScreen

const styles = StyleSheet.create({
  screen: { flex: 1 },
  actions: { paddingHorizontal: spacing.page, paddingTop: spacing.sm },
})
