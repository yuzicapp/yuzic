import React, { useCallback, useMemo } from 'react'
import { RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useDispatch, useSelector } from 'react-redux'

import ListControls from '@/components/ListControls'
import { selectLibraryViewMode, setIsGridView, setLibraryViewMode } from '@/features/settings/appearance/state';
import { useGridColumns } from '@/features/layout/useGridColumns';
import { gridItemWidth, libraryGutter, GRID_SPACING } from './layout'
import AlbumItem from './components/Items/AlbumItem'
import ArtistItem from './components/Items/ArtistItem'
import PlaylistItem from './components/Items/PlaylistItem'
import TrackItem from './components/Items/TrackItem'
import SortBottomSheet from './components/SortBottomSheet'
import { useSheetRef } from '@/components/useSheetRef'
import type { LibraryCollectionType, LibraryItem, SortOrder } from './librarySort'
import { useScrollClearance } from '@/features/theme/useScrollClearance'
import { useTheme } from '@/features/theme/useTheme'

type Props = {
  items: LibraryItem[]
  sortOrder: SortOrder
  onSortChange: (order: SortOrder) => void
  sortLabel: string
  /** Rendered above the sort row — entry points on the tab, actions on a screen. */
  header?: React.ReactNode
  /** Which collection this is, so grid-or-list is remembered per kind rather
   *  than once for all of them. Null for a list that isn't one of them. */
  collection?: LibraryCollectionType | null
  /** Pull-to-refresh, for the lists whose contents come from the server.
   *  Omitted by a list built from something else — Recently played is the
   *  device's own history, and a pull on it would ask the server nothing. */
  refresh?: { refreshing: boolean; onRefresh: () => void }
}

/**
 * The library list itself: sort and grid controls, then the items.
 *
 * Shared by the library tab and every per-type screen so a track row looks and
 * behaves the same wherever it is reached from.
 */
const LibraryList: React.FC<Props> = ({
  items,
  sortOrder,
  onSortChange,
  sortLabel,
  header,
  collection = null,
  refresh,
}) => {
  const scrollClearance = useScrollClearance()
  const { colors } = useTheme()
  const dispatch = useDispatch()
  const isGridView = useSelector(selectLibraryViewMode(collection))
  const gridColumns = useGridColumns()
  const { width: screenWidth } = useWindowDimensions()

  const sortSheetRef = useSheetRef()

  const gutter = libraryGutter(isGridView, GRID_SPACING, screenWidth)
  const gridWidth = gridItemWidth(screenWidth, gridColumns, GRID_SPACING, gutter)

  /**
   * Whether a row should say what kind of thing it is.
   *
   * "Album • Various Artists" earns the prefix on Home, where one shelf mixes
   * albums with artists and playlists and the word is the only thing telling
   * them apart. On a screen that is nothing but albums it is the same word on
   * every row, and it is spending the line the artist name needs — in a
   * three-up grid the prefix always fitted and the artist almost never did.
   *
   * Read off the items rather than passed in, so `downloaded` — the one
   * collection that really is mixed — keeps its labels without the callers
   * having to know which collections those are.
   */
  const showTypeLabel = useMemo(() => {
    const kinds = new Set(items.map(item => item.kind))
    return kinds.size > 1
  }, [items])

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => {
    switch (item.kind) {
      case 'album':
        return (
          <AlbumItem
            album={item.data}
            showTypeLabel={showTypeLabel}
            isGridView={isGridView}
            gridWidth={gridWidth}
            gridSpacing={GRID_SPACING}
          />
        )
      case 'artist':
        return (
          <ArtistItem
            artist={item.data}
            showTypeLabel={showTypeLabel}
            isGridView={isGridView}
            gridWidth={gridWidth}
            gridSpacing={GRID_SPACING}
          />
        )
      case 'playlist':
        return (
          <PlaylistItem
            playlist={item.data}
            showTypeLabel={showTypeLabel}
            isGridView={isGridView}
            gridWidth={gridWidth}
            gridSpacing={GRID_SPACING}
          />
        )
      case 'track':
        return (
          <TrackItem
            song={item.data}
            isGridView={isGridView}
            gridWidth={gridWidth}
            gridSpacing={GRID_SPACING}
          />
        )
    }
  }, [isGridView, gridWidth, showTypeLabel])

  return (
    <>
      <FlashList<LibraryItem>
        key={`${isGridView ? `grid-${gridColumns}` : 'list'}`}
        data={items}
        keyExtractor={item => `${item.kind}-${item.data.localId}`}
        renderItem={renderItem}
        numColumns={isGridView ? gridColumns : 1}
        getItemType={item => item.kind}
        ListHeaderComponent={
          // The gutter is sized for the items; everything above them keeps the
          // app's own page inset, so give that back before it is applied twice.
          <View style={{ marginHorizontal: -gutter }}>
            {header}
            <ListControls
              sortLabel={sortLabel}
              onSortPress={() => sortSheetRef.current?.present()}
              isGridView={isGridView}
              onToggleView={() => dispatch(
                collection
                  ? setLibraryViewMode({ collection, isGridView: !isGridView })
                  : setIsGridView(!isGridView)
              )}
            />
          </View>
        }
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: gutter, paddingBottom: scrollClearance },
        ]}
        refreshControl={
          refresh
            ? (
              <RefreshControl
                refreshing={refresh.refreshing}
                onRefresh={refresh.onRefresh}
                // The list is drawn on the app's background, which the theme
                // owns, so the spinner takes the accent rather than iOS grey.
                tintColor={colors.themeColor}
                colors={[colors.themeColor]}
              />
            )
            : undefined
        }
        showsVerticalScrollIndicator={false}
      />

      <SortBottomSheet
        ref={sortSheetRef}
        sortOrder={sortOrder}
        onSelect={onSortChange}
      />
    </>
  )
}

export default LibraryList

const styles = StyleSheet.create({
  list: { paddingTop: 0 },
})
