/**
 * A drawn stand-in for artwork that does not exist.
 *
 * Issue #290: a library of live recordings that will never have covers reads as
 * one repeated picture-with-a-slash glyph, and the ask was to "disrupt the
 * repetitiveness of a single default icon". So the stand-in is derived from
 * whatever the cover is of: same album, same colours, every launch and every
 * device, with no files to manage and nothing to fetch.
 *
 * Deliberately not a user-supplied folder of images. That needs a picker, the
 * storage-access dance twice over, files that can vanish, and enough images to
 * avoid repeating anyway — a lot of surface for a default. Hashing gives every
 * album a different face for free. If real art is ever wanted here, it picks
 * from a set with this same hash and nothing else changes.
 *
 * No React Native imports on purpose: the preview tool renders the real
 * function rather than a copy of it that can drift.
 */

import { onDarkAlpha, shade } from '../constants/colors';

// Imported by a relative path, not the `@/` alias: the preview tool compiles
// this file on its own, and `../constants/colors` has no imports of its own so
// it comes along without dragging React Native in.

type CoverPlaceholder = {
  /**
   * One flat colour. A gradient was tried first and did not earn itself: at
   * tile size it reads as a single colour anyway, and it cost a gradient node
   * behind every missing cover in a grid.
   */
  background: string;
  /** Readable on `background`. */
  foreground: string;
  /** One or two letters, or '' when the name gives nothing to draw. */
  initials: string;
};

/** FNV-1a, 32-bit. Small, stable, and not a dependency. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    // The classic multiply, kept in 32 bits without Math.imul's overflow.
    value = (value + ((value << 1) + (value << 4) + (value << 7) + (value << 8) + (value << 24))) >>> 0;
  }
  return value >>> 0;
}

/**
 * Leading articles would bunch a whole library onto "T", so they go — but only
 * when something follows them, or "The The" loses its name entirely.
 */
const ARTICLES = /^(the|a|an|le|la|les|el|los|las|der|die|das)\s+/i;

export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const withoutArticle = trimmed.replace(ARTICLES, '') || trimmed;

  // Letters and digits of any script, so Japanese and Chinese titles — four of
  // the app's locales — get their first character rather than nothing.
  const words = withoutArticle
    .split(/[\s\-–—_/|·,:]+/)
    .map(word => Array.from(word).find(char => /[\p{L}\p{N}]/u.test(char)) ?? '')
    .filter(Boolean);

  if (words.length === 0) return '';
  // One letter for a single word: "Blue" as "BL" reads like an abbreviation of
  // something else, where "B" reads as a mark.
  if (words.length === 1) return words[0].toUpperCase();

  // A trailing number is a date or a catalogue number, not a word, and taking
  // its first digit gave "Selected Ambient Works 85-92" the initials "S9" and
  // "Cornell 5/8/77" the initials "C7". Walk back to the last word that starts
  // with a letter; if the title is all numbers after the first word, one letter
  // says more than a letter and an arbitrary digit.
  const lastLetterWord = [...words].reverse().find((word, index) =>
    index < words.length - 1 && /\p{L}/u.test(word));
  if (!lastLetterWord) return words[0].toUpperCase();
  return (words[0] + lastLetterWord).toUpperCase();
}

function hsl(hue: number, saturation: number, lightness: number): string {
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
}

/**
 * Hues are spread by the golden angle rather than taken straight from the
 * hash: consecutive hash values land far apart on the wheel, so two albums
 * next to each other in a grid rarely read as the same colour.
 */
const GOLDEN_ANGLE = 137.508;

export function placeholderFor(seed: string, mode: 'light' | 'dark'): CoverPlaceholder {
  const digest = hash(seed);
  const hue = (digest % 360) * GOLDEN_ANGLE % 360;
  // A small, bounded wobble so every tile is not the same two numbers with the
  // hue swapped, while staying muted enough to sit behind white text.
  const saturationJitter = (digest >>> 9) % 10;
  const lightnessJitter = (digest >>> 17) % 6;

  if (mode === 'dark') {
    return {
      background: hsl(hue, 26 + saturationJitter, 22 + lightnessJitter),
      foreground: onDarkAlpha.prominent,
      initials: '',
    };
  }
  // Lighter and less saturated than the dark end. The first pass used the same
  // saturation for both and light mode came out as pastel confectionery next to
  // real artwork.
  return {
    background: hsl(hue, 24 + saturationJitter, 78 - lightnessJitter),
    // "Text on art" is exactly this job: dark letters over a light field whose
    // colour is not ours to choose.
    foreground: shade.textOnArt,
    initials: '',
  };
}

/** The whole thing: colours from the seed, letters from the name. */
export function coverPlaceholder(seed: string, name: string, mode: 'light' | 'dark'): CoverPlaceholder {
  return { ...placeholderFor(seed, mode), initials: initialsFor(name) };
}
