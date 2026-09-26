import React from 'react'
import { radius } from '@/constants/design';
import { StyleSheet, View } from 'react-native'
import { Skeleton } from 'moti/skeleton'
import { useRadius } from '@/features/theme/useRadius'

type Props = {
  size: number
  variant: 'album' | 'artist'
  colorMode: 'light' | 'dark'
}

/**
 * One placeholder tile: art, title, subtitle.
 *
 * Shared by the horizontal shelves and the wrapped grids so a tile is the same
 * shape wherever it stands in for a real one.
 */
export default function SkeletonTile({ size, variant, colorMode }: Props) {
  const rad = useRadius()
  const artRadius = variant === 'artist' ? size / 2 : rad.thumb

  return (
    <View style={{ width: size }}>
      <Skeleton width={size} height={size} radius={artRadius} colorMode={colorMode} />
      <View style={styles.titleSpacer} />
      <Skeleton width={size * 0.82} height={13} radius={radius.xs} colorMode={colorMode} />
      <View style={styles.subtitleSpacer} />
      <Skeleton width={size * 0.56} height={11} radius={radius.xs} colorMode={colorMode} />
    </View>
  )
}

const styles = StyleSheet.create({
  titleSpacer: { height: 8 },
  subtitleSpacer: { height: 6 },
})
