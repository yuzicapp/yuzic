/**
 * The spacing scale.
 *
 * Named roles first, then the raw steps. Literal paddings ran to thirty
 * distinct values; the ones here are the ones real layouts actually wanted,
 * with the near-misses (13, 14, 18, 22, 30 and friends) folded onto the step
 * beside them.
 */
export const spacing = {
  page: 16,
  section: 24,
  rowGap: 12,
  controlGap: 10,
  inlineGap: 8,
  /**
   * Bottom breathing room for scrolling lists. Used to be 180 when the tab
   * bar + playing bar were a floating overlay screens had to reserve room
   * for — now that the tab bar is a real docked react-navigation tabBar,
   * screens naturally end at its top edge and this is just visual padding.
   */
  scrollClearance: 24,
  xxs: 2,
  xs: 4,
  tight: 6,
  sm: 8,
  md: 12,
  lg: 16,
  roomy: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  /** Empty states and sheet bodies, where the gap is the point. */
  generous: 48,
  /** The two detail-header skeletons, clearing a nav bar that overlays them. */
  headerOffset: 60,
  /**
   * The listening clock's plot area — twenty-four hour bars.
   *
   * Its own role rather than a reuse of `headerOffset`, which is the same
   * number today and means something unrelated: one is breathing room under a
   * nav bar, the other is how tall a chart reads. Tying them together would
   * make a nav-bar tweak silently resize a graph.
   */
  chartHeight: 60,
} as const;

export const motion = {
  pressIn: 80, pressOut: 150, quick: 140, titleFade: 180, favorite: 200,
  swipe: 220, contentFade: 240, modeChange: 300, washArrival: 450,
  indeterminate: 900, progress: 1000, backgroundArrival: 1200,
  easing: { linear: 'linear', standard: 'cubic' },
} as const;

export const shadow = {
  toast: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  primaryButton: { shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  selectedSwatch: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  none: { shadowOpacity: 0, elevation: 0 },
} as const;

/** The colours the app states outright — opaque roles, translucent veils and
 *  the cover fade — live in their own module; re-exported here so every style
 *  keeps one import. */
export {
  coverFade,
  fixedColor,
  onDark,
  onDarkAlpha,
  shade,
  sourceColor,
  statusColor,
  themeColorPreset,
  tinted,
  veil,
} from './colors';

/**
 * Pressed-state overlay opacity.
 *
 * One value for the whole app: the codebase had seven different `activeOpacity`
 * settings, which is seven answers to a question nobody was asking. Android
 * spends it on a ripple bounded to the component, iOS on a dip in opacity.
 */
export const stateLayer = {
  rippleDark: 'rgba(255, 255, 255, 0.12)',
  rippleLight: 'rgba(0, 0, 0, 0.10)',
  pressedOpacity: 0.6,
  disabledTextOpacity: 0.35, disabledOpacity: 0.4, inactiveOpacity: 0.45,
  mutedOpacity: 0.5, secondaryOpacity: 0.55, secondaryContentOpacity: 0.7,
  selectedOpacity: 0.9, decorativeOpacity: 0.07, subtleOpacity: 0.08,
} as const;

/**
 * The shape scale. Same rule as the type scale: pick by what the thing is.
 *
 * Literal `borderRadius` ran to twelve distinct values — 2, 4, 5, 6, 8, 10, 11,
 * 12, 14, 16, 24, 60 — which is one per developer-day rather than a decision.
 *
 * These are the **default** values, always static. The structural nudges
 * (`xs`/`sm`) are left this way on purpose — they round the corner of a
 * progress fill or a pressed row highlight, which is not shape the user is
 * choosing when they pick a preset.
 *
 * User-facing shape (album covers, row artwork, playing bar, player controls,
 * library tiles, buttons) reads its corners from {@link useRadius} instead,
 * which scales the same base numbers by whichever preset the user picked. This
 * is what {@link RadiusPreset} controls — it never reaches back to change these
 * defaults, so anything unmigrated stays at "default" regardless of preset.
 */
export type RadiusPreset = 'sharp' | 'default' | 'rounded';

export const radius = {
  /** Square by intent — a rule that spans the full width of a surface, where
   * rounded ends would read as a detached bar rather than an edge. */
  none: 0,
  xs: 4,
  sm: 6,
  /** Artwork in a row — the thumbnail beside a track, a playlist, a search
   * result. The single most repeated shape in the app, so it scales with the
   * preset (via {@link useRadius}) rather than holding still while the cards
   * around it move. */
  thumb: 6,
  md: 8,
  card: 12,
  lg: 16,
  /** The now-playing screen's cards, which are large enough that a card radius
   * reads as a sharp corner on them. */
  panel: 24,
  pill: 999,
} as const;

/** Multiplier applied to each base radius by preset. `pill` (>= 100) is
 *  special-cased in {@link scaleRadius}: it always stays a pill, since a
 *  circular button reads as a bug when it squares up under `sharp`. `sharp`
 *  is a softly-rounded square rather than a razor corner — the razor version
 *  had no real use, and cards under it looked broken. */
const RADIUS_MULTIPLIER: Record<RadiusPreset, number> = {
  sharp: 0.35,
  default: 1,
  rounded: 1.75,
};

/** Scales one base value by preset. Pill (>= 100) stays pill under every
 *  preset — a circular play button should not become a square, and a pill
 *  scaled 1.75x is still a pill. A base radius under `sharp` rounds up to at
 *  least 1 so a corner never lands flat when the intent was "softly square". */
export function scaleRadius(base: number, preset: RadiusPreset): number {
  if (base >= 100) return base;
  const m = RADIUS_MULTIPLIER[preset];
  const scaled = Math.round(base * m);
  return preset === 'sharp' ? Math.max(scaled, 1) : scaled;
}

/** The type scale lives in its own module; re-exported here so every style keeps one import. */
export { cappedTypography, fontScaleCap, typography, withScaledLeading } from './typography';
export { TEXT_SCALES } from './textScales';

/** The window scale does too — breakpoints and the caps a column is held to. */
export { breakpoint, contentWidth } from './window';

export const controlSize = {
  /**
   * The smallest a tap target may be, in points.
   *
   * Apple's minimum; Material asks for 48. A control is allowed to *look*
   * smaller than this — a 34pt toggle next to a 34pt pill is the right drawing
   * — but what the finger has to hit never is. Use `hitSlopFor` to make up the
   * difference rather than growing the control.
   */
  minimumTarget: 44,
  iconDefault: 44,
  iconCompact: 36,
  /** The circles either side of a detail screen's play pill. The same height
   *  as the pill on purpose: three controls on one row that stop at three
   *  different heights read as three unrelated controls, and the eye picks the
   *  mismatch out long before it names it. Only the widths differ. */
  detailSecondary: 48,
  /** The player's quietest controls — cast and queue, under the 68pt play
   *  button. Drawn small deliberately; they borrowed `detailSecondary` back
   *  when both happened to be 40. */
  playerSecondary: 40,
  /** A control that sits inline with text — the library's sort pill and the
   *  toggle beside it, a recent-search chip. 34pt drawn, padded out to the
   *  minimum tap target by `hitSlopFor`. */
  inlineControl: 34,
  detailPrimaryWidth: 112,
  detailPrimaryHeight: 48,
  /** The full-screen player's play button — the biggest control in the app,
   *  and the one a thumb finds without looking. */
  playerPrimary: 68,
  mediaRowArt: 64,
  compactMediaRowArt: 44,
  topBarHeight: 52,
  /**
   * The account's own picture, at the three places it is drawn.
   *
   * A scale rather than three literals, because these were three separate
   * numbers in three files before the avatar became one component and the
   * near-misses had already started: 44 in the sheet against 48 in the card
   * would have been a fourth. Each is the size that surface already drew, so
   * adding the picture moved no layout.
   */
  avatarTabHeader: 32,
  avatarSheet: 44,
  avatarProfileCard: 52,
} as const;

/**
 * The glyph scale.
 *
 * Same rule as the type and shape scales, one axis over: pick by what the
 * glyph is doing, not by how big it should be. Literal `size={n}` ran to 20
 * distinct values across 294 icons, with the usual near-misses — 17 beside 18,
 * 21 beside 20, 23 beside 24, 13 and 12 beside 14 — which is drift rather than
 * a decision, and nothing linted it because `size` is a JSX attribute rather
 * than a style property.
 *
 * Adding a role here is fine. Adding one that differs from an existing role
 * only in size is how the app got thirteen font sizes.
 */
export const iconSize = {
  /** A glyph inside a badge, on top of another control. */
  marker: 10,
  /** An inline marker beside a row's own text — a download arrow, a heart, a
   *  warning triangle on a subtitle. */
  badge: 14,
  /** Sits inline with body text at its own size. */
  inline: 16,
  /** The default: a row action, a small control, a settings chevron. */
  row: 18,
  /** A control that carries a little more weight than a row action. */
  control: 20,
  /** The player's quieter transport — cast, queue, the controls flanking
   *  shuffle and repeat. */
  secondary: 22,
  /** Navigation and header icons, and a detail screen's circle actions. */
  header: 24,
  /** A whole-sheet or whole-screen loader. `SpinningLoaderCircle` at 18 sits
   *  inside a control instead; both numbers are the convention in AGENTS.md. */
  loader: 26,
  /** A large standalone control — the player's add button, a card's spinner. */
  large: 28,
  /** The player's skip buttons, either side of the 68pt play button. */
  transport: 34,
  /** A server type's logo or glyph on the connect and server-list screens. */
  providerLogo: 36,
  /** The glyph an empty state is built around. */
  emptyState: 40,
  /** Oversized and faded, as texture rather than as an icon — the moon behind
   *  the sleep timer, the dial behind playback speed. */
  decorative: 96,
} as const;

/**
 * The padding a control of this size needs to reach the minimum tap target.
 *
 * Returns undefined when it already does, so it can be spread onto a component
 * unconditionally without adding a slop of zero.
 */
export function hitSlopFor(size: number) {
  const missing = controlSize.minimumTarget - size;
  if (missing <= 0) return undefined;
  const pad = Math.ceil(missing / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
}

/**
 * The vertical rhythm of a list row — how much air it has above and below.
 *
 * This is the user's choice rather than a per-screen one, which is why it
 * replaced the old fixed `rowDensity` scale: that had three densities a screen
 * picked from and two of the three were never picked. The three roles here are
 * the three shapes a row actually comes in, and each moves one step of the
 * spacing scale per density, so the whole app loosens or tightens together
 * instead of one list changing while the next holds still.
 *
 * Only the rhythm moves. Artwork and type stay the size they are at every
 * density — a "compact" list that also shrank the covers would be a different
 * design rather than a denser one.
 *
 * The `default` column is what every list rendered before the setting existed,
 * so an untouched install does not move.
 */
export type ListDensity = 'compact' | 'default' | 'spacious';

export const listDensity: Record<
  ListDensity,
  {
    /** Gap below a row that stands on its own — an album, artist or playlist. */
    rowGap: number;
    /** Padding inside a compact row, which sits flush against the next one. */
    rowPadding: number;
    /** Padding inside a track row, which is compact but carries a whole
     *  record's worth of them and needs the extra step. */
    trackRowPadding: number;
    /** Padding inside a library row. Its own role because the library draws
     *  tighter than the rest of the app on purpose — 52pt artwork rather than
     *  64pt, so a collection of five hundred stays scannable. Folding it into
     *  `rowPadding` would have loosened every library list by two points the
     *  moment the setting shipped. */
    libraryRowPadding: number;
  }
> = {
  compact: {
    rowGap: spacing.sm,
    rowPadding: spacing.xs,
    trackRowPadding: spacing.sm,
    libraryRowPadding: spacing.xs,
  },
  default: {
    rowGap: spacing.lg,
    rowPadding: spacing.sm,
    trackRowPadding: spacing.md,
    libraryRowPadding: spacing.tight,
  },
  spacious: {
    rowGap: spacing.xl,
    rowPadding: spacing.md,
    trackRowPadding: spacing.roomy,
    libraryRowPadding: spacing.controlGap,
  },
};

export type SemanticThemeColors = {
  themeColor: string;
  background: string;
  card: string;
  text: string;
  secondary: string;
  subtext: string;
  border: string;
  muted: string;
  placeholder: string;
  overlay: string;
  statusSurface: string;
  onThemeColor: string;
  success: string;
  warning: string;
  /** Alias for `destructive`. Kept for callers that read `error`. */
  error: string;
  /** Destructive action color — dark-mode aware (`#FF453A` dark / `#FF3B30` light). */
  destructive: string;
  /** Background surface for a destructive info card. */
  destructiveSurface: string;
  /** Border on a destructive info card. */
  destructiveBorder: string;
  /** Text color on a destructive info card. */
  destructiveOnSurface: string;
  /** Warning-toned foreground for inline text like unsaved-changes hints. */
  warningText: string;
  /** Elevated surface for floating transient UI (toasts) that must read as
   *  distinct from the playing bar / tab bar, which both use `card`. */
  toastSurface: string;
};
