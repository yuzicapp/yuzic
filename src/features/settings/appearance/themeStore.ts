import { DEFAULT_THEME, normalizeTheme } from '@/features/theme/presets';
import { themeFromSettings, type ThemeSettingsV0, type Theme } from '@/features/theme/theme';

/**
 * How the appearance slice edits and upgrades the theme, kept apart from the
 * slice so the slice stays a list of settings.
 */

/**
 * A change to the theme: any of its parts, each merged one level deep, so an
 * edit to the dark palette's background leaves the rest of the palette alone.
 */
export type ThemeEdit = {
  accent?: string;
  palettes?: { light?: Partial<Theme['palettes']['light']>; dark?: Partial<Theme['palettes']['dark']> };
  shape?: Partial<Theme['shape']>;
  surface?: Partial<Theme['surface']>;
  components?: Partial<Theme['components']>;
};

export function applyThemeEdit(theme: Theme, edit: ThemeEdit): Theme {
  return {
    ...theme,
    accent: edit.accent ?? theme.accent,
    palettes: {
      light: { ...theme.palettes.light, ...edit.palettes?.light },
      dark: { ...theme.palettes.dark, ...edit.palettes?.dark },
    },
    shape: { ...theme.shape, ...edit.shape },
    surface: { ...theme.surface, ...edit.surface },
    components: { ...theme.components, ...edit.components },
  };
}

/**
 * The upgrade to a stored theme.
 *
 * Before it the accent, corners, density, cover tint and dock were loose
 * fields in these settings. They become the theme, over the default look, so
 * nothing moves on upgrade. The old fields are dropped: left behind, they
 * would sit in storage looking like settings that do something.
 *
 * A development build briefly stored several themes (`activeThemeId` and
 * `customThemes`); one of those is carried across as the theme too.
 */
export function migrateAppearance(state: any): any {
  if (!state || state.theme) return state;
  const {
    themeColor, radiusPreset, listDensity, coverAccentEnabled, translucentDock,
    activeThemeId, customThemes, ...rest
  } = state as ThemeSettingsV0 & Record<string, unknown> & { activeThemeId?: string; customThemes?: Theme[] };
  const earlier = customThemes?.find(t => (t as Theme & { id?: string }).id === activeThemeId);
  const theme: Theme = earlier
    ? normalizeTheme(earlier)
    : themeFromSettings({ themeColor, radiusPreset, listDensity, coverAccentEnabled, translucentDock }, DEFAULT_THEME);
  return { ...rest, theme };
}
