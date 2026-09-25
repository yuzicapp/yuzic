import React, { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notify } from '@/components/toast';

import { useApi } from '@/providers/registry/useApi'
import { QueryKeys } from '@/state/query/queryKeys'
import { MAX_TRACK_ROWS, ShowMoreTracks, visibleTrackRows } from './trackSection'
import { useTheme } from '@/features/theme/useTheme'
import { usePlayingActions } from '@/features/playback/PlayingContext'
import { usePlayableSongResolver } from '@/features/song/usePlayableSongResolver';
import TopTrackRow from '@/components/rows/TopTrackRow'
import { spacing, typography } from '@/constants/design'
import type { Artist } from '@/domain/entities/Artist'

const TOP_SONG_LIMIT = MAX_TRACK_ROWS

type Props = {
  artist: Artist
}

/**
 * The server's own ranking of an artist's songs.
 *
 * A third claim about popularity, and deliberately its own section like the
 * two beside it: MostPlayed is what *you* have played, Popular on Deezer is a
 * chart from an external service, and this is what the server says — Subsonic
 * backs `getTopSongs` with Last.fm playcounts, so it is the world's ranking of
 * the records you actually own.
 *
 * It earns its place because the other two can both be empty: MostPlayed shows
 * nothing until you have played something, and Deezer is an outside service
 * that waits to be asked. On a fresh install against a Navidrome server this
 * is the only popularity the artist page can show, and it needs nothing turned
 * on to work.
 */
export default function TopSongsSection({ artist }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const api = useApi()
  const { playSong } = usePlayingActions()
  const { resolvePlayableSong } = usePlayableSongResolver()

  const [showAll, setShowAll] = useState(false)

  const getTopSongs = api.artists.getTopSongs

  const { data: songs } = useQuery({
    queryKey: [QueryKeys.ServerArtistTopSongs, artist.name],
    // Navidrome only today; the Jellyfin adapter does not implement it, so the
    // section hides itself there rather than showing an empty shelf.
    enabled: Boolean(getTopSongs) && !!artist.name,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => (await getTopSongs?.(artist.name, TOP_SONG_LIMIT)) ?? [],
  })

  const handlePress = useCallback(async (nativeId: string) => {
    try {
      const resource = await resolvePlayableSong(nativeId)
      if (resource) await playSong(resource.song)
    } catch {
      notify.error(t('common.playbackError'))
    }
  }, [resolvePlayableSong, playSong, t])

  if (!songs?.length) return null

  const visible = songs.slice(0, visibleTrackRows(songs.length, showAll))

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
          {t('artist.sections.topSongs')}
        </Text>
      </View>
      {visible.map((song, index) => (
        <TopTrackRow
          key={song.localId}
          song={song}
          index={index}
          artistName={artist.name}
          onPress={() => void handlePress(song.nativeId)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...typography.sectionTitle },
})
