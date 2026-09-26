import React, { useCallback, useMemo } from 'react'
import SourceBadgeView from '@/components/SourceBadge';
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Text } from '@/components/Text'
import { FlashList } from '@shopify/flash-list'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { spacing, statusColor, typography } from '@/constants/design'
import type { Artist } from '@/domain/entities/Artist'
import type { CoverSource } from '@/domain/entities/Cover'
import { useAlbums } from '@/features/album/useAlbums'
import { findArtistsWithSharedGenres, dedupeServerSimilar } from '@/features/artist/localSimilarArtists'
import { useServerSimilarArtists } from '@/features/artist/useServerSimilarArtists'
import MediaTile from '@/features/home/components/MediaTile'
import { selectShowSourceHeaders } from '@/features/settings/appearance/state'
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation'
import { useTheme } from '@/features/theme/useTheme'
import {
  ARTIST_CATALOGUE,
  useExternalSimilarArtistRows,
  type SourceBadge,
} from '@/providers/registry/artistSources'

/**
 * An artist page's similar artists, one row per source — the library, the
 * server, then each outside service declared in `artistSources` — each row
 * badged with where it came from when source headers are on.
 */

const LIBRARY_BADGE: SourceBadge = { letter: 'L', color: statusColor.success }

/**
 * Your server's badge, in the app's own accent — the same answer Home's
 * `Explore` gives: a server is yours, not an outside brand, so it borrows no
 * outside brand's colour. It used to share Library's green, which left the
 * two rows a reader cannot tell apart wearing the only thing that
 * distinguishes them.
 */
function useServerBadge(): SourceBadge {
  const { colors } = useTheme()
  return useMemo(() => ({ letter: 'S', color: colors.themeColor }), [colors.themeColor])
}

/** Tile size for a row of round artist tiles, fitting about two and a half across. */
function useArtistTileSize(): number {
  const { width } = useWindowDimensions()
  return Math.min(132, Math.max(112, (width - 56) / 2.7))
}

function SimilarArtistsSubSection<T extends { name: string; cover: CoverSource }>({
  data, itemSize, keyPrefix, badge, onPressItem, keyOf, subtitleOf,
}: {
  data: T[]
  itemSize: number
  keyPrefix: string
  badge: SourceBadge
  onPressItem: (item: T) => void
  keyOf: (item: T) => string
  subtitleOf: (item: T) => string
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const showSourceHeaders = useSelector(selectShowSourceHeaders)

  const renderArtist = useCallback(({ item }: { item: T }) => (
    <MediaTile
      cover={item.cover}
      title={item.name}
      subtitle={subtitleOf(item)}
      size={itemSize}
      radius={itemSize / 2}
      onPress={() => onPressItem(item)}
    />
  ), [itemSize, onPressItem, subtitleOf])

  if (data.length === 0) return null

  return (
    <View style={styles.similarSection}>
      <View style={styles.similarTitleRow}>
        {showSourceHeaders && (
          <SourceBadgeView letter={badge.letter} color={badge.color} />
        )}
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
          {t('artist.sections.similarArtists')}
        </Text>
      </View>
      <FlashList
        horizontal
        data={data}
        keyExtractor={item => `${keyPrefix}-${keyOf(item)}`}
        renderItem={renderArtist}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.similarListContent}
        ItemSeparatorComponent={() => <View style={styles.similarGap} />}
      />
    </View>
  )
}

export function LocalSimilarArtistsSection({ artist }: { artist: Artist }) {
  const { t } = useTranslation()
  const navigation = useNavigation<any>()
  const itemSize = useArtistTileSize()
  const { navigateToArtist } = useMatchedNavigation()
  const { albums: libraryAlbums } = useAlbums()
  const externalRows = useExternalSimilarArtistRows(artist)
  const serverBadge = useServerBadge()

  const localSimilar = useMemo(
    () => findArtistsWithSharedGenres(artist.localId, libraryAlbums),
    [artist.localId, libraryAlbums]
  )

  // Server-native similar (Navidrome getArtistInfo2 / Jellyfin+Emby /Similar).
  // Falls back to nothing when the server adapter doesn't implement it, so
  // there is no toggle: it either has data or it doesn't render.
  const { data: serverSimilar = [] } = useServerSimilarArtists(artist.nativeId, 12)

  // Pure use-case (`features/artist/localSimilarArtists.ts`): drop
  // server-similar entries the local-similar shelf already covers.
  const dedupedServerSimilar = useMemo(
    () => dedupeServerSimilar(serverSimilar, localSimilar),
    [serverSimilar, localSimilar]
  )

  // Every similar-artist source returns the same domain `Artist`, which
  // carries no display subtext of its own — every subsection shows the same
  // generic label an `ArtistRow` does.
  const artistLabel = useCallback(() => t('common.artist'), [t])

  return (
    <>
      <SimilarArtistsSubSection
        data={localSimilar}
        itemSize={itemSize}
        keyPrefix="local"
        badge={LIBRARY_BADGE}
        onPressItem={item => navigation.push('artistView', { id: item.nativeId })}
        keyOf={item => item.localId}
        subtitleOf={artistLabel}
      />
      {dedupedServerSimilar.length > 0 && (
        <SimilarArtistsSubSection
          data={dedupedServerSimilar}
          itemSize={itemSize}
          keyPrefix="server"
          badge={serverBadge}
          onPressItem={item => navigation.push('artistView', { id: item.nativeId })}
          keyOf={item => item.localId}
          subtitleOf={artistLabel}
        />
      )}
      {externalRows.map(row => (
        <SimilarArtistsSubSection
          key={row.id}
          data={row.artists}
          itemSize={itemSize}
          keyPrefix={row.id}
          badge={row.badge}
          onPressItem={item => navigateToArtist(item)}
          keyOf={item => item.localId}
          subtitleOf={artistLabel}
        />
      ))}
    </>
  )
}

export function ExternalSimilarArtistsSection({ similarArtists }: { similarArtists: Artist[] }) {
  const { t } = useTranslation()
  const itemSize = useArtistTileSize()
  const { navigateToArtist } = useMatchedNavigation()

  return (
    <SimilarArtistsSubSection
      data={similarArtists}
      itemSize={itemSize}
      keyPrefix="catalogue"
      badge={ARTIST_CATALOGUE.badge}
      onPressItem={item => navigateToArtist(item)}
      keyOf={item => item.localId}
      subtitleOf={() => t('common.artist')}
    />
  )
}

const styles = StyleSheet.create({
  similarSection: {
    paddingTop: spacing.roomy,
    paddingBottom: spacing.controlGap,
  },
  similarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.controlGap,
  },
  sectionTitle: {
    ...typography.navigationTitle,
  },
  similarListContent: {
    paddingHorizontal: spacing.lg,
  },
  similarGap: {
    width: 12,
  },
})
