import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { MediaImage } from '@/components/MediaImage'
import Touchable from '@/components/Touchable'
import { coverFade, onDark, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'
import { useTheme } from '@/features/theme/useTheme'
import type { BrowseTile as Tile } from './browseTiles'

/** Below this, the name needs the smaller type to fit on one line. */
const COMPACT_TILE_WIDTH = 150

/**
 * One way into the library.
 *
 * The name is the content here. The old tile put four quarter-size covers
 * above a caption, which made the art the subject — and four thumbnails at
 * that size are unreadable, so every tile became the same grey-brown mush and
 * the only thing distinguishing "Trap" from "Pop Rap" was two lines of grey
 * text underneath. Now one cover sits behind the word as atmosphere, dimmed
 * far enough that the word is legible over any artwork at all.
 *
 * Nothing here states the album count. It was the last thing left that read as
 * metadata rather than invitation, and it was never what anyone was choosing
 * by — size already says which tags are big, more honestly and without a
 * number to read.
 */
export default function BrowseTile({
  tile,
  width,
  height,
  onPress,
}: {
  tile: Tile
  width: number
  height: number
  onPress: () => void
}) {
  const { colors } = useTheme()
  const rad = useRadius()
  const cover = tile.covers[0]

  // Three to a row leaves no room for 20pt type: "Electronic" broke across two
  // lines mid-word, and "Cloud Rap" lost its second line to the tile's edge.
  // The hero keeps the larger size, which is most of what makes it read as the
  // hero in the first place.
  const compact = width < COMPACT_TILE_WIDTH

  return (
    <Touchable
      testID="search-browse-tile"
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      style={[styles.tile, { width, height, borderRadius: rad.md, backgroundColor: colors.muted }]}
      onPress={onPress}
    >
      {cover ? (
        <MediaImage cover={cover} size="grid" style={StyleSheet.absoluteFill} />
      ) : null}

      {/*
        Weighted to the foot, where the name sits, and barely tinted at the head
        so the art still reads as art. `photoScrim` was the first thing tried
        here and it is not enough: album covers carry their own lettering, and
        a tag laid over one at that weight landed white-on-white — "Trap" over
        the word YOUNGBOY was the case that proved it.

        Drawn even with no artwork, so a tile with art and a tile without read
        as the same object.
      */}
      <LinearGradient colors={coverFade.tileScrim} style={StyleSheet.absoluteFill} />

      <View style={styles.caption}>
        <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={2}>
          {tile.label}
        </Text>
      </View>
    </Touchable>
  )
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  caption: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  labelCompact: {
    ...typography.rowTitle,
  },
  label: {
    ...typography.sectionTitle,
    // Always the light text: it sits on a scrim that is dark by construction,
    // whatever the theme and whatever the artwork behind it.
    color: onDark.text,
  },
})
