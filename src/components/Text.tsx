import React, { createContext, useContext, useMemo } from 'react';
// The one file allowed to reach for the platform Text; everything else comes
// through this wrapper, which is what the lint rule is there to hold.
// eslint-disable-next-line no-restricted-syntax
import { StyleSheet, Text as PlatformText, type TextProps, type TextStyle } from 'react-native';

import { useActiveTheme } from '@/features/theme/useActiveTheme';

/**
 * The app's text size, applied when text is drawn rather than when the app
 * starts.
 *
 * It used to be multiplied into the type roles at import time, because a role
 * is a static object spread into `StyleSheet.create` and the alternative
 * looked like a hook at several hundred call sites. The cost of that was a
 * setting that did nothing until the app was restarted, and a hint under it
 * saying so. Doing it here instead is one component: the roles keep their
 * written sizes, the call sites keep `...typography.rowTitle`, and the scale
 * lands on the way out.
 *
 * At the default size this returns the caller's own style object untouched, so
 * the common case costs nothing beyond a context read.
 */
const TextScaleContext = createContext(1);

/** Publishes the user's text size once, so 400-odd `Text`s read a context
 *  rather than each subscribing to the store. */
export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const scale = useActiveTheme().shape.textScale;
  return <TextScaleContext.Provider value={scale}>{children}</TextScaleContext.Provider>;
}

function useTextScale(): number {
  return useContext(TextScaleContext);
}

type AppTextProps = TextProps & {
  /**
   * Opt out of the app's text size — not the system's, which `maxFontSizeMultiplier`
   * bounds and which every surface still honours.
   *
   * For the few places built around a set height that the rest of the app
   * measures against: the dock's labels and the playing bar. Growing those
   * moves the floor every screen sits on rather than the text on one screen.
   */
  appScaling?: boolean;
};

export function Text({ style, appScaling = true, ...rest }: AppTextProps) {
  const scale = useTextScale();

  const scaled = useMemo(() => {
    if (!appScaling || scale === 1) return style;
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    // No size of its own means it inherits one, and the parent has already been
    // scaled — multiplying again here would compound it.
    if (typeof flat?.fontSize !== 'number') return style;
    return [
      style,
      {
        fontSize: Math.round(flat.fontSize * scale),
        ...(typeof flat.lineHeight === 'number'
          ? { lineHeight: Math.round(flat.lineHeight * scale) }
          : null),
      },
    ];
  }, [style, scale, appScaling]);

  return <PlatformText {...rest} style={scaled} />;
}
