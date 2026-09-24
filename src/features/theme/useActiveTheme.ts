import { useSelector } from 'react-redux';

import { selectActiveTheme } from '@/features/settings/appearance/state';
import type { Theme } from './theme';

/**
 * The theme the app is drawn with.
 *
 * The one hook that reads it: `useTheme`, `useRadius`, `useListDensity`, cover
 * tinting and the dock all come through here, so where a theme comes from can
 * change without any of them knowing. The selector is memoised, so this is the
 * same object until the theme itself changes.
 */
export function useActiveTheme(): Theme {
  return useSelector(selectActiveTheme);
}
