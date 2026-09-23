import type { ListDensity, RadiusPreset, SemanticThemeColors } from '@/constants/design';

/**
 * The theme is data: everything about how the app looks, in one object.
 *
 * The app's look used to be spread across code — two palettes written inline
 * in `useTheme`, and an accent, a corner preset, a density, cover tinting and
 * the translucent dock each read from their own setting by whichever component
 * cared. Here they become one value, which the appearance settings edit in
 * place. There is one theme, and every option on it is the user's to change;
 * every hook that draws the app reads it, and none reads the settings directly.
 */

type Scheme = 'light' | 'dark';

/** A scheme's colours. The accent is the theme's, not the palette's. */
export type ThemePalette = Omit<SemanticThemeColors, 'themeColor'>;

export interface Theme {
  /** Both schemes, so the app follows the system's light and dark like it always has. */
  palettes: Record<Scheme, ThemePalette>;
  accent: string;
  shape: {
    radius: RadiusPreset;
    density: ListDensity;
  };
  surface: {
    /** Tint a detail screen with a colour from its cover art. */
    coverTint: boolean;
  };
  components: {
    dock: 'solid' | 'translucent';
  };
}

/** The appearance settings a theme was built from before themes were stored: version 0 of `settingsAppearance`. */
export interface ThemeSettingsV0 {
  themeColor?: string;
  radiusPreset?: RadiusPreset;
  listDensity?: ListDensity;
  coverAccentEnabled?: boolean;
  translucentDock?: boolean;
}

/**
 * A theme from the settings that used to hold its parts: `base` with the old
 * accent, corners, density, tint and dock on top. Only the upgrade from those
 * settings uses it. A missing setting keeps the theme's own value.
 */
export function themeFromSettings(settings: ThemeSettingsV0, base: Theme): Theme {
  return {
    ...base,
    accent: settings.themeColor ?? base.accent,
    shape: {
      radius: settings.radiusPreset ?? base.shape.radius,
      density: settings.listDensity ?? base.shape.density,
    },
    surface: { coverTint: settings.coverAccentEnabled ?? base.surface.coverTint },
    components: {
      dock: settings.translucentDock === undefined
        ? base.components.dock
        : settings.translucentDock ? 'translucent' : 'solid',
    },
  };
}

/** What `useTheme().colors` hands every component: one scheme's palette and the accent. */
export function colorsFor(theme: Theme, scheme: Scheme): SemanticThemeColors {
  return { themeColor: theme.accent, ...theme.palettes[scheme] };
}
