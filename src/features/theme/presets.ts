import { statusColor, themeColorPreset } from '@/constants/design';
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
