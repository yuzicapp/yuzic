import React from 'react'
import { StyleSheet, View } from 'react-native'

import { MediaImage } from '@/components/MediaImage'
import { useTheme } from '@/features/theme/useTheme'
import { useRadius } from '@/features/theme/useRadius'
import { MOSAIC_COVERS } from './mosaicCovers'
import type { CoverSource } from '@/domain/entities/Cover'

type Props = {
  covers: CoverSource[]
  /** Drawn when there is no art yet — mid-sync, or a library with none. */
  fallback: React.ReactNode
  size: number
}

/**
 * A square of a collection's own cover art.
 *
 * Four covers make a grid, one fills the square, and none falls back to the
 * icon. Nothing in between: a grid with a hole in it reads as a half-loaded
 * screen, and a library that is still syncing would show exactly that for as
 * long as the sync took.
 */
const CoverMosaic: React.FC<Props> = ({ covers, fallback, size }) => {
  const { colors } = useTheme()
  const rad = useRadius()
  const box = { width: size, height: size, borderRadius: rad.md }

  if (covers.length >= MOSAIC_COVERS) {
    const half = size / 2
    return (
      <View style={[box, styles.mosaic, { backgroundColor: colors.muted }]}>
        {covers.slice(0, MOSAIC_COVERS).map((cover, index) => (
          <MediaImage
            key={index}
            cover={cover}
            size="thumb"
            style={{ width: half, height: half }}
          />
        ))}
      </View>
    )
  }

  if (covers.length > 0) {
    return (
      <View style={[box, styles.single, { backgroundColor: colors.muted }]}>
        <MediaImage cover={covers[0]} size="thumb" style={styles.fill} />
      </View>
    )
  }

  return (
    <View style={[box, styles.centered, { backgroundColor: colors.muted }]}>
      {fallback}
    </View>
  )
}

export default CoverMosaic

const styles = StyleSheet.create({
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  single: {
    overflow: 'hidden',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
})
