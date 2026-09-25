import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import Touchable from '@/components/Touchable'
import { controlSize, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'
import { useTheme } from '@/features/theme/useTheme'

/**
 * How the artist screen's three track sections agree to behave.
 *
 * Most Played, the server's Top songs and the catalogue's Popular tracks each
 * answer "what of this artist's work matters", from your own history, your
 * server's counts and an outside chart. They had three different ideas about
 * how many to show: ten with no way past it, five fixed at fetch time, and
 * five opening to ten. Only the last one was deliberate.
 *
 * Five, opening to ten. A chart's value tails off fast — nobody is looking for
 * an artist's fiftieth most played track — so this is a peek that can be
 * doubled, not a list. The discography is the thing long enough to deserve a
 * screen of its own (`ArtistReleasesScreen`).
 */
export const COLLAPSED_TRACK_ROWS = 5
export const MAX_TRACK_ROWS = 10

/** How many of `count` rows to draw, given whether the section is open. */
export const visibleTrackRows = (count: number, expanded: boolean): number =>
  Math.min(count, expanded ? MAX_TRACK_ROWS : COLLAPSED_TRACK_ROWS)

/** Shown only when there is something left to show. */
export const ShowMoreTracks: React.FC<{
  total: number
  expanded: boolean
  onToggle: () => void
}> = ({ total, expanded, onToggle }) => {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const rad = useRadius()

  if (Math.min(total, MAX_TRACK_ROWS) <= COLLAPSED_TRACK_ROWS) return null

  return (
    <View style={styles.toggleRow}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={expanded ? t('common.less') : t('common.more')}
        style={[styles.toggleButton, { backgroundColor: colors.card, borderRadius: rad.pillFor(controlSize.inlineControl) }]}
        onPress={onToggle}
      >
        <Text style={[styles.toggleText, { color: colors.secondary }]}>
          {expanded ? t('common.less') : t('common.more')}
        </Text>
      </Touchable>
    </View>
  )
}

const styles = StyleSheet.create({
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
