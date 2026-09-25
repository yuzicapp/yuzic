import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { MediaImage } from '@/components/MediaImage'
import Touchable from '@/components/Touchable'
import { coverFade, onDark, spacing, typography } from '@/constants/design'
import { useRadius } from '@/features/theme/useRadius'
import { useTheme } from '@/features/theme/useTheme'
import type { BrowseTile as Tile } from './browseTiles'

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
        `coverFade.photoScrim` is the app's existing answer to "text over
        artwork we did not choose" — it holds the whole image down rather than
        only its foot, because a tile's name is large and the art behind it can
        be bright anywhere. Drawn even with no artwork, so a tile with art and
        a tile without read as the same object.
      */}
      <LinearGradient colors={coverFade.photoScrim} style={StyleSheet.absoluteFill} />

      <View style={styles.caption}>
        <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
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
  label: {
    ...typography.sectionTitle,
    // Always the light text: it sits on a scrim that is dark by construction,
    // whatever the theme and whatever the artwork behind it.
    color: onDark.text,
  },
})
