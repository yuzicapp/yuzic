import { spacing, typography } from '@/constants/design'
import { useIconSize } from '@/features/theme/useIconSize';
import React, { useCallback, useMemo, useState } from 'react'
import { useRadius } from '@/features/theme/useRadius'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { FlashList } from '@shopify/flash-list'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Ellipsis, Globe } from 'lucide-react-native'
import type { Album } from '@/domain/entities/Album'
import AlbumRow from '@/components/rows/AlbumRow'
import Header, { ArtistHeaderBar } from '../Header'
import { DetailScreen } from '@/components/DetailHeader'
import { useContentInset } from '@/features/layout/useContentInset'
import { useTheme } from '@/features/theme/useTheme'
import { useTranslation } from 'react-i18next'
import { releaseYearLabel } from '@/features/artist/discography'
import type { ArtistScreenModel } from '@/features/artist/useArtistScreenModel'
import MostPlayedSection from './MostPlayedSection'
import PopularTracksSection from './PopularTracksSection'
import LocalPopularTracksSection from './LocalPopularTracksSection'
import ArtistBio from './ArtistBio'
import TopSongsSection from './TopSongsSection'
import { ExternalSimilarArtistsSection, LocalSimilarArtistsSection } from './SimilarArtistsSection'
import { useMatchedNavigation } from '@/features/sources/useMatchedNavigation'
import Touchable from '@/components/Touchable'
import { useScrollClearance } from '@/features/theme/useScrollClearance'

type Props = {
  model: ArtistScreenModel
}

type ArtistContentItem =
  | { kind: 'mostPlayed'; id: string }
  | { kind: 'topSongs'; id: string }
  | { kind: 'popularTracks'; id: string }
  | { kind: 'section'; id: string; title: string }
  | { kind: 'localAlbum'; id: string; album: Album }
  | { kind: 'externalAlbum'; id: string; album: Album }
  | { kind: 'showMore'; id: string; target: 'albums' | 'singles'; remaining: number }
  | { kind: 'showUnowned'; id: string; target: 'albums' | 'singles'; count: number }
  | { kind: 'similar'; id: string }
  | { kind: 'bio'; id: string }

/**
 * The item kinds that are blocks rather than rows.
 *
 * Each carries a horizontal shelf or a paragraph of its own and spans the
 * window; everything else in this list is an album row, and rows are capped.
 */
const ARTIST_FULL_BLEED = new Set<ArtistContentItem['kind']>([
  'mostPlayed', 'topSongs', 'popularTracks', 'bio', 'similar',
])

const INITIAL_RELEASE_ROWS = 3

export default function ArtistContent({ model }: Props) {
  const scrollClearance = useScrollClearance()
  const icons = useIconSize();
  const { listInset, fullBleed } = useContentInset()
  const navigation = useNavigation<any>()
  // The params that identify this artist, forwarded so the releases list
  // resolves the same one rather than being handed a name to look up again.
  const { params: routeParams } = useRoute<any>()
  const { navigateToAlbum } = useMatchedNavigation()
  const { colors } = useTheme()
  const rad = useRadius()
  const { t } = useTranslation()
  // Fixed, now that the overflow opens a list rather than growing this one.
  const visibleAlbumsCount = INITIAL_RELEASE_ROWS
  const visibleSinglesCount = INITIAL_RELEASE_ROWS
  const [showUnownedAlbums, setShowUnownedAlbums] = useState(false)
  const [showUnownedSingles, setShowUnownedSingles] = useState(false)

  const { artist, isLocal, discography } = model
  const { ownedAlbums, ownedSingles, unownedAlbums, unownedSingles } = discography

  const items = useMemo<ArtistContentItem[]>(() => {
    const rows: ArtistContentItem[] = []
    if (!artist) return rows

    if (isLocal) {
      rows.push({ kind: 'mostPlayed', id: 'most-played' })
      rows.push({ kind: 'topSongs', id: 'server-top-songs' })
      rows.push({ kind: 'popularTracks', id: 'popular-tracks' })

      const ownedAlbumItems: ArtistContentItem[] = ownedAlbums.map(album => ({ kind: 'localAlbum' as const, id: `album-${album.localId}`, album }))
      const ownedSingleItems: ArtistContentItem[] = ownedSingles.map(album => ({ kind: 'localAlbum' as const, id: `single-${album.localId}`, album }))
      const unownedAlbumItems: ArtistContentItem[] = unownedAlbums.map(album => ({ kind: 'externalAlbum' as const, id: `album-ext-${album.localId}`, album }))
      const unownedSingleItems: ArtistContentItem[] = unownedSingles.map(album => ({ kind: 'externalAlbum' as const, id: `single-ext-${album.localId}`, album }))

      // Owned and unowned releases are kept in separate groups rather than
      // merged chronologically — unowned releases stay behind a "show
      // unowned" tile until the user opts in, so scanning what you actually
      // own isn't interrupted by releases you don't have.
      if (ownedAlbumItems.length > 0 || unownedAlbumItems.length > 0) {
        rows.push({ kind: 'section', id: 'albums-section', title: t('artist.sections.albums') })
        rows.push(...ownedAlbumItems.slice(0, visibleAlbumsCount))
        if (visibleAlbumsCount < ownedAlbumItems.length) {
          rows.push({ kind: 'showMore', id: 'show-more-albums', target: 'albums', remaining: ownedAlbumItems.length - visibleAlbumsCount })
        } else if (unownedAlbumItems.length > 0) {
          if (showUnownedAlbums) {
            rows.push(...unownedAlbumItems)
          } else {
            rows.push({ kind: 'showUnowned', id: 'show-unowned-albums', target: 'albums', count: unownedAlbumItems.length })
          }
        }
      }

      if (ownedSingleItems.length > 0 || unownedSingleItems.length > 0) {
        rows.push({ kind: 'section', id: 'singles-section', title: t('artist.sections.singles') })
        rows.push(...ownedSingleItems.slice(0, visibleSinglesCount))
        if (visibleSinglesCount < ownedSingleItems.length) {
          rows.push({ kind: 'showMore', id: 'show-more-singles', target: 'singles', remaining: ownedSingleItems.length - visibleSinglesCount })
        } else if (unownedSingleItems.length > 0) {
          if (showUnownedSingles) {
            rows.push(...unownedSingleItems)
          } else {
            rows.push({ kind: 'showUnowned', id: 'show-unowned-singles', target: 'singles', count: unownedSingleItems.length })
          }
        }
      }

      rows.push({ kind: 'similar', id: 'similar-artists' })
      rows.push({ kind: 'bio', id: 'bio' })
    } else {
      rows.push({ kind: 'popularTracks', id: 'popular-tracks' })

      const visibleAlbums = unownedAlbums.slice(0, visibleAlbumsCount)
      if (unownedAlbums.length > 0) {
        rows.push({ kind: 'section', id: 'albums-section', title: t('artist.sections.albums') })
        rows.push(...visibleAlbums.map(album => ({ kind: 'externalAlbum' as const, id: `album-${album.localId}`, album })))
        if (visibleAlbumsCount < unownedAlbums.length) {
          rows.push({ kind: 'showMore', id: 'show-more-albums', target: 'albums', remaining: unownedAlbums.length - visibleAlbumsCount })
        }
      }

      if (unownedSingles.length > 0) {
        rows.push({ kind: 'section', id: 'singles-section', title: t('artist.sections.singles') })
        const visibleSingles = unownedSingles.slice(0, visibleSinglesCount)
        rows.push(...visibleSingles.map(album => ({ kind: 'externalAlbum' as const, id: `single-${album.localId}`, album })))
        if (visibleSinglesCount < unownedSingles.length) {
          rows.push({ kind: 'showMore', id: 'show-more-singles', target: 'singles', remaining: unownedSingles.length - visibleSinglesCount })
        }
      }

      if (model.similarArtists.length > 0) {
        rows.push({ kind: 'similar', id: 'similar-artists' })
      }
      rows.push({ kind: 'bio', id: 'bio' })
    }

    return rows
  }, [artist, isLocal, ownedAlbums, ownedSingles, unownedAlbums, unownedSingles, model.similarArtists, visibleAlbumsCount, visibleSinglesCount, showUnownedAlbums, showUnownedSingles, t])

  const renderContent = useCallback((item: ArtistContentItem) => {
    if (item.kind === 'mostPlayed') {
      return artist ? <MostPlayedSection artist={artist} /> : null
    }

    if (item.kind === 'topSongs') {
      return artist ? <TopSongsSection artist={artist} /> : null
    }

    if (item.kind === 'popularTracks') {
      if (!artist) return null
      return isLocal
        ? <LocalPopularTracksSection artist={artist} />
        : <PopularTracksSection topTracks={model.topTracks} artistId={artist.nativeId} artistName={artist.name} />
    }

    if (item.kind === 'bio') {
      return <ArtistBio model={model} />
    }

    if (item.kind === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            {item.title}
          </Text>
        </View>
      )
    }

    if (item.kind === 'similar') {
      return isLocal && artist
        ? <LocalSimilarArtistsSection artist={artist} />
        : <ExternalSimilarArtistsSection similarArtists={model.similarArtists} />
    }

    // Same tile-row look for both: "keep reading the list" (showMore) and
    // "opt into releases you don't own" (showUnowned) are both progressive
    // disclosure of more rows, just with different icon/copy/trigger.
    if (item.kind === 'showMore' || item.kind === 'showUnowned') {
      const isUnowned = item.kind === 'showUnowned'
      return (
        <Touchable
          style={styles.showMoreRow}
          onPress={() => {
            if (isUnowned) {
              if (item.target === 'albums') setShowUnownedAlbums(true)
              else setShowUnownedSingles(true)
              return
            }
            // The rest of a discography is a list, not another five rows.
            // Growing in place meant eight taps to reach the end of a
            // prolific artist, and no way to sort what you finally had.
            navigation.push('artistReleasesView', {
              ...routeParams,
              group: item.target,
              scope: isLocal ? 'owned' : 'external',
            })
          }}
        >
          <View style={[styles.showMoreIcon, { backgroundColor: colors.card, borderRadius: rad.thumb }]}>
            {isUnowned
              ? <Globe size={icons.row} color={colors.secondary} />
              : <Ellipsis size={icons.row} color={colors.secondary} />
            }
          </View>
          <Text style={[styles.showMoreText, { color: colors.secondary }]}>
            {isUnowned ? t('artist.showUnowned', { count: item.count }) : t('artist.showMore', { count: item.remaining })}
          </Text>
        </Touchable>
      )
    }

    if (item.kind === 'localAlbum') {
      return (
        <AlbumRow
          album={item.album}
          onPress={() => navigation.push('albumView', { id: item.album.nativeId })}
          subtextOverride={releaseYearLabel(item.album) ?? undefined}
        />
      )
    }

    return (
      <AlbumRow
        album={item.album}
        onPress={(album) => navigateToAlbum(album)}
        subtextOverride={releaseYearLabel(item.album) ?? undefined}
      />
    )
  }, [colors, rad.thumb, artist, isLocal, model, navigation, navigateToAlbum, routeParams, setShowUnownedAlbums, setShowUnownedSingles, t, icons])

  // The list is mostly a column of album rows, so it is capped and centred
  // like every other column of rows — but five of its item kinds are not
  // rows at all: they are blocks with their own horizontal shelves inside,
  // and those span the window. Same pair of numbers as the library gutter,
  // applied per item because here the two kinds are interleaved rather than
  // split into a header and a body.
  const renderItem = useCallback(({ item }: { item: ArtistContentItem }) => {
    const content = renderContent(item)
    if (!ARTIST_FULL_BLEED.has(item.kind) || content === null) return content
    return <View style={fullBleed}>{content}</View>
  }, [renderContent, fullBleed])

  return (
    <DetailScreen bar={<ArtistHeaderBar model={model} />}>
      {scroll => (
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={fullBleed}>
            <Header model={model} showNavigation={false} />
          </View>
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: scrollClearance,
          backgroundColor: colors.background,
          ...listInset,
        }}
        {...scroll}
      />
      )}
    </DetailScreen>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.controlGap,
  },
  sectionTitle: {
    ...typography.navigationTitle,
    paddingHorizontal: spacing.lg,
  },
  showMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  showMoreIcon: {
    width: 64,
    height: 64,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreText: {
    ...typography.button,
  },
})
