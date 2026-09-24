import { themeColorPreset } from '@/constants/design';
import { contrast } from './color';
import { DEFAULT_THEME, derivePalette } from './presets';
import { colorsFor } from './theme';

/**
 * Nothing the app draws may be unreadable, whatever the theme is set to.
 *
 * This exists because the two worst bugs of the 2.10.0 cycle were both this
 * shape and neither was catchable by the gates that ran: a status bar with no
 * readable pixels on it, and button labels at 1.44:1. Lint, typecheck and the
 * unit suite all passed; the bugs were visible in a screenshot and nowhere
 * else. Contrast is arithmetic, so it belongs here rather than in anyone's
 * eyes.
 *
 * The floors are WCAG AA: 4.5 for body text, 3 for large or bold text and for
 * the glyphs on a filled control. `ensureContrast` returns its best compromise
 * when nothing clears the bar, so a failure here means "no colour in that
 * direction reads", which is worth a conversation rather than a silent pass.
 */
const BODY = 4.5;
const LARGE = 3;

const SCHEMES = ['light', 'dark'] as const;

describe('legibility', () => {
  describe.each(SCHEMES)('%s palette', scheme => {
    const palette = DEFAULT_THEME.palettes[scheme];

    it('reads on both the page and a card', () => {
      expect(contrast(palette.text, palette.background)).toBeGreaterThanOrEqual(BODY);
      expect(contrast(palette.text, palette.card)).toBeGreaterThanOrEqual(BODY);
    });

    it('keeps its quieter text readable too', () => {
      expect(contrast(palette.subtext, palette.background)).toBeGreaterThanOrEqual(LARGE);
      expect(contrast(palette.subtext, palette.card)).toBeGreaterThanOrEqual(LARGE);
    });

    it.each(themeColorPreset)('carries a readable label on the %s accent', accent => {
      const colors = colorsFor({ ...DEFAULT_THEME, accent }, scheme);

      expect(contrast(colors.onThemeColor, accent)).toBeGreaterThanOrEqual(LARGE);
    });
  });

  /**
   * A cover-derived accent is not chosen from a list — it is whatever the
   * artwork happened to be, including the extremes.
   */
  it.each(['#ffffff', '#000000', '#fffb00', '#7f8c8d', '#1a1a2e'])(
    'carries a readable label on a cover accent of %s',
    accent => {
      for (const scheme of SCHEMES) {
        const colors = colorsFor({ ...DEFAULT_THEME, accent }, scheme);

        expect(contrast(colors.onThemeColor, accent)).toBeGreaterThanOrEqual(LARGE);
      }
    },
  );

  /**
   * The point of letting someone pick three colours is that the other twenty
   * follow. These are the picks most likely to break that: a page and a card
   * of opposite shades, and a black "light" theme.
   *
   * The floor here is the large-text 3, not 4.5, because 4.5 against *both*
   * surfaces is not always reachable — a white page with near-black cards, or
   * two mid-tones, leave no single colour that clears it on each. The next
   * test is the one that holds the helper to account for those.
   */
  it.each([
    ['black page, white cards', '#000000', '#ffffff', '#ffffff'],
    ['white page, black cards', '#ffffff', '#111111', '#000000'],
    ['near-black light theme', '#0a0a0a', '#151515', '#fafafa'],
    ['muddy mid-tones', '#6b705c', '#7f7f7f', '#dddddd'],
  ])('derives a legible palette for %s', (_name, background, surface, text) => {
    const palette = derivePalette({ background, surface, text });

    expect(contrast(palette.text, palette.background)).toBeGreaterThanOrEqual(LARGE);
    expect(contrast(palette.text, palette.card)).toBeGreaterThanOrEqual(LARGE);
  });

  /**
   * Where 4.5 cannot be had, the text must still be the best available.
   *
   * Checked against a brute-force sweep of every grey: a real oracle rather
   * than a number someone pasted in, so a future change to the search cannot
   * quietly return something worse and still pass.
   */
  it.each([
    ['white page, black cards', '#ffffff', '#111111', '#000000'],
    ['muddy mid-tones', '#6b705c', '#7f7f7f', '#dddddd'],
  ])('gets as close as any colour can for %s', (_name, background, surface, text) => {
    const palette = derivePalette({ background, surface, text });
    const worst = (candidate: string) =>
      Math.min(contrast(candidate, background), contrast(candidate, surface));

    let best = 0;
    for (let v = 0; v <= 255; v++) {
      const grey = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      best = Math.max(best, worst(grey));
    }

    // Within a rounding step of the best any grey achieves.
    expect(worst(palette.text)).toBeGreaterThanOrEqual(best - 0.1);
  });
});
