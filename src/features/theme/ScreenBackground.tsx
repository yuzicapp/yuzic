import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { usePlayingState } from '@/features/playback/PlayingContext';
import { buildCover } from '@/providers/registry/covers';
import { useActiveTheme } from './useActiveTheme';
import { useTheme } from './useTheme';

/** The image behind a screen right now, or null when it is drawn plain. */
function useBackgroundUri(): string | null {
  const background = useActiveTheme().surface.background;
  const { currentSong } = usePlayingState();
  if (background.kind === 'image') return background.uri;
  if (background.kind === 'cover' && currentSong) return buildCover(currentSong.cover, 'detail') ?? null;
  return null;
}

/**
 * Whether the screen has an image behind it. A screen that does draws its own
 * containers transparent, or they would cover the image they sit on.
 */
export function useHasScreenBackground(): boolean {
  return useBackgroundUri() !== null;
}

/**
 * The theme's background image, blurred and veiled, filling its parent.
 *
 * Put it first inside a screen's root. The blur is applied when the image is
 * decoded, not on every frame, so a scrolling list over it costs nothing
 * extra. The veil is the theme's own background colour, so the screen's text,
 * which already reads on that colour, still reads over the photo.
 */
export function ScreenBackground() {
  const uri = useBackgroundUri();
  const { colors } = useTheme();
  const { backgroundBlur, backgroundDim } = useActiveTheme().surface;
  if (!uri) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="screen-background">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={backgroundBlur} transition={300} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: backgroundDim }]} />
    </View>
  );
}
