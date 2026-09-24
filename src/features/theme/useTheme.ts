import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { selectThemeMode } from '@/features/settings/appearance/state';
import type { SemanticThemeColors } from '@/constants/design';
import { colorsFor } from './theme';
import { useActiveTheme } from './useActiveTheme';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

export const useTheme = () => {
  const mode = useSelector(selectThemeMode) as ThemeMode;
  const theme = useActiveTheme();

  const systemScheme = useColorScheme() as ResolvedTheme | null;

  const resolved: ResolvedTheme =
    mode === 'system' ? systemScheme ?? 'light' : mode;

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
    resolved,
    isDarkMode,
    colors,
    colorKey,
  };
};
