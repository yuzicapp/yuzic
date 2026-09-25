/**
 * Every colour the app states outright, rather than reading from the theme.
 *
 * Split out of `design.ts` because that file had reached the size the
 * file-shape gate holds it to, and because these divide cleanly in two: the
 * opaque roles below say *what colour a surface is*, and the translucent ones
 * after them say *how much of what is behind shows through*. Re-exported from
 * `design.ts`, as the type and window scales already are, so no call site has
 * to know the split happened.
 */

export const statusColor = {
  favorite: '#ff3b30',
  destructive: '#ff3b30',
  success: '#34C759',
  warning: '#FF9500',
  /** Softer amber for inline warning text (e.g. onboarding hints, form warnings)
   *  that would look shouty in the pure iOS orange. */
  warningText: '#f59e0b',
  downloading: '#007AFF',
  errorText: '#e57373',
} as const;

export const fixedColor = {
  /** iOS system grey, for the "off" half of every status dot in settings, so
   *  disconnected and disabled read as one language. */
  systemGray: '#8E8E93',
  onboardingBlue: '#1f6feb',
  onboardingWarningSurface: '#1c1400',
  onboardingWarningBorder: '#78450a',
} as const;

/**
 * External service brand colours. One source of truth so a badge on Home,
 * a chip on the artist page, and the source-registry entry all read the
 * same purple/red — instead of drifting to `#A238CA` in six files and
 * `#a238ca` in a seventh.
 */
export const sourceColor = {
  deezer: '#A238CA',
  lastfm: '#D51007',
  listenbrainz: '#EB743B',
  musicbrainz: '#BA478F',
  audiomuse: '#7C3AED',
} as const;

/**
 * Colours for surfaces that are always dark regardless of the app's theme —
 * the full-screen player, the playing bar, the onboarding flow. They can't
 * read from `useTheme()` because they need to look right for a light-theme
 * user too. Pre-radius/typography rules apply: pick by role, not by hex.
 *
 * Every value here was drift before — `#111` vs `#1a1a1a` vs `#121212` for
 * "one shade above black", `#888` vs `#aaa` for "subtext on dark". Twelve
 * distinct greys folded onto seven roles.
 */
export const onDark = {
  /** Base page background — the darkest surface. */
  background: '#000',
  /** Card / raised surface a step above the background. */
  surface: '#111',
  /** A slightly-lighter card, mostly used for player inner cards. */
  surfaceElevated: '#1a1a1a',
  /** A step further — chips, badges, muted rows on dark. */
  muted: '#222',
  /** Divider / soft border. */
  border: '#333',
  /** Primary foreground text. */
  text: '#fff',
  /** Secondary foreground (subtitle, timestamps, meta). */
  subtext: '#aaa',
  /** Tertiary foreground (very faded meta, disabled). */
  mutedText: '#888',
  /** The player's neutral wash, and what cover extraction falls back to.
   *  A gradient endpoint rather than a card, which is why it is not `surface`
   *  — though one step of grey is all that separates them, and one of these
   *  two is probably surplus. */
  wash: '#121212',
} as const;

/**
 * White drawn over something darker.
 *
 * Distinct from `onDark`, which is opaque. A player card is not
 * `onDark.surfaceElevated` because the cover wash behind it has to reach the
 * eye through it — translucency is the point, not an approximation of a grey.
 *
 * These were `rgba(...)` literals in a dozen files, which is the one colour
 * spelling the lint rule never caught: it tests `value.value` against `/^#/`.
 * The values are exactly what each surface already drew. Several are near
 * misses of each other and want reconciling, but that is a decision about how
 * the player looks, not a rename, so it is deliberately not made here.
 */
export const veil = {
  /** A card on the player, over the cover wash. Four cards draw this. */
  card: 'rgba(255,255,255,0.07)',
  /** A card drawn inside another card — one step quieter so it still reads. */
  cardInner: 'rgba(255,255,255,0.06)',
  /** A row in the queue. Quieter again, because a list of them tiles. */
  row: 'rgba(255,255,255,0.05)',
  /** The queue row you are on, which has to read as picked out. */
  rowSelected: 'rgba(255,255,255,0.1)',
  /** A field on onboarding's dark flow. */
  field: 'rgba(255,255,255,0.08)',
  /** A hairline on a dark surface, and the chip behind text on one. */
  border: 'rgba(255,255,255,0.12)',
  /** The same hairline on the option that is chosen. */
  borderSelected: 'rgba(255,255,255,0.3)',
  /** The unfilled part of a slider's track. */
  track: 'rgba(255,255,255,0.15)',
  /** A tile over dark artwork — the light half of a pair with `shade.tint`.
   *  Holds the same value as `rowSelected` today, which is one of the near
   *  misses worth settling: they are two roles or they are one. */
  tint: 'rgba(255,255,255,0.1)',
} as const;

/**
 * Black drawn over something lighter — the mirror of {@link veil}.
 *
 * `scrim` is the one that carries text: it is what makes a title legible over
 * artwork whose brightness nothing controls.
 */
export const shade = {
  /** A tile over light artwork, and the chip behind text on a light surface. */
  tint: 'rgba(0,0,0,0.05)',
  chip: 'rgba(0,0,0,0.08)',
  /** Behind a detail screen's title, over its cover. */
  scrim: 'rgba(0, 0, 0, 0.35)',
  /** The same job where the artwork is dark enough to need the opposite. */
  scrimLight: 'rgba(255, 255, 255, 0.6)',
  /** Top to bottom behind the status bar over the scrolled player: the clock
   *  and the camera cutout on the dark end, fading out below them. */
  statusBar: ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)'] as const,
  /**
   * Under light text that sits directly on artwork.
   *
   * A scrim can only darken what it covers by a fixed amount, so it cannot
   * promise legibility over art that is nearly white — and album covers often
   * are. A shadow travels with the glyphs instead, which is the one thing that
   * holds wherever the letters land.
   */
  textOnArt: 'rgba(0,0,0,0.75)',
} as const;

/**
 * White text on a dark surface, at less than full strength.
 *
 * Six steps, which is more than the app needs and exactly what it had: each is
 * the value that surface already drew. Naming them is what makes the near
 * misses visible; folding them is a separate decision.
 */
export const onDarkAlpha = {
  /** Body text on a card over the wash. */
  prominent: 'rgba(255,255,255,0.75)',
  body: 'rgba(255,255,255,0.6)',
  /** A label or an icon that is present but not the point. */
  quiet: 'rgba(255,255,255,0.5)',
  quieter: 'rgba(255,255,255,0.45)',
  /** An action that cannot be taken right now. */
  disabled: 'rgba(255,255,255,0.4)',
  faint: 'rgba(255,255,255,0.3)',
} as const;

/**
 * Alpha appended to a theme colour, keyed by what the tint is for.
 *
 * Two strengths because a chosen control has to read as chosen, while a disc
 * behind an icon must not compete with the icon on it.
 */
const TINT_ALPHA = {
  /** A control in its selected state — a search scope pill. */
  selected: '26',
  /** A surface carrying a glyph — a settings row's icon disc, a badge. */
  surface: '18',
  /** The disc behind a toast's icon. Two parts in 255 from `surface`, which is
   *  to say indistinguishable; kept apart only because a release is the wrong
   *  moment to change a pixel nobody asked about. */
  toastIcon: '1A',
} as const;

/**
 * A theme colour at tint strength.
 *
 * This was `colors.themeColor + '26'` in three files with two different
 * alphas, which is the one colour spelling no rule can see: it is string
 * concatenation, not a literal. Assumes the six-digit hex every theme swatch
 * is written as — an `rgb()` or a named colour would come out of here as
 * nonsense, which is worth knowing before a theme is ever read from a server.
 */
export function tinted(color: string, strength: keyof typeof TINT_ALPHA): string {
  return `${color}${TINT_ALPHA[strength]}`;
}

/**
 * The accents a user can pick, the first being what a fresh install starts on.
 *
 * They were a literal list inside the swatch component, which is where a
 * colour is hardest to find and easiest to add a seventh of.
 */
export const themeColorPreset = [
  '#ff7f7f',
  '#ff9f43',
  '#ffd32a',
  '#0be881',
  '#54a0ff',
  '#5f27cd',
] as const;

/**
 * The fade from artwork into the screen below it, as `LinearGradient` stops.
 *
 * Both were written out stop-by-stop in the artist and genre headers, which is
 * six literals each and two places for them to stop agreeing. The direction
 * is chosen by the theme: a light screen fades artwork to white, a dark one
 * to black, and the midpoint is what stops the fade reading as a hard band.
 */
export const coverFade = {
  onDark: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,1)'],
  onLight: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,1)'],
  /** Darkening laid over an artist's photo so the text on it stays legible,
   *  whatever the photo turns out to be. Never fully transparent: the top of
   *  the image needs holding down too. */
  photoScrim: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.6)'],
  /**
   * The same job on a small tile, where the text sits in one corner.
   *
   * Heavier at the foot and lighter at the head than `photoScrim`, because a
   * browse tile writes a large name across its bottom edge and shows the art
   * everywhere else — and album covers carry their own lettering, so a name
   * laid on one at `photoScrim`'s weight lands white-on-white as often as not.
   * The top stays barely tinted so the art still reads as art.
   */
  tileScrim: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.88)'],
} as const;
