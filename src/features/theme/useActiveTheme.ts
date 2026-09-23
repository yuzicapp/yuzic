import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import {
  selectCoverAccentEnabled,
  selectListDensity,
  selectRadiusPreset,
  selectThemeColor,
  selectTranslucentDock,
} from '@/features/settings/appearance/state';
import { DEFAULT_THEME } from './presets';
import { themeFromSettings, type Theme } from './theme';

/**
 * The theme the app is drawn with.
 *
 * The one reader of the appearance settings that make up a theme: `useTheme`,
 * `useRadius`, `useListDensity`, cover tinting and the dock all come through
 * here, so where a theme comes from can change without any of them knowing.
 * Each setting is selected on its own, since building the object inside the
 * selector would hand back a new theme on every store change.
 */
export function useActiveTheme(): Theme {
  const themeColor = useSelector(selectThemeColor);
  const radiusPreset = useSelector(selectRadiusPreset);
  const listDensity = useSelector(selectListDensity);
  const coverAccentEnabled = useSelector(selectCoverAccentEnabled);
  const translucentDock = useSelector(selectTranslucentDock);

  return useMemo(
    () => themeFromSettings(
      { themeColor, radiusPreset, listDensity, coverAccentEnabled, translucentDock },
      DEFAULT_THEME,
    ),
    [themeColor, radiusPreset, listDensity, coverAccentEnabled, translucentDock],
  );
}
