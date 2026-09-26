import React, { useMemo } from 'react'
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { Text } from '@/components/Text'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'

import { useApi } from '@/providers/registry/useApi'
import { QueryKeys } from '@/state/query/queryKeys'
import { useTheme } from '@/features/theme/useTheme'
import { useRadius } from '@/features/theme/useRadius'
import { usePrefetchCovers } from '@/features/library/usePrefetchCovers'
import { prefetchCovers } from '@/features/artwork/imageCache'
import MediaTile from '@/features/home/components/MediaTile'
import type { Album } from '@/domain/entities/Album'
import { SHELF_GAP, SHELF_INSET, shelfItemWidth } from '@/features/layout/shelf'
import { spacing, typography } from '@/constants/design'

const SIMILAR_ALBUM_LIMIT = 10

type Props = {
  albumId: string
}

/**
 * Albums the server itself thinks are like this one.
 *
 * `getSimilarAlbums` has been implemented and wired into the Jellyfin and Emby
 * adapters with nothing calling it. It matters because the only other
 * recommendation on this screen comes from Deezer, which is an outside service
 * that waits to be asked — so a Jellyfin user who has not turned anything on
 * has no recommendations at all, while their server has been able to answer
 * this the whole time.
 *
 * These are albums from the user's own library rather than an external
 * catalogue, so a tap goes straight to the local album screen and there is no
 * source badge to draw: nothing here came from anywhere else.
 */
export default function SimilarAlbumsSection({ albumId }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const api = useApi()
  const navigation = useNavigation<any>()
  const { width: screenWidth } = useWindowDimensions()

  const getSimilarAlbums = api.similar.getSimilarAlbums

  const tileWidth = shelfItemWidth(screenWidth)

  const { data: albums } = useQuery<Album[]>({
    queryKey: [QueryKeys.ServerSimilarAlbums, albumId],
    // Jellyfin and Emby only; Navidrome's adapter does not implement it, so
    // the query never runs there rather than showing an empty shelf.
    enabled: Boolean(getSimilarAlbums) && !!albumId,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => (await getSimilarAlbums?.(albumId, SIMILAR_ALBUM_LIMIT)) ?? [],
  })

  const filtered = useMemo(
    () => (albums ?? []).filter(album => album.nativeId !== albumId),
    [albums, albumId]
  )
  const covers = useMemo(() => filtered.map(album => album.cover), [filtered])
  usePrefetchCovers(covers, 'grid')

  if (filtered.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>
        {t('album.similarAlbums')}
      </Text>
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
              navigation.push('albumView', { id: album.nativeId })
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
  title: {
    ...typography.sectionTitle,
    paddingHorizontal: SHELF_INSET,
    marginBottom: spacing.md,
  },
  scroll: {
    paddingHorizontal: SHELF_INSET,
    gap: SHELF_GAP,
  },
})
