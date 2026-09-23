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
  const resolved: ResolvedTheme = schemeFor(
    theme,
    mode === 'system' ? systemScheme ?? 'light' : mode,
  );

  const isDarkMode = resolved === 'dark';

  const colors = useMemo<SemanticThemeColors>(
    () => colorsFor(theme, resolved),
    [theme, resolved]
  );

  return {
    mode,
    resolved,
    isDarkMode,
    colors,
  };
};
