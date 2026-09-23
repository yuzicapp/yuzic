import type { ListDensity, RadiusPreset, SemanticThemeColors } from '@/constants/design';

/**
 * A theme is data: everything about how the app looks, in one object.
 *
 * The app's look used to be spread across code — two palettes written inline
 * in `useTheme`, and an accent, a corner preset, a density, cover tinting and
 * the translucent dock each read from their own setting by whichever component
 * cared. Here they become one value, so a preset is a theme we ship, an edited
 * theme is a copy with fields changed, and a shared theme is this object
 * written to a file. Every hook that draws the app reads the active theme; none
 * reads the appearance settings directly.
 */

export type Scheme = 'light' | 'dark';

/** A scheme's colours. The accent is the theme's, not the palette's. */
export type ThemePalette = Omit<SemanticThemeColors, 'themeColor'>;

export interface Theme {
  id: string;
  name: string;
  /** The preset a custom theme was made from, so deleting it can go back there. */
  basedOn?: string;
  /**
   * A theme that is only ever light or only ever dark. Absent, the theme
   * follows the light/dark setting like the app always has. A dark-only theme
   * has to say so rather than just carry two dark palettes, because the status
   * bar, blur and keyboard read the scheme, not the colours.
   */
  scheme?: Scheme;
  /** Both schemes, even for a fixed-scheme theme, so switching it back is never a blank. */
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

/** Which scheme a theme draws in, given what the light/dark setting resolved to. */
export function schemeFor(theme: Theme, resolvedMode: Scheme): Scheme {
  return theme.scheme ?? resolvedMode;
}

/** What `useTheme().colors` hands every component: one scheme's palette and the accent. */
export function colorsFor(theme: Theme, scheme: Scheme): SemanticThemeColors {
  return { themeColor: theme.accent, ...theme.palettes[scheme] };
}
