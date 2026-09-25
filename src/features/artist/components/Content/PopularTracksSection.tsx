import { onDark, spacing, typography } from '@/constants/design';
import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSelector } from 'react-redux'
import { useTheme } from '@/features/theme/useTheme'
import { useTranslation } from 'react-i18next'
import { selectShowSourceHeaders } from '@/features/settings/appearance/state';
import { usePreviewPlayer } from '@/features/playback/usePreviewPlayer'
import TopTrackRow from '@/components/rows/TopTrackRow'
import type { Song } from '@/domain/entities/Song'
import { useRadius } from '@/features/theme/useRadius'
import { MAX_TRACK_ROWS, ShowMoreTracks, visibleTrackRows } from './trackSection'
import { ARTIST_CATALOGUE } from '@/providers/registry/artistSources'

type Props = {
  topTracks: Song[]
  artistId: string
  artistName: string
}

// The catalogue's chart popularity for this artist — a different claim from
// MostPlayedSection's personal listening history, so they're separate,
// separately-labeled sections rather than merged sub-groups.
export default function PopularTracksSection({ topTracks, artistId, artistName }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const rad = useRadius()
  const showSourceHeaders = useSelector(selectShowSourceHeaders)
  const { toggleInAlbum } = usePreviewPlayer()
  const [showAll, setShowAll] = useState(false)

  if (topTracks.length === 0) return null

  const allTracks = topTracks.slice(0, MAX_TRACK_ROWS)
  const visible = allTracks.slice(0, visibleTrackRows(allTracks.length, showAll))

  // `streamId` carries a resolved preview URL — see `Song.streamId` and
  // `usePreviewPlayer`'s `attachPreviewUrl`.
  const trackQueue = topTracks.filter(s => !!s.streamId)

  return (
    <View>
      <View style={styles.sectionHeader}>
        {showSourceHeaders && (
          <View style={[styles.badge, { backgroundColor: ARTIST_CATALOGUE.badge.color, borderRadius: rad.pill }]}>
            <Text style={styles.badgeLetter}>{ARTIST_CATALOGUE.badge.letter}</Text>
          </View>
        )}
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
          {t(ARTIST_CATALOGUE.popularTracksTitleKey)}
        </Text>
      </View>
      {visible.map((song, index) => (
        <TopTrackRow
          key={song.localId}
          song={song}
          index={index}
          artistName={artistName}
          onPress={song.streamId
            ? () => toggleInAlbum(song, song.streamId!, trackQueue, artistId, artistName)
            : undefined}
        />
      ))}
      <ShowMoreTracks total={allTracks.length} expanded={showAll} onToggle={() => setShowAll(v => !v)} />
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.controlGap,
    paddingHorizontal: spacing.lg,
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
  sectionTitle: {
    ...typography.navigationTitle,
    paddingHorizontal: 0,
  },
  toggleRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toggleButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  toggleText: {
    ...typography.rowSubtitle,
    fontWeight: '500',
  },
})
