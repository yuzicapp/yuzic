import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectThemeMode } from '@/features/settings/appearance/state';
import { useResolvedScheme } from './useResolvedScheme';
import { useScreenBackground } from './screenBackgroundContext';
import type { SemanticThemeColors } from '@/constants/design';
import { colorsFor, drawsDark } from './theme';
import { useActiveTheme } from './useActiveTheme';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

export const useTheme = () => {
  const mode = useSelector(selectThemeMode) as ThemeMode;
  const theme = useActiveTheme();

  const resolved: ResolvedTheme = useResolvedScheme();

  // A background image behind the app means every screen has to let it
  // through. Reporting the page colour as transparent here does that for all
  // of them at once — including screens written after this — rather than each
  // one asking whether an image is showing and painting itself accordingly.
  const background = useScreenBackground();

  // The palette as chosen, before anything is let through it. Everything
  // derived — whether the app draws dark, the key the pressables remount on —
  // reads this rather than what callers are handed: `drawsDark` parses the
  // page colour, and `transparent` is a style value, not a colour to measure.
  const palette = useMemo<SemanticThemeColors>(() => colorsFor(theme, resolved), [theme, resolved]);

  const colors = useMemo<SemanticThemeColors>(
    () => (background ? { ...palette, background: 'transparent' } : palette),
    [palette, background]
  );

  // From the palette, not the mode; see `drawsDark`. `resolved` stays the mode,
  // which is which palette is showing.
  const isDarkMode = drawsDark(palette);

  // Every colour in one string, which changes when something drawn would.
  // `Touchable` keys on it; see there for why. The accent taken from the
  // cover is left out: it changes on every track, and remounting every
  // pressable in the app per track to repaint the few filled with the accent
  // would cancel presses on screens nothing had changed on.
  const colorKey = useMemo(() => {
    const { themeColor, ...rest } = palette;
    return [...Object.values(rest), theme.accentFromCover ? 'cover' : themeColor].join('|');
  }, [palette, theme.accentFromCover]);

  return {
    mode,
    resolved,
    isDarkMode,
    colors,
    colorKey,
  };
};
