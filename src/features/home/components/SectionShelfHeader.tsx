import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { ChevronRight } from 'lucide-react-native'

import { useTheme } from '@/features/theme/useTheme'
import { iconSize, spacing } from '@/constants/design'
import { sectionStyles } from './sectionStyles'
import Touchable from '@/components/Touchable'

type Props = {
  title: string
  /** Where the whole shelf lives in full. Given one, the title becomes the way
   * through to it; without one it stays a plain heading. */
  onSeeAll?: () => void
  seeAllLabel?: string
  testID?: string
}

/**
 * A shelf's title, optionally a way through to the complete list.
 *
 * A Home shelf shows the first handful of something and then stops. Where the
 * same thing has a screen of its own — recently added has one in the Library
 * tab — the heading points at it, so the shelf ends somewhere instead of at an
 * arbitrary tenth album.
 */
export default function SectionShelfHeader({ title, onSeeAll, seeAllLabel, testID }: Props) {
  const { colors } = useTheme()

  const heading = (
    <Text style={[sectionStyles.title, styles.title, { color: colors.secondary }]}>
      {title}
    </Text>
  )

  if (!onSeeAll) return heading

  return (
    <Touchable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={seeAllLabel ?? title}
      onPress={onSeeAll}
      style={styles.row}
    >
      {heading}
      <View style={styles.chevron}>
        <ChevronRight size={iconSize.control} color={colors.subtext} />
      </View>
    </Touchable>
  )
}

const styles = StyleSheet.create({
  // Only as wide as the title and its chevron: a full-width row would make the
  // empty space beside the heading navigate, which nothing signals.
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  // The shared title style carries the shelf's own left inset and bottom gap;
  // only the flexing is new, so the tappable heading sits exactly where the
  // plain ones do.
  title: { flexShrink: 1 },
  chevron: {
    marginLeft: spacing.xs,
    marginBottom: spacing.md,
  },
})
