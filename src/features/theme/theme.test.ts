import fs from 'fs';
import path from 'path';

import { themeColorPreset } from '@/constants/design';
import { DEFAULT_THEME } from './presets';
import { colorsFor, themeFromSettings } from './theme';

describe('the default theme', () => {
  /**
   * The palettes `useTheme` wrote inline before themes were data. Moving them
   * was meant to change nothing anyone can see, so every value is pinned
   * rather than compared against the new file, which would pass by definition.
   */
  it('draws exactly the colours the app drew before', () => {
    expect(colorsFor(DEFAULT_THEME, 'light')).toMatchObject({
      themeColor: themeColorPreset[0],
      background: '#F2F2F7', card: '#fff', text: '#000', secondary: '#111', subtext: '#555',
      border: '#ccc', muted: '#eee', placeholder: '#999', overlay: 'rgba(242,242,247,0.92)',
      statusSurface: 'rgba(0,0,0,0.05)', onThemeColor: '#fff', success: '#34C759', warning: '#FF9500',
      error: '#FF3B30', destructive: '#FF3B30', destructiveSurface: '#fff1f0',
      destructiveBorder: '#ead4d2', destructiveOnSurface: '#c7342f', toastSurface: '#ffffff',
    });
    expect(colorsFor(DEFAULT_THEME, 'dark')).toMatchObject({
      themeColor: themeColorPreset[0],
      background: '#000', card: '#222', text: '#f2f2f2', secondary: '#dcdcdc', subtext: '#aaa',
      border: '#444', muted: '#333', placeholder: '#666', overlay: 'rgba(0,0,0,0.82)',
      statusSurface: 'rgba(255,255,255,0.07)', onThemeColor: '#fff', success: '#34C759', warning: '#FF9500',
      error: '#FF453A', destructive: '#FF453A', destructiveSurface: 'rgba(255,69,58,0.12)',
      destructiveBorder: 'rgba(255,69,58,0.35)', destructiveOnSurface: '#ffb4ad', toastSurface: '#2f2f31',
    });
  });

  it('keeps the shape, surface and dock a fresh install always had', () => {
    expect(DEFAULT_THEME.shape).toEqual({ radius: 'default', density: 'default' });
    expect(DEFAULT_THEME.surface).toEqual({ coverTint: true });
    expect(DEFAULT_THEME.components).toEqual({ dock: 'solid' });
  });
});

describe('themeFromSettings', () => {
  it('applies each appearance setting to its place in the theme', () => {
    const theme = themeFromSettings({
      themeColor: '#123456',
      radiusPreset: 'sharp',
      listDensity: 'compact',
      coverAccentEnabled: false,
      translucentDock: true,
    }, DEFAULT_THEME);

    expect(theme.accent).toBe('#123456');
    expect(theme.shape).toEqual({ radius: 'sharp', density: 'compact' });
    expect(theme.surface.coverTint).toBe(false);
    expect(theme.components.dock).toBe('translucent');
    expect(colorsFor(theme, 'dark').themeColor).toBe('#123456');
  });

  it('falls back to the theme for a setting written before its key existed', () => {
    expect(themeFromSettings({}, DEFAULT_THEME)).toEqual(DEFAULT_THEME);
  });

  it('leaves the palettes alone', () => {
    expect(themeFromSettings({ themeColor: '#123456' }, DEFAULT_THEME).palettes).toBe(DEFAULT_THEME.palettes);
  });
});

/**
 * The settings that make up a theme are read in one place.
 *
 * Only `useActiveTheme` builds the theme, and only the appearance editors read
 * the raw values, to show what is selected. A component reading one directly
 * draws the setting rather than the theme, and would silently ignore a theme
 * the moment themes are stored on their own.
 */
describe('who reads the theme settings', () => {
  const SRC = path.resolve(__dirname, '../..');
  const THEME_SELECTORS = /\bselect(ThemeColor|RadiusPreset|ListDensity|CoverAccentEnabled|TranslucentDock)\b/;
  const ALLOWED = [
    'features/theme/useActiveTheme.ts',
    'features/settings/appearance/state.ts',
    'features/settings/appearance/index.tsx',
    'features/settings/appearance/components/ThemeColor.tsx',
    'features/settings/appearance/components/RadiusPresetSelector.tsx',
    'features/settings/appearance/components/ListDensitySelector.tsx',
  ];

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it('is only the active theme and the appearance editors', () => {
    const readers = sourceFiles(SRC)
      .filter(file => THEME_SELECTORS.test(fs.readFileSync(file, 'utf8')))
      // Written with `/`, like the list above, whatever the platform says.
      .map(file => path.relative(SRC, file).split(path.sep).join('/'))
      .filter(file => !ALLOWED.includes(file));

    expect(readers).toEqual([]);
  });
});
