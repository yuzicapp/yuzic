import { statusColor, themeColorPreset } from '@/constants/design';
import { ensureContrast, isDark, mix, withAlpha } from './color';
import type { Theme, ThemePalette } from './theme';

/**
 * The default theme, and how a palette is made from the colours a person picks.
 *
 * The one place a palette is spelled out in hex, which is why this file and
 * not the hooks is the lint rule's exception for theme colours.
 */

const LIGHT: ThemePalette = {
  background: '#F2F2F7',
  card: '#fff',
  text: '#000',
  secondary: '#111',
  subtext: '#555',
  border: '#ccc',
  muted: '#eee',
  placeholder: '#999',
  overlay: 'rgba(242,242,247,0.92)',
  statusSurface: 'rgba(0,0,0,0.05)',
  onThemeColor: '#fff',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  destructive: '#FF3B30',
  destructiveSurface: '#fff1f0',
  destructiveBorder: '#ead4d2',
  destructiveOnSurface: '#c7342f',
  warningText: statusColor.warningText,
  toastSurface: '#ffffff',
};

const DARK: ThemePalette = {
  background: '#000',
  card: '#222',
  text: '#f2f2f2',
  secondary: '#dcdcdc',
  subtext: '#aaa',
  border: '#444',
  muted: '#333',
  placeholder: '#666',
  overlay: 'rgba(0,0,0,0.82)',
  statusSurface: 'rgba(255,255,255,0.07)',
  onThemeColor: '#fff',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF453A',
  destructive: '#FF453A',
  // Soft red info-card tint.
  destructiveSurface: 'rgba(255,69,58,0.12)',
  destructiveBorder: 'rgba(255,69,58,0.35)',
  destructiveOnSurface: '#ffb4ad',
  warningText: statusColor.warningText,
  // A step brighter than `card` (#222) so a toast floats clear of the playing
  // bar and tab bar instead of blending into them. Light keeps white and leans
  // on its shadow and border for the same separation.
  toastSurface: '#2f2f31',
};

/** The look the app has always had. */
export const DEFAULT_THEME: Theme = {
  palettes: { light: LIGHT, dark: DARK },
  accent: themeColorPreset[0],
  accentFromCover: false,
  shape: { radius: 'default', density: 'default', textScale: 1 },
  surface: { coverTint: true, background: { kind: 'none' }, backgroundScope: 'home', backgroundBlur: 24, backgroundDim: 0.6 },
  components: { dock: 'solid', dockShape: 'edge', tabLabels: false, playerLayout: 'artwork' },
};

/** The colours a person picks. Everything else in a palette is worked out from them. */
export interface PaletteSeed {
  background: string;
  /** Cards, rows, sheets: what sits on the background. */
  surface: string;
  text: string;
}

/** Minimum contrast for body text (WCAG AA) and for secondary text. */
const TEXT_CONTRAST = 4.5;
const SUBTEXT_CONTRAST = 3;

/**
 * A full palette from three colours.
 *
 * The in-between greys are mixes of text into background, which is how the
 * hand-made default palettes are spaced, so a derived theme has the same
 * rhythm. Text and subtext are then pushed until they read on both the
 * background and the surface: whatever someone picks, the words stay legible.
 */
export function derivePalette(seed: PaletteSeed): ThemePalette {
  const dark = isDark(seed.background);
  const { background, surface } = seed;
  const text = ensureContrast(seed.text, [background, surface], TEXT_CONTRAST);
  return {
    background,
    card: surface,
    text,
    secondary: mix(text, surface, 0.1),
    subtext: ensureContrast(mix(text, background, 0.35), [background, surface], SUBTEXT_CONTRAST),
    border: mix(text, background, 0.75),
    muted: mix(text, background, 0.86),
    placeholder: mix(text, background, 0.55),
    overlay: withAlpha(background, dark ? 0.82 : 0.92),
    statusSurface: withAlpha(text, dark ? 0.07 : 0.05),
    onThemeColor: '#fff',
    success: '#34C759',
    warning: '#FF9500',
    error: dark ? '#FF453A' : '#FF3B30',
    destructive: dark ? '#FF453A' : '#FF3B30',
    destructiveSurface: dark ? 'rgba(255,69,58,0.12)' : '#fff1f0',
    destructiveBorder: dark ? 'rgba(255,69,58,0.35)' : '#ead4d2',
    destructiveOnSurface: dark ? '#ffb4ad' : '#c7342f',
    warningText: statusColor.warningText,
    // A step toward the text from the surface, so a toast floats clear of the
    // cards around it. Light surfaces lean on the toast's shadow instead.
    toastSurface: dark ? mix(surface, text, 0.06) : surface,
  };
}

/**
 * A stored theme made whole.
 *
 * A theme saved by an older build is missing whatever was added since, and a
 * missing value would reach a style as `undefined` and draw as a broken
 * layout. Each part falls back to the default theme's.
 */
export function normalizeTheme(theme: Partial<Theme>): Theme {
  return {
    ...DEFAULT_THEME,
    ...theme,
    accent: theme.accent || DEFAULT_THEME.accent,
    palettes: {
      light: { ...DEFAULT_THEME.palettes.light, ...theme.palettes?.light },
      dark: { ...DEFAULT_THEME.palettes.dark, ...theme.palettes?.dark },
    },
    shape: { ...DEFAULT_THEME.shape, ...theme.shape },
    surface: { ...DEFAULT_THEME.surface, ...theme.surface },
    components: { ...DEFAULT_THEME.components, ...theme.components },
  };
}
