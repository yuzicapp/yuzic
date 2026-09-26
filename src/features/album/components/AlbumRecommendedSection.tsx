import { onDark, spacing, typography } from '@/constants/design';
import React, { useMemo } from 'react'
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { Text } from '@/components/Text'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/features/theme/useTheme'
import { useArtists } from '@/features/artist/useArtists';
import { useSourceUse } from '@/features/settings/sources/useSourceUse'
import { selectShowSourceHeaders } from '@/features/settings/appearance/state';
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation'
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers'
import { prefetchCovers } from '@/features/artwork/imageCache'
import { CATALOGUE_RECOMMENDATIONS_USE, fetchAlbumsLikeArtist } from '@/providers/registry/homeDiscovery'
import { ARTIST_CATALOGUE } from '@/providers/registry/artistSources'
import { QueryKeys } from '@/state/query/queryKeys'
import { STALE_DEEZER_DISCOVERY } from '@/features/home/constants'
import MediaTile from '@/features/home/components/MediaTile'
import type { Album } from '@/domain/entities/Album'
import {
  ALBUM_RECOMMENDATION_RELATED_LIMIT,
  ALBUM_RECOMMENDATION_TARGET_ALBUMS,
} from '@/features/album/constants';
import { SHELF_GAP, SHELF_INSET, shelfItemWidth } from '@/features/layout/shelf';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  artistName: string
  excludeAlbumId: string
}

export default function AlbumRecommendedSection({ artistName, excludeAlbumId }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const { width: screenWidth } = useWindowDimensions()
  const enabled = useSourceUse(CATALOGUE_RECOMMENDATIONS_USE)
  const showSourceHeaders = useSelector(selectShowSourceHeaders)
  const { artists } = useArtists()
  const { navigateToAlbum } = useMatchedNavigation()

  const tileWidth = shelfItemWidth(screenWidth)

  const libraryArtistNames = useMemo(
    () => new Set(artists.map(a => a.name.toLowerCase())),
    [artists]
  )

  const { data: albums = [] } = useQuery<Album[]>({
    queryKey: [QueryKeys.ExploreBecauseYouListened, 'album-rec', artistName],
    queryFn: () => fetchAlbumsLikeArtist(artistName, libraryArtistNames, {
      relatedLimit: ALBUM_RECOMMENDATION_RELATED_LIMIT,
      targetAlbums: ALBUM_RECOMMENDATION_TARGET_ALBUMS,
    }),
    enabled: enabled && !!artistName,
    staleTime: STALE_DEEZER_DISCOVERY,
    networkMode: 'online',
  })

  const filtered = useMemo(() => albums.filter(a => a.nativeId !== excludeAlbumId), [albums, excludeAlbumId])
  const covers = useMemo(() => filtered.map(a => a.cover), [filtered])
  usePrefetchCovers(covers, 'grid')

  if (!enabled || filtered.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {showSourceHeaders && (
          <View style={[styles.badge, { backgroundColor: ARTIST_CATALOGUE.badge.color, borderRadius: rad.pill }]}>
            <Text style={styles.badgeLetter}>{ARTIST_CATALOGUE.badge.letter}</Text>
          </View>
        )}
        <Text style={[styles.title, { color: colors.secondary }]}>{t('album.mightAlsoLike')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {filtered.map(album => (
          <MediaTile
            key={album.localId}
            cover={album.cover}
            title={album.title}
            subtitle={album.artist.name}
            size={tileWidth}
            radius={rad.card}
            onPress={() => {
              prefetchCovers([album.cover], 'detail')
              navigateToAlbum(album)
            }}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: SHELF_INSET,
    marginBottom: spacing.md,
  },
  badge: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLetter: {
    ...typography.micro,
    fontWeight: '600',
    color: onDark.text,
  },
  title: {
    ...typography.sectionTitle,
  },
  scroll: {
    paddingHorizontal: SHELF_INSET,
    gap: SHELF_GAP,
  },
})
