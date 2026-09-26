import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { useTheme } from '@/features/theme/useTheme'
import { useTranslation } from 'react-i18next'
import Touchable from '@/components/Touchable'
import { spacing, typography } from '@/constants/design'

type Props = {
  biography?: string
  /** The artist's tags — its server's genres, or a Metadata source's tags. */
  tags?: string[]
  /**
   * Set only when `biography` came from a Metadata › Artist info source
   * rather than the artist's own record — draws a small unobtrusive source
   * line under the bio ("via Last.fm"), never a persistent per-item badge.
   * Display-only: this has no bearing on whether the bio is shown, only on
   * how it's credited.
   */
  enrichedSourceLabel?: string | null
}

/** Enough tags to say what an artist sounds like without becoming a list. */
const MAX_TAGS = 6

export default function BioSection({ biography, tags, enrichedSourceLabel }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const shownTags = (tags ?? []).slice(0, MAX_TAGS)

  if (!biography && shownTags.length === 0) return null

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
          {t('artist.sections.bio')}
        </Text>
      </View>
      {shownTags.length > 0 && (
        <Text style={[styles.tags, { color: colors.subtext }]} numberOfLines={1}>
          {shownTags.join(' · ')}
        </Text>
      )}
      {biography ? (
        <Touchable
          style={styles.bioContainer}
          onPress={() => setExpanded(e => !e)}
        >
          <Text
            style={[styles.bioText, { color: colors.subtext }]}
            numberOfLines={expanded ? undefined : 3}
          >
            {biography}
          </Text>
          <Text style={[styles.bioToggle, { color: colors.subtext }]}>
            {expanded ? t('common.less') : t('common.more')}
          </Text>
          {enrichedSourceLabel && (
            <Text style={[styles.sourceLine, { color: colors.subtext }]}>
              {t('artist.enrichedBioSource', { source: enrichedSourceLabel })}
            </Text>
          )}
        </Touchable>
      ) : null}
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
  tags: {
    ...typography.caption,
    fontWeight: '500',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  bioContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  bioText: {
    ...typography.rowSubtitle,
  },
  bioToggle: {
    ...typography.caption,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  sourceLine: {
    ...typography.micro,
    marginTop: spacing.xxs,
  },
})
