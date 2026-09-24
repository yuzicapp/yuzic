/**
 * The little colour arithmetic a theme needs: mixing two colours, and making
 * sure text stays readable on whatever background a theme ends up with.
 *
 * Pure and dependency-free, because it runs inside a reducer-adjacent path
 * (building palettes) and in tests, and because the numbers are the part worth
 * checking. Contrast follows WCAG 2.1's relative-luminance formula.
 */

type Rgba = { r: number; g: number; b: number; a: number };

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** `#rgb`, `#rrggbb`, `#rrggbbaa` or `rgb(a)(...)`. Null for anything else. */
export function parseColor(value: string): Rgba | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = digits.split('').map(d => d + d).join('');
    const channel = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return { r: channel(0), g: channel(2), b: channel(4), a: digits.length === 8 ? channel(6) / 255 : 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (fn) {
    const parts = fn[1].split(',').map(p => Number(p.trim()));
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  return null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Six-digit hex, which is what `tinted` and the colour picker both expect. */
function toHex({ r, g, b }: Rgba): string {
  return '#' + [r, g, b].map(c => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function toRgba({ r, g, b }: Rgba, alpha: number): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

function blend(from: Rgba, to: Rgba, amount: number): Rgba {
  const t = clamp(amount, 0, 1);
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
    a: 1,
  };
}

function must(value: string): Rgba {
  const parsed = parseColor(value);
  if (!parsed) throw new Error(`Not a colour: ${value}`);
  return parsed;
}

/** `from` moved `amount` of the way to `to`, as six-digit hex. */
export function mix(from: string, to: string, amount: number): string {
  return toHex(blend(must(from), must(to), amount));
}

/** The colour at an opacity, as `rgba(...)`. */
export function withAlpha(color: string, alpha: number): string {
  return toRgba(must(color), alpha);
}

function luminance({ r, g, b }: Rgba): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two opaque colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(must(a)), luminance(must(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function isDark(color: string): boolean {
  return luminance(must(color)) < 0.18;
}

/** How finely `ensureContrast` walks toward black or white. */
const CONTRAST_STEPS = 50;

/**
 * `fg`, moved toward black or white just far enough to reach `min` contrast
 * against every one of `backgrounds`.
 *
 * This is what stops a theme someone made from putting pale grey on pale grey.
 * A colour that already reads is returned unchanged, so a well-made theme looks
 * exactly as its author picked it.
 *
 * It tries the direction away from the first background, then the other way.
 * Backgrounds of opposite shades, say black pages with white cards, can leave
 * no colour that reaches `min` on both; then it is the one that reads best on
 * the worse of them, a grey, rather than white text on the white cards.
 */
export function ensureContrast(fg: string, backgrounds: string[], min: number): string {
  const worst = (color: string) => Math.min(...backgrounds.map(bg => contrast(color, bg)));
  if (worst(fg) >= min) return fg;
  const start = must(fg);
  const first = isDark(backgrounds[0]) ? WHITE : BLACK;
  const second = first === WHITE ? BLACK : WHITE;
  let best = fg;
  let bestContrast = worst(fg);
  for (const target of [first, second]) {
    for (let step = 1; step <= CONTRAST_STEPS; step++) {
      const candidate = toHex(blend(start, target, step / CONTRAST_STEPS));
      const reads = worst(candidate);
      if (reads >= min) return candidate;
      if (reads > bestContrast) {
        best = candidate;
        bestContrast = reads;
      }
    }
  }
  return best;
}
