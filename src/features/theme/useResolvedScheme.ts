import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';

import { selectThemeMode } from '@/features/settings/appearance/state';

type ResolvedScheme = 'light' | 'dark';

/**
 * Which palette is showing: the mode the user chose, or the system's when they
 * chose to follow it.
 *
 * Its own file so `useTheme` and the background layer can both read it without
 * importing each other — `useTheme` reports a transparent background while the
 * image shows, and the image needs the real colour for its veil.
 */
export function useResolvedScheme(): ResolvedScheme {
  const mode = useSelector(selectThemeMode) as 'system' | 'light' | 'dark';
  const system = useColorScheme() as ResolvedScheme | null;
  // Anything but an explicit light or dark follows the system, so a missing or
  // unknown stored mode still lands on a palette.
  return mode === 'light' || mode === 'dark' ? mode : system ?? 'light';
}
