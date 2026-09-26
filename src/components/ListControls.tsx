import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/Text'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, Grid2x2, List, ListFilter } from 'lucide-react-native'

import Touchable from '@/components/Touchable'
import { controlSize, hitSlopFor, iconSize, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'
import { useTheme } from '@/features/theme/useTheme'

/**
 * The row of controls above a list: how it is ordered, what it is filtered
 * to, and whether it is drawn as rows or as a grid.
 *
 * Lifted out of `LibraryList` so a screen that is not a library collection
 * can wear the same controls. `LibraryList` is typed to `LibraryItem` —
 * albums, artists, playlists and tracks — so Wants and Radio could not reach
 * it without pretending a station is one of those. The controls are not the
 * part that cared what the items were; the list is.
 *
 * Sort and filter are both pills that open a sheet, which is how Search
 * already does it: the control says what is chosen, and the choosing happens
 * somewhere with room for it. Filters were a row of chips here first, which
 * spent a line of the screen listing options instead of naming the one in
 * force, and grew with every kind that could be filtered.
 *
 * Every control is optional, because not every list earns all three: a grid
 * of stations that have no logo is a grid of identical squares, and a filter
 * over one kind of thing is a control with one option.
 */

type Props = {
  /** The current order, named. Omitted for a list with one sensible order. */
  sortLabel?: string
  onSortPress?: () => void
  /** The filter in force, named. Omitted where there is nothing to filter. */
  filterLabel?: string
  onFilterPress?: () => void
  /** Grid/list toggle. Omitted where a grid would say nothing a row doesn't. */
  isGridView?: boolean
  onToggleView?: () => void
}

export default function ListControls({
  sortLabel,
  onSortPress,
  filterLabel,
  onFilterPress,
  isGridView,
  onToggleView,
}: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const rad = useRadius()

  const showSort = Boolean(sortLabel && onSortPress)
  const showFilter = Boolean(filterLabel && onFilterPress)
  const showToggle = isGridView !== undefined && Boolean(onToggleView)

  if (!showSort && !showFilter && !showToggle) return null

  const pill = {
    backgroundColor: colors.muted,
    borderRadius: rad.pillFor(controlSize.inlineControl),
  }

  return (
    <View style={styles.row}>
      <View style={styles.group}>
        {showSort && (
          <Touchable
            testID="list-sort-button"
            style={[styles.pill, pill]}
            onPress={onSortPress}
            accessibilityRole="button"
          >
            <ArrowUpDown size={iconSize.row} color={colors.secondary} />
            <Text style={[styles.pillLabel, { color: colors.secondary }]}>{sortLabel}</Text>
          </Touchable>
        )}

        {showFilter && (
          <Touchable
            testID="list-filter-button"
            style={[styles.pill, pill]}
            onPress={onFilterPress}
            accessibilityRole="button"
          >
            <ListFilter size={iconSize.row} color={colors.secondary} />
            <Text style={[styles.pillLabel, { color: colors.secondary }]}>{filterLabel}</Text>
          </Touchable>
        )}
      </View>

      {showToggle && (
        <Touchable
          testID="list-view-toggle"
          style={[styles.gridButton, pill]}
          hitSlop={hitSlopFor(controlSize.inlineControl)}
          onPress={onToggleView}
          accessibilityRole="button"
          accessibilityLabel={
            isGridView ? t('library.view.switchToList') : t('library.view.switchToGrid')
          }
        >
          {isGridView
            ? <List size={iconSize.row} color={colors.secondary} />
            : <Grid2x2 size={iconSize.row} color={colors.secondary} />}
        </Touchable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.inlineGap,
    flexShrink: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.inlineGap,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillLabel: { ...typography.caption },
  gridButton: {
    width: controlSize.inlineControl,
    height: controlSize.inlineControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
