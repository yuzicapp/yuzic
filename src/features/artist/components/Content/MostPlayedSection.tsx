import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { useSelector } from 'react-redux'
import { useTheme } from '@/features/theme/useTheme'
import { useTranslation } from 'react-i18next'
import { notify } from '@/components/toast';
import { selectSongPlayCounts } from '@/state/redux/selectors/statsSelectors'
import { useTracks } from '@/features/song/useTracks';
import { usePlayingActions } from '@/features/playback/PlayingContext'
import { usePlayableSongResolver } from '@/features/song/usePlayableSongResolver';
import { useCatalogStore } from '@/features/library/useCatalogStore'
import TopTrackRow from '@/components/rows/TopTrackRow'
import { rankMostPlayedTracks } from './mostPlayed'
import type { Artist } from '@/domain/entities/Artist'
import { spacing, typography } from '@/constants/design'
import { MAX_TRACK_ROWS, ShowMoreTracks, visibleTrackRows } from './trackSection'

type Props = {
  artist: Artist
}

// Your own listening history for this artist — a different claim from
// PopularTracksSection's chart data, so it's a separate, separately-labeled
// section rather than a merged sub-group.
export default function MostPlayedSection({ artist }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { tracks } = useTracks()
  const store = useCatalogStore()
  const playCounts = useSelector(selectSongPlayCounts)
  const { playSong } = usePlayingActions()
  const { resolvePlayableSong } = usePlayableSongResolver()
  const [showAll, setShowAll] = useState(false)

  // `rankMostPlayedTracks` works over a generic `{ id, artistId }` shape —
  // play counts are keyed by nativeId (server-scoped), so that's what feeds
  // it, not the domain identity.
  const playCountTracks = tracks.map(track => ({ id: track.nativeId, artistId: track.artist.nativeId }))
  const ranked = rankMostPlayedTracks(playCountTracks, playCounts, artist.nativeId).slice(0, MAX_TRACK_ROWS)
  if (ranked.length === 0) return null
  const visible = ranked.slice(0, visibleTrackRows(ranked.length, showAll))

  // The store's index rather than one built here: this used to index every
  // track in the library on every render of every artist screen, to read back
  // the handful of rows `ranked` names. It is indexed once for the app now.
  const tracksByNativeId = store.songByNativeId

  const handlePress = async (nativeId: string) => {
    try {
      const resource = await resolvePlayableSong(nativeId);
      if (resource) await playSong(resource.song);
    } catch {
      notify.error(t('common.playbackError'));
    }
  }

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
          {t('artist.sections.mostPlayed')}
        </Text>
      </View>
      {visible.map((ranking, index) => {
        const track = tracksByNativeId.get(ranking.id);
        if (!track) return null;
        return (
          <TopTrackRow
            key={track.localId}
            song={track}
            index={index}
            artistName={artist.name}
            onPress={() => { void handlePress(track.nativeId); }}
          />
        );
      })}
      <ShowMoreTracks total={ranked.length} expanded={showAll} onToggle={() => setShowAll(v => !v)} />
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.controlGap,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...typography.navigationTitle,
  },
})
