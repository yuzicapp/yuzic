import { statusColor, themeColorPreset } from '@/constants/design';
import { ensureContrast, isDark, mix, withAlpha } from './color';
import type { Theme, ThemePalette } from './theme';

/**
 * The themes the app ships.
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
  id: 'yuzic',
  name: 'Yuzic',
  palettes: { light: LIGHT, dark: DARK },
  accent: themeColorPreset[0],
  shape: { radius: 'default', density: 'default' },
  surface: { coverTint: true },
  components: { dock: 'solid' },
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

const both = (light: PaletteSeed, dark: PaletteSeed) => ({ light: derivePalette(light), dark: derivePalette(dark) });

/** A fixed-scheme theme still carries both palettes; the other one is the default's. */
const darkOnly = (seed: PaletteSeed) => ({ light: LIGHT, dark: derivePalette(seed) });
const lightOnly = (seed: PaletteSeed) => ({ light: derivePalette(seed), dark: DARK });

const defaults = { shape: DEFAULT_THEME.shape, surface: DEFAULT_THEME.surface, components: DEFAULT_THEME.components };

/**
 * The gallery, in the order it is shown. The default comes first. Ids are
 * stored in settings and in custom themes' `basedOn`, so they never change;
 * names may.
 */
export const PRESET_THEMES: Theme[] = [
  DEFAULT_THEME,
  {
    ...defaults,
    id: 'graphite',
    name: 'Graphite',
    scheme: 'dark',
    accent: '#8ab4f8',
    palettes: darkOnly({ background: '#121212', surface: '#1e1e1e', text: '#ececec' }),
  },
  {
    ...defaults,
    id: 'midnight',
    name: 'Midnight',
    scheme: 'dark',
    accent: '#7aa2ff',
    palettes: darkOnly({ background: '#0b1020', surface: '#151c33', text: '#e6e9f5' }),
  },
  {
    ...defaults,
    id: 'sunset',
    name: 'Sunset',
    scheme: 'dark',
    accent: '#ff8a5b',
    palettes: darkOnly({ background: '#1b1024', surface: '#2a1836', text: '#f5e9f7' }),
  },
  {
    ...defaults,
    id: 'paper',
    name: 'Paper',
    scheme: 'light',
    accent: '#c2410c',
    shape: { ...defaults.shape, radius: 'rounded' },
    palettes: lightOnly({ background: '#f6f1e7', surface: '#fffaf0', text: '#2b2620' }),
  },
  {
    ...defaults,
    id: 'forest',
    name: 'Forest',
    accent: '#3fa96b',
    palettes: both(
      { background: '#eef3ee', surface: '#ffffff', text: '#14231a' },
      { background: '#0d1510', surface: '#16221a', text: '#e3eee6' },
    ),
  },
  {
    ...defaults,
    id: 'rose',
    name: 'Rosé',
    accent: '#e0567a',
    palettes: both(
      { background: '#fbf1f2', surface: '#ffffff', text: '#2a1a1d' },
      { background: '#1a1113', surface: '#261a1d', text: '#f3e3e6' },
    ),
  },
  {
    ...defaults,
    id: 'mono',
    name: 'Mono',
    accent: '#6e6e73',
    shape: { ...defaults.shape, radius: 'sharp' },
    palettes: both(
      { background: '#f4f4f4', surface: '#ffffff', text: '#111111' },
      { background: '#0a0a0a', surface: '#171717', text: '#f0f0f0' },
    ),
  },
];

/**
 * A stored theme made whole.
 *
 * A theme saved by an older build is missing whatever was added since, and a
 * missing value would reach a style as `undefined` and draw as a broken
 * layout. Each part falls back to the default theme's. Also the gate for a
 * theme read from a file, once themes can be shared.
 */
export function normalizeTheme(theme: Partial<Theme> & { id: string }): Theme {
  return {
    ...DEFAULT_THEME,
    ...theme,
    name: theme.name || DEFAULT_THEME.name,
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
