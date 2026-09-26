import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSegments } from 'expo-router';

import { usePlayingState } from '@/features/playback/PlayingContext';
import { buildCover } from '@/providers/registry/covers';
import { useActiveTheme } from './useActiveTheme';
import { colorsFor } from './theme';
import { useResolvedScheme } from './useResolvedScheme';
import { BackgroundSurfaceContext, type BackgroundSurface } from './screenBackgroundContext';

/** The tab roots, as expo-router segments them. Anything else is a pushed screen. */
const TAB_GROUPS = ['(home)', '(search)', '(library)'] as const;

function useCoveredByScope(): boolean {
  const scope = useActiveTheme().surface.backgroundScope;
  const segments = useSegments() as string[];
  if (scope === 'everywhere') return true;
  const group = segments[segments.length - 2];
  const atTabRoot = segments[segments.length - 1] === 'index'
    && (TAB_GROUPS as readonly string[]).includes(group);
  if (!atTabRoot) return false;
  return scope === 'tabs' || group === '(home)';
}

/**
 * The background image, drawn once behind the whole app.
 *
 * It used to be mounted by hand inside three screens, and each of those drew
 * its own containers transparent so as not to cover it. That is why the
 * setting only ever reached Home, Search and Library: any other screen would
 * have needed the same two edits, and a new screen would have needed them
 * again. Drawn here instead, behind the navigator, every screen sits on it —
 * and `useTheme` reports a transparent `background` while it shows, so the
 * screens paint themselves out of the way without knowing this exists.
 *
 * The full-screen player is not a route but an overlay above the navigator, so
 * it keeps its own cover-as-background and is excluded by construction rather
 * than by a rule.
 */
export function ScreenBackgroundProvider({ children }: { children: React.ReactNode }) {
  const theme = useActiveTheme();
  const { background, backgroundBlur, backgroundDim } = theme.surface;
  const { currentSong } = usePlayingState();
  const covered = useCoveredByScope();
  const scheme = useResolvedScheme();

  const uri = useMemo(() => {
    if (!covered) return null;
    if (background.kind === 'image') return background.uri;
    if (background.kind === 'cover' && currentSong) return buildCover(currentSong.cover, 'detail') ?? null;
    return null;
  }, [covered, background, currentSong]);

  const surface = useMemo<BackgroundSurface | null>(
    () => (uri ? { uri, blur: backgroundBlur, dim: backgroundDim } : null),
    [uri, backgroundBlur, backgroundDim],
  );

  // The palette straight from the theme, not from `useTheme`: that one reports
  // `background` as transparent while this is showing, and the veil is the one
  // place that needs the real colour.
  const veil = colorsFor(theme, scheme).background;

  return (
    <BackgroundSurfaceContext.Provider value={surface}>
      {surface && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="screen-background">
          <Image
            source={{ uri: surface.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={surface.blur}
            transition={300}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: veil, opacity: surface.dim }]} />
        </View>
      )}
      {children}
    </BackgroundSurfaceContext.Provider>
  );
}
