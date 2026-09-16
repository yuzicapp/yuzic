import React, { useCallback, useMemo } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { selectAlbumPlayCounts } from '@/state/redux/selectors/statsSelectors';
import { useAlbums } from '@/features/album/useAlbums';
import AlbumItem from '@/features/library/components/Items/AlbumItem';
import SectionShelfHeader from '../SectionShelfHeader';
import { useTranslation } from 'react-i18next';
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers';
import { sectionStyles, getSectionItemWidth } from '../sectionStyles';
import { useStableList } from '../../hooks/useStableList';

const MIN_ALBUMS = 4;
const MAX_ALBUMS = 10;

export default function MostPlayedAlbums() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const gridItemWidth = getSectionItemWidth(width);
  const albumPlayCounts = useSelector(selectAlbumPlayCounts);
  const { albums } = useAlbums();

  // Stable while the same albums are listed in the same order: the counts
  // behind them change at the end of every song. See `useStableList`.
  const itemsToRender = useStableList(useMemo(() => {
    // Collect only albums that have been played, then sort that smaller set —
    // O(n) scan + O(k log k) sort where k = played albums, not O(n log n) over all.
    const withCounts: { album: typeof albums[0]; count: number }[] = [];
    for (const album of albums) {
      const count = albumPlayCounts[album.nativeId] ?? 0;
      if (count > 0) withCounts.push({ album, count });
    }
    withCounts.sort((a, b) => b.count - a.count);
    return withCounts.slice(0, MAX_ALBUMS).map(x => x.album);
  }, [albumPlayCounts, albums]));

  const coversToPrefetch = useMemo(() => itemsToRender.map(a => a.cover), [itemsToRender]);
  usePrefetchCovers(coversToPrefetch, 'grid');

  // The shelf stops at ten; "most played first" is a sort order the albums
  // list already has, so the heading leads there rather than nowhere.
  const openAll = useCallback(
    () => navigation.push('libraryCollectionView', {
      type: 'albums',
      sort: 'userplays',
    }),
    [navigation]
  );

  // Hide the section until enough albums have play history to fill it.
  if (itemsToRender.length < MIN_ALBUMS) return null;

  return (
    <View style={sectionStyles.container}>
      <SectionShelfHeader
        testID="home-most-played-see-all"
        title={t('explore.sections.mostPlayed')}
        seeAllLabel={t('library.seeAll')}
        onSeeAll={openAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={sectionStyles.scrollContent}
      >
        {itemsToRender.map(album => (
          <View key={album.localId} style={[sectionStyles.item, { width: gridItemWidth }]}>
            <AlbumItem album={album} isGridView gridWidth={gridItemWidth} gridSpacing={0} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
