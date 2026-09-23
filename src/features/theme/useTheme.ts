import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { selectThemeMode } from '@/features/settings/appearance/state';
import type { SemanticThemeColors } from '@/constants/design';
import { colorsFor, schemeFor } from './theme';
import { useActiveTheme } from './useActiveTheme';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

export const useTheme = () => {
  const mode = useSelector(selectThemeMode) as ThemeMode;
  const theme = useActiveTheme();

  const systemScheme = useColorScheme() as ResolvedTheme | null;

  // A theme that is only ever dark (or light) wins over the setting: its
  // colours are one scheme's, and the status bar and blur have to agree.
  const modeScheme: ResolvedTheme = mode === 'system' ? systemScheme ?? 'light' : mode;
  const resolved: ResolvedTheme = schemeFor(theme, modeScheme);

  const isDarkMode = resolved === 'dark';

  const colors = useMemo<SemanticThemeColors>(
    () => colorsFor(theme, resolved),
    [theme, resolved]
  );

  // Every colour in one string, which changes exactly when something drawn
  // would. `Touchable` keys on it; see there for why.
  const colorKey = useMemo(() => Object.values(colors).join('|'), [colors]);

  return {
    mode,
    /** What the light/dark setting alone asks for, before the theme has a say. */
    modeScheme,
    resolved,
    isDarkMode,
    colors,
    colorKey,
  };
};
