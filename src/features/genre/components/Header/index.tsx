import { controlSize, coverFade, iconSize, onDark, shade, spacing, typography, veil } from '@/constants/design';
import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { View, StyleSheet, Platform } from 'react-native'
import { Text } from '@/components/Text'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft, Ellipsis, Shuffle, Play } from 'lucide-react-native'
import TurboImage from 'react-native-turbo-image'
import { useSelector } from 'react-redux'
import { notify } from '@/components/toast';
import { useTranslation } from 'react-i18next'

import type { Album } from '@/domain/entities/Album'
import type { Song } from '@/domain/entities/Song'
import { useApi } from '@/providers/registry/useApi'
import { fetchAlbumSongsSettled } from '@/components/options/useLazyCollectionDetails'
import { buildCover } from '@/providers/registry/covers'
import { useTheme } from '@/features/theme/useTheme'
import { useTracks } from '@/features/song/useTracks';
import { usePlayingActions } from '@/features/playback/PlayingContext'
import { useDownload } from '@/features/offline/DownloadContext'
import { useSheetRef } from '@/components/useSheetRef'
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors'
import {
  DetailActionRow,
  DetailCircleAction,
  DetailPlayAction,
  DetailHeaderBar,
  DetailHeaderIconButton,
  useDetailHeaderInset,
  useDetailHeroTitleLayout,
} from '@/components/DetailHeader'
import GenreOptions from '@/components/options/GenreOptions'
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import DownloadStateIcon from '@/components/DownloadStateIcon';
import { useCollectionDownloadProgress } from '@/features/downloads/useCollectionDownloadProgress';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  genre: string
  albums: Album[]
  showNavigation?: boolean
}

const GenreHeader: React.FC<Props> = ({ genre, albums, showNavigation = true }) => {
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const api = useApi()
  const { isDarkMode, colors } = useTheme()
  const rad = useRadius()
  const activeServer = useSelector(selectActiveServer)
  const { playSongs } = usePlayingActions()
  const { downloadAlbumById, getCollectionDownloadState } = useDownload()
  const { t } = useTranslation()

  // The bar floats over this art now, so the wrapper grows by exactly the room
  // it and the status bar take: the content below stays put and the extra strip
  // at the top is filled with art rather than a band.
  const barInset = useDetailHeaderInset()
  const onTitleLayout = useDetailHeroTitleLayout()

  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [songsLoading, setSongsLoading] = useState(false)
  const { tracks } = useTracks()

  const coverUri = albums[0]?.cover ? buildCover(albums[0].cover, 'background') : null

  // Membership is an equality check between loaded entities, so it compares
  // `localId` — never the origin id, which two different origins could
  // coincidentally share.
  const albumIds = useMemo(
    () => new Set(albums.map(album => album.localId)),
    [albums]
  )
  // Download tracking (getCollectionDownloadState/useCollectionDownloadProgress)
  // keys tracks by `localId` too — see DownloadContext's `performDownloadTrack`.
  const genreTrackIds = useMemo(
    () => tracks
      .filter(track => albumIds.has(track.album.localId))
      .map(track => track.localId),
    [albumIds, tracks]
  )

  const {
    isDownloaded: isFullyDownloaded,
    isDownloading,
  } = getCollectionDownloadState(genreTrackIds)
  const downloadFraction = useCollectionDownloadProgress(genreTrackIds)

  const fetchGenreSongs = async (): Promise<Song[]> => {
    if (!activeServer?.id || !albums.length) return []

    return fetchAlbumSongsSettled({
      queryClient,
      serverId: activeServer.id,
      albums,
      getAlbum: api.albums.get,
    })
  }

  // A genre shelf isn't a real collection (no server-side playlist backs
  // it), so this plays a plain song list rather than fabricating a
  // `PlaylistDetail` for something with no identity of its own — same
  // pattern as the library's "all tracks" and local-mix shuffles.
  const play = async (shuffle = false) => {
    if (songsLoading) return

    const playableSongs = await (async () => {
      setSongsLoading(true)
      try {
        return await fetchGenreSongs()
      } catch {
        return []
      } finally {
        setSongsLoading(false)
      }
    })()

    if (!playableSongs.length) {
      notify.error(t('common.oneSecond'))
      return
    }
    await playSongs(playableSongs, { shuffle, contextId: `genre:${genre}` })
  }

  const handleDownloadAll = async () => {
    if (isDownloadingAll || isDownloading || isFullyDownloaded || !albums.length) return
    setIsDownloadingAll(true)
    try {
      await Promise.all(albums.map(album => downloadAlbumById(album.nativeId)))
    } finally {
      setIsDownloadingAll(false)
    }
  }

  return (
    <>
      <View style={[styles.fullBleedWrapper, { height: GENRE_HERO_HEIGHT + barInset }]}>
        {coverUri && (
          <TurboImage
            source={{ uri: coverUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blur={Platform.OS === 'ios' ? 20 : 10}
            fadeDuration={300}
            cachePolicy="dataCache"
          />
        )}

        <LinearGradient
          colors={
            isDarkMode
              ? coverFade.onDark
              : coverFade.onLight
          }
          style={StyleSheet.absoluteFill}
        />

        {showNavigation && (
          // The hero carries the same pair as every other detail hero: back on
          // the left, "…" on the right. The genre's options were reachable only
          // once the bar had faded in, which is after the hero has scrolled
          // away — so on arrival the screen had none.
          <View style={styles.header}>
            <Touchable
              testID="detail-back-button"
              accessibilityRole="button"
              accessibilityLabel={t('a11y.common.back')}
              style={[styles.backButton, { borderRadius: rad.pillFor(controlSize.iconCompact) }]}
              onPress={() => navigation.goBack()}
            >
              <ChevronLeft size={iconSize.header} color={onDark.text} style={{ marginLeft: -2 }} />
            </Touchable>
            <GenreOptionsButton genre={genre} albums={albums} />
          </View>
        )}
      </View>

      <View style={styles.content} onLayout={onTitleLayout}>
        <Text style={[styles.genreName, { color: colors.secondary }]}>
          {genre}
        </Text>
        <Text style={[styles.subtext, { color: colors.subtext }]}>
          {albums.length} {albums.length === 1 ? 'album' : 'albums'}
        </Text>
      </View>

      <DetailActionRow style={styles.buttonRow}>
        <DetailCircleAction
          onPress={() => { void play(true) }}
          disabled={songsLoading}
          style={isDarkMode ? styles.secondaryButtonDark : styles.secondaryButton}
          accessibilityLabel={t('a11y.detail.shuffle')}
        >
          {songsLoading ? (
            <SpinningLoaderCircle size={iconSize.row} color={colors.secondary} />
          ) : (
            <Shuffle size={iconSize.row} color={colors.secondary} />
          )}
        </DetailCircleAction>

        <DetailPlayAction
          onPress={() => { void play(false) }}
          disabled={songsLoading}
          accessibilityLabel={t('a11y.detail.play')}
        >
          {songsLoading ? (
            <SpinningLoaderCircle size={iconSize.row} color={colors.onThemeColor} />
          ) : (
            <Play size={iconSize.header} color={colors.onThemeColor} fill={colors.onThemeColor} />
          )}
        </DetailPlayAction>

        <DetailCircleAction
          onPress={() => { void handleDownloadAll() }}
          disabled={isDownloadingAll || isDownloading}
          style={isDarkMode ? styles.secondaryButtonDark : styles.secondaryButton}
          accessibilityLabel={t(
            isDownloadingAll || isDownloading
              ? 'a11y.detail.downloading'
              : isFullyDownloaded
                ? 'a11y.detail.downloaded'
                : 'a11y.detail.download'
          )}
        >
          <DownloadStateIcon
            isDownloaded={isFullyDownloaded}
            isDownloading={isDownloadingAll || isDownloading}
            // While `handleDownloadAll` is still enqueueing albums there is
            // nothing to measure yet, so the spinner stands in until the
            // tracks themselves start reporting.
            progress={isDownloadingAll ? undefined : downloadFraction}
            color={colors.secondary}
          />
        </DetailCircleAction>
      </DetailActionRow>
    </>
  )
}

export const GenreHeaderBar: React.FC<Props> = ({ genre, albums }) => (
  <DetailHeaderBar title={genre} rightAction={<GenreOptionsButton genre={genre} albums={albums} />} />
)

function GenreOptionsButton({ genre, albums }: { genre: string; albums: Album[] }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const optionsSheetRef = useSheetRef()
  return (
    <>
      <DetailHeaderIconButton
        accessibilityLabel={t('a11y.common.moreOptions')}
        onPress={() => optionsSheetRef.current?.present()}
      >
        <Ellipsis size={iconSize.header} color={colors.secondary} />
      </DetailHeaderIconButton>
      <GenreOptions ref={optionsSheetRef} genre={genre} albums={albums} />
    </>
  )
}

export default GenreHeader

/** The blurred cover behind a genre's name, before the floating bar's inset. */
const GENRE_HERO_HEIGHT = 220;

const styles = StyleSheet.create({
  fullBleedWrapper: {
    width: '100%',
    height: GENRE_HERO_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 20,
  },
  backButton: {
    padding: spacing.tight,
    backgroundColor: shade.scrim,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  genreName: {
    ...typography.display,
    textAlign: 'center',
  },
  subtext: {
    ...typography.rowSubtitle,
    marginTop: spacing.tight,
  },
  buttonRow: {
    marginBottom: spacing.xl,
  },
  secondaryButton: {
    backgroundColor: shade.tint,
  },
  secondaryButtonDark: {
    backgroundColor: veil.tint,
  },
})
