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
 *
 * Today there is one built-in theme and the user's appearance settings are
 * applied over it (`themeFromSettings`), which draws exactly what the app drew
 * before this existed. Storing themes of their own is the next step, and it
 * changes where the theme comes from, not what reads it.
 */

export type Scheme = 'light' | 'dark';

/** A scheme's colours. The accent is the theme's, not the palette's. */
export type ThemePalette = Omit<SemanticThemeColors, 'themeColor'>;

export interface Theme {
  id: string;
  name: string;
  /** Both schemes, so a theme follows the system's light and dark like the app always has. */
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

/** The appearance settings a theme is built from, until themes are stored themselves. */
export interface ThemeSettings {
  themeColor?: string;
  radiusPreset?: RadiusPreset;
  listDensity?: ListDensity;
  coverAccentEnabled?: boolean;
  translucentDock?: boolean;
}

/**
 * The active theme: the built-in one with the user's appearance settings on top.
 *
 * A setting that is missing falls back to the theme's own value. A settings
 * blob written before a key existed reaches here without it, and `undefined`
 * would otherwise land in a style as a broken layout rather than a default.
 */
export function themeFromSettings(settings: ThemeSettings, base: Theme): Theme {
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
