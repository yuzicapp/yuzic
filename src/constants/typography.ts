import { PixelRatio } from 'react-native';
import { readStartupTextScale } from './startupTextScale';

/**
 * The type scale: 14 roles, each chosen by naming what the text is so the same
 * decision comes out the same way twice. Literal `fontSize` was up to thirteen
 * distinct values across the app, including 13, 14 and 15 all doing the job of
 * "small"; and the scale itself had drift too (a `detailTitle` byte-for-byte
 * identical to `screenTitle`, and a `compactRowSubtitle` identical to `caption`,
 * both since collapsed).
 *
 * Weight ladder is 400 / 500 / 600 — hero and display sit at 600 so the whole
 * app has one bold weight instead of a lonely 700 at the top.
 *
 * Adding a role is fine. Adding one that differs from an existing role only in
 * size is how the drift starts again.
 */
const BASE_SCALE = {
  hero: { fontSize: 48, lineHeight: 52, fontWeight: '600' as const },
  display: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const },
  screenTitle: { fontSize: 24, lineHeight: 30, fontWeight: '600' as const },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const },
  navigationTitle: { fontSize: 18, lineHeight: 22, fontWeight: '600' as const },
  sheetTitle: { fontSize: 16, lineHeight: 20, fontWeight: '600' as const },
  rowTitle: { fontSize: 16, lineHeight: 20, fontWeight: '500' as const },
  body: { fontSize: 16, lineHeight: 21 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  compactRowTitle: { fontSize: 15, lineHeight: 19, fontWeight: '500' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  rowSubtitle: { fontSize: 14, lineHeight: 18 },
  caption: { fontSize: 13, lineHeight: 17 },
  micro: { fontSize: 11, lineHeight: 14 },
} as const;

/**
 * The scale at the user's chosen text size (Appearance, on the theme).
 * Size and leading grow together, so every role keeps the ratio it was drawn
 * with; the system text size then applies on top, as it always has.
 */
function sizedBy<T extends Record<string, { fontSize: number; lineHeight: number }>>(scale: T, factor: number): T {
  if (factor === 1) return scale;
  return Object.fromEntries(
    Object.entries(scale).map(([role, style]) => [
      role,
      { ...style, fontSize: Math.round(style.fontSize * factor), lineHeight: Math.round(style.lineHeight * factor) },
    ])
  ) as T;
}

/** The text size this run of the app was drawn at, which a new choice waits on. */
export const startupTextScale = readStartupTextScale();

const TYPE_SCALE = sizedBy(BASE_SCALE, startupTextScale);

/**
 * The same scale with its leading grown to match the user's text size.
 *
 * React Native scales `fontSize` by the system text size and leaves
 * `lineHeight` exactly where it was written. At the default size that is
 * invisible; at the accessibility sizes a 20pt role renders at 60pt inside a
 * 25pt line box, and every title, subtitle and timestamp in the app is sliced
 * off top and bottom. The now-playing screen was unreadable — the song title
 * and both timestamps were fragments of glyphs.
 *
 * So the leading is scaled here by the same factor the platform is about to
 * apply to the size, which keeps the ratio each role was drawn with. It reads
 * the scale once, at module load: a role is a static style object, spread into
 * `StyleSheet.create` at import time, and the alternative is a hook at every
 * one of several hundred call sites. iOS and Android both restart the JS
 * context when the system text size changes, so this is re-read in practice.
 */
export function withScaledLeading<T extends Record<string, { lineHeight: number }>>(
  scale: T,
  fontScale: number
): T {
  return Object.fromEntries(
    Object.entries(scale).map(([role, style]) => [
      role,
      { ...style, lineHeight: Math.round(style.lineHeight * fontScale) },
    ])
  ) as T;
}

const SYSTEM_FONT_SCALE = PixelRatio.getFontScale();

export const typography = withScaledLeading(TYPE_SCALE, SYSTEM_FONT_SCALE);

/**
 * How far text inside a fixed-height control may grow.
 *
 * Most of the app should scale all the way — a list, a screen, a sheet all
 * have room to get taller. A few surfaces do not: the playing bar is a strip
 * of a set height that the dock is built around, and an avatar is a circle
 * with one letter in it. Left uncapped those grow until the bar owns half the
 * screen and the letter spills out of its disc.
 *
 * `maxFontSizeMultiplier` is the per-`Text` ceiling for exactly this. It is a
 * ceiling, not an opt-out: `allowFontScaling={false}` ignores the setting
 * outright, which is why the two places still doing that were changed to this.
 */
export const fontScaleCap = {
  /** Text laid into a control whose height is structural. */
  control: 1.3,
  /** A single glyph inside a disc — an avatar initial, a track number. */
  glyph: 1.15,
} as const;

/**
 * The scale again, for text that carries a `maxFontSizeMultiplier`.
 *
 * `maxFontSizeMultiplier` caps the rendered size and nothing else, so a role
 * whose leading was grown by the full system scale ends up as a 1.3x line of
 * text sitting in a 3x line box — the playing bar stopped clipping and started
 * being half the screen tall instead. Leading has to stop where the size does,
 * so a capped role reads its lineHeight from the same capped factor.
 *
 * Always used with the matching cap on the `Text` itself; one without the
 * other is the mismatch this exists to close.
 */
export const cappedTypography = {
  // From the base scale, not the user's text size: the cap bounds only the
  // system multiplier React Native applies, so a role already enlarged by the
  // in-app setting would reach both factors at once, 1.3 times 1.3, and
  // overflow the fixed-height box the cap exists to protect. Structural text
  // grows with the system setting up to its cap and leaves the in-app size to
  // everything that has room for it.
  control: withScaledLeading(BASE_SCALE, Math.min(SYSTEM_FONT_SCALE, fontScaleCap.control)),
  glyph: withScaledLeading(BASE_SCALE, Math.min(SYSTEM_FONT_SCALE, fontScaleCap.glyph)),
} as const;
