import { DEFAULT_THEME, PRESET_THEMES, normalizeTheme } from '@/features/theme/presets';
import { themeFromSettings, type ThemeSettingsV0, type Theme } from '@/features/theme/theme';

/**
 * How the appearance slice stores and edits themes, kept apart from the slice
 * so the slice stays a list of settings. The reducers in `state.ts` call these.
 */

/** The part of the appearance settings that holds themes. */
interface ThemeState {
  activeThemeId: string;
  customThemes: Theme[];
}

/**
 * A change to a theme: any of its parts, each merged one level deep, so an
 * edit to the dark palette's background leaves the rest of the palette alone.
 * `scheme: null` clears a fixed scheme, so the theme follows light and dark again.
 */
export type ThemeEdit = {
  name?: string;
  accent?: string;
  scheme?: Theme['scheme'] | null;
  palettes?: { light?: Partial<Theme['palettes']['light']>; dark?: Partial<Theme['palettes']['dark']> };
  shape?: Partial<Theme['shape']>;
  surface?: Partial<Theme['surface']>;
  components?: Partial<Theme['components']>;
};

export function findTheme(state: Pick<ThemeState, 'customThemes'>, id: string): Theme | undefined {
  return PRESET_THEMES.find(t => t.id === id) ?? state.customThemes?.find(t => t.id === id);
}

function applyThemeEdit(theme: Theme, edit: ThemeEdit): Theme {
  return {
    ...theme,
    name: edit.name ?? theme.name,
    accent: edit.accent ?? theme.accent,
    scheme: edit.scheme === undefined ? theme.scheme : edit.scheme ?? undefined,
    palettes: {
      light: { ...theme.palettes.light, ...edit.palettes?.light },
      dark: { ...theme.palettes.dark, ...edit.palettes?.dark },
    },
    shape: { ...theme.shape, ...edit.shape },
    surface: { ...theme.surface, ...edit.surface },
    components: { ...theme.components, ...edit.components },
  };
}

export function editActive(state: ThemeState, edit: ThemeEdit, copyId: string) {
  const custom = state.customThemes.findIndex(t => t.id === state.activeThemeId);
  if (custom >= 0) {
    state.customThemes[custom] = applyThemeEdit(normalizeTheme(state.customThemes[custom]), edit);
    return;
  }
  const preset = findTheme(state, state.activeThemeId) ?? DEFAULT_THEME;
  const copy = applyThemeEdit({ ...preset, id: `custom-${copyId}`, basedOn: preset.id }, edit);
  state.customThemes.push(copy);
  state.activeThemeId = copy.id;
}

/**
 * The upgrade from the settings that used to hold a theme's parts.
 *
 * Before version 1 the accent, corners, density, cover tint and dock were
 * loose fields here. Someone who never changed them is on the default theme,
 * and stays there. Someone who did gets those choices as a custom theme made
 * from the default, which draws exactly what they had, so nothing moves on
 * upgrade. The old fields are dropped either way: left behind, they would sit
 * in storage looking like settings that do something.
 */
export function migrateAppearance(state: any): any {
  if (!state || state.activeThemeId) return state;
  const {
    themeColor, radiusPreset, listDensity, coverAccentEnabled, translucentDock, ...rest
  } = state as ThemeSettingsV0 & Record<string, unknown>;
  const theme = themeFromSettings(
    { themeColor, radiusPreset, listDensity, coverAccentEnabled, translucentDock },
    DEFAULT_THEME,
  );
  const unchanged = theme.accent === DEFAULT_THEME.accent
    && theme.shape.radius === DEFAULT_THEME.shape.radius
    && theme.shape.density === DEFAULT_THEME.shape.density
    && theme.surface.coverTint === DEFAULT_THEME.surface.coverTint
    && theme.components.dock === DEFAULT_THEME.components.dock;
  if (unchanged) return { ...rest, activeThemeId: DEFAULT_THEME.id, customThemes: [] };
  const custom: Theme = { ...theme, id: 'custom-upgraded', basedOn: DEFAULT_THEME.id };
  return { ...rest, activeThemeId: custom.id, customThemes: [custom] };
}
