import React, { memo, useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ellipsis, Play } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import MediaListRow from '@/components/MediaListRow'
import { useTheme } from '@/features/theme/useTheme'
import { formatDuration, formatSongDuration } from '@/components/formatDuration'
import type { Song } from '@/domain/entities/Song'
import Touchable from '@/components/Touchable'
import SongOptions from '@/components/options/SongOptions'
import { useSheetRef } from '@/components/useSheetRef'
import { useSongActionSheets } from '@/features/entity-actions/SongActionSheetContext'
import { hitSlopFor, iconSize, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'

/** The preview affordance on an external top-track row, drawn small on purpose
 *  — it sits inside a row rather than beside one. `hitSlopFor` pads it out. */
const PREVIEW_BUTTON_SIZE = 28

type TopTrackRowSong = Song

/**
 * True when `song` came from an external catalog (Deezer/etc) rather than
 * the user's library — read off `provenance`, same discriminator as
 * `SongRow`/`SongOptions`.
 */
function isExternalTrack(song: TopTrackRowSong): boolean {
  return song.provenance.origin === 'integration'
}

type Props = {
  song: TopTrackRowSong
  index: number
  artistName: string
  onPress?: () => void
}

function TopTrackRow({ song, index, artistName, onPress }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()
  const external = isExternalTrack(song)
  const optionsSheetRef = useSheetRef()
  const [externalOptionsMounted, setExternalOptionsMounted] = useState(false)
  // A library track goes through the app-wide song sheet — the one that also
  // carries "Add to playlist". A browsed one has no such sheet to reach and
  // needs its album context, so it mounts its own, exactly as `SongRow` does.
  const { openSongOptions } = useSongActionSheets()

  const handleOptions = useCallback(() => {
    if (!external) {
      openSongOptions(song)
      return
    }
    if (!externalOptionsMounted) {
      setExternalOptionsMounted(true)
      requestAnimationFrame(() => optionsSheetRef.current?.present())
      return
    }
    optionsSheetRef.current?.present()
  }, [external, externalOptionsMounted, openSongOptions, optionsSheetRef, song])
  // `formatSongDuration` hides a zero/unknown duration entirely rather than
  // showing "0:00" — correct for a preview track (`durationSeconds` doc:
  // "Zero for content with no known duration"), which is what every
  // external track here is. A library song always has a real duration, so
  // it keeps the plain formatter.
  const duration = external ? formatSongDuration(song.durationSeconds) : formatDuration(song.durationSeconds)
  // Only an external (preview) track carries a 30s clip URL, attached onto
  // `streamId` once resolved — see `Song.streamId` and `usePreviewPlayer`'s
  // `attachPreviewUrl`. A library song is already fully playable, so it has
  // nothing to preview and no button.
  const previewUrl = external ? song.streamId : undefined

  return (
    <>
      <MediaListRow
        title={song.title}
        subtitle={[artistName, duration].filter(Boolean).join(' • ')}
        cover={song.cover}
        onPress={onPress}
        variant="compact"
        leading={
          <Text style={[styles.trackIndex, { color: colors.subtext }]}>
            {index + 1}
          </Text>
        }
        trailing={
          // The top-track rows were the one song row in the app with nothing
          // behind a "…" — on the artist screen's Most Played, Top Songs and
          // popular-tracks sections alike.
          <View style={styles.trailing}>
            {previewUrl ? (
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={t('a11y.topTrack.playPreview', { title: song.title })}
                style={[styles.previewButton, { backgroundColor: colors.card, borderRadius: rad.pillFor(PREVIEW_BUTTON_SIZE) }]}
                onPress={onPress}
                disabled={!onPress}
                hitSlop={hitSlopFor(iconSize.badge)}
              >
                <Play size={iconSize.badge} color={colors.secondary} fill={colors.secondary} />
              </Touchable>
            ) : null}
            <Touchable
              testID="top-track-options"
              accessibilityRole="button"
              accessibilityLabel={t('a11y.rows.options', { title: song.title })}
              onPress={handleOptions}
              hitSlop={hitSlopFor(iconSize.row)}
              feedback="control"
            >
              <Ellipsis size={iconSize.row} color={colors.subtext} />
            </Touchable>
          </View>
        }
      />

      {externalOptionsMounted && (
        <SongOptions
          ref={optionsSheetRef}
          selectedSong={song}
          albumTitle={song.album.title}
          albumArtist={artistName}
          onPlay={previewUrl ? onPress : undefined}
        />
      )}
    </>
  )
}

export default memo(TopTrackRow)

const styles = StyleSheet.create({
  trackIndex: {
    ...typography.caption,
    width: 16,
    textAlign: 'left',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.inlineGap,
  },
  previewButton: {
    width: PREVIEW_BUTTON_SIZE,
    height: PREVIEW_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
