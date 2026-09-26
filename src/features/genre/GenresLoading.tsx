import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Skeleton } from 'moti/skeleton'

import { useTheme } from '@/features/theme/useTheme'
import { spacing } from '@/constants/design'
import { useListDensity } from '@/features/theme/useListDensity'

const PLACEHOLDER_ROWS = 10

/**
 * Genre rows carry no artwork, so this is text-shaped rather than reusing
 * SkeletonListRow — a row of fake album art would misdescribe the screen.
 */
const LoadingGenreList: React.FC = () => {
  const { isDarkMode } = useTheme()
  const colorMode = isDarkMode ? 'dark' : 'light'
  const rows = useMemo(() => Array.from({ length: PLACEHOLDER_ROWS }), [])
  // Matches GenresScreen's real rows, so the list does not resize under the
  // user when the genres arrive.
  const density = useListDensity()

  return (
    <View style={styles.wrapper}>
      {rows.map((_, index) => (
        <View key={`genre-loading-${index}`} style={{ paddingVertical: density.rowPadding }}>
          <Skeleton width="45%" height={16} radius={6} colorMode={colorMode} />
          <View style={styles.lineSpacer} />
          <Skeleton width="22%" height={12} radius={6} colorMode={colorMode} />
        </View>
      ))}
    </View>
  )
}

export default LoadingGenreList

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: spacing.page, paddingTop: spacing.md },
  lineSpacer: { height: 6 },
})
