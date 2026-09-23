import { contentWidth, spacing } from '@/constants/design'
import { cappedContentWidth, squareArtSize } from '@/features/layout/windowClass'

/**
 * Which shape the full-screen player is in.
 *
 * `stacked` is the player everyone knows: artwork, then the title, then the
 * transport, down the middle of the screen. `split` puts the artwork beside
 * them instead, which is the only layout that works in a window shorter than
 * it is wide — stacked in landscape asked for an 800pt square in a 390pt-tall
 * window and pushed the play button off the bottom of the screen.
 */
type PlayerLayoutMode = 'stacked' | 'split'

export type PlayerLayout = {
  mode: PlayerLayoutMode
  /** The side of the artwork square. */
  coverSize: number
  /** The column holding the title, the progress bar and the transport. */
  columnWidth: number
  /** The whole thing: one column stacked, or cover + gap + column split. */
  rowWidth: number
  /** Between the cover and the column. Zero when they are not side by side. */
  columnGap: number
  /**
   * The compact player: a small cover beside the title, with the progress bar
   * and transport full width below, instead of a cover above everything.
   */
  inline: boolean
}

/**
 * The inset the player has always drawn its content at — `width - 48` written
 * as the two page steps it was.
 */
const PLAYER_INSET = spacing.section

/** Between the artwork and the column beside it. */
const SPLIT_GAP = spacing.section

/**
 * The widest the split player draws, whatever the window.
 *
 * Two player columns and the gap between them. A 13" iPad in landscape is
 * 1366pt wide and a player stretched across all of it is a cover at one end
 * and a play button at the other, with the title floating somewhere in the
 * middle — the thing the eye cannot hold together.
 */
const SPLIT_MAX_WIDTH = contentWidth.player * 2 + SPLIT_GAP

/**
 * How much of the window's height the artwork may take.
 *
 * Reasoned rather than measured, and the reasoning is the whole argument for
 * the number: stacked, the cover shares the screen with a header, a title, a
 * progress bar, a transport row and the output/queue pair, so half is the
 * most it can have and leave them room. Split, it shares the height with
 * nothing — only the header and the bottom row are above and below it — so it
 * gets more.
 *
 * A share rather than "the window minus the chrome" because the chrome is
 * laid out *around* the cover: measuring it and then sizing the cover from
 * the answer is a loop, and the first thing such a loop does on a real device
 * is oscillate. These are the two numbers that keep every window the app has
 * ever opened in exactly the layout it already had — see the tests.
 */
const COVER_HEIGHT_SHARE: Record<PlayerLayoutMode, number> = {
  stacked: 0.5,
  split: 0.6,
}

/**
 * The compact player's cover, beside the title: a share of the column, capped
 * so it stays a thumbnail on a tablet rather than growing back into a poster.
 */
const INLINE_COVER = { share: 0.3, max: 128 }

/** Which player the theme asks for. Only the stacked shape has a compact form. */
type PlayerLayoutVariant = 'artwork' | 'compact'

/**
 * How the player lays itself out in this window.
 *
 * Landscape decides the mode, not the size class: a 667pt iPhone SE on its
 * side is a narrow window by every other measure and still has two and a half
 * times more width than height, which is the only fact the player cares
 * about.
 */
export function playerLayout(
  window: {
    width: number
    height: number
    landscape: boolean
  },
  variant: PlayerLayoutVariant = 'artwork',
): PlayerLayout {
  // Floored, because every size below is derived from it and a window
  // narrower than its own insets would otherwise hand the layout a negative
  // square. Nothing renders at 40pt, but nothing should return -8 either.
  const available = Math.max(window.width - PLAYER_INSET * 2, 0)

  if (!window.landscape) {
    const columnWidth = cappedContentWidth(available, contentWidth.player)
    const inline = variant === 'compact'
    const coverSize = inline
      ? Math.min(Math.round(columnWidth * INLINE_COVER.share), INLINE_COVER.max)
      : squareArtSize(columnWidth, window.height * COVER_HEIGHT_SHARE.stacked)
    return {
      mode: 'stacked',
      coverSize,
      columnWidth,
      rowWidth: columnWidth,
      columnGap: 0,
      inline,
    }
  }

  const rowWidth = Math.min(available, SPLIT_MAX_WIDTH)
  // Never past half the row: the cover taking two thirds of it and the title
  // wrapping to four lines in what is left is not a player, it is a poster
  // with a caption.
  const coverSize = squareArtSize(
    Math.min((rowWidth - SPLIT_GAP) / 2, contentWidth.player),
    window.height * COVER_HEIGHT_SHARE.split
  )
  const columnWidth = Math.max(
    Math.min(rowWidth - coverSize - SPLIT_GAP, contentWidth.player),
    0
  )
  return {
    mode: 'split',
    coverSize,
    columnWidth,
    // Recomputed rather than `rowWidth`: once the cover is bounded by height
    // the pair is narrower than the row it was allowed, and the row has to
    // shrink to them or the whole thing sits off-centre.
    rowWidth: coverSize + SPLIT_GAP + columnWidth,
    columnGap: SPLIT_GAP,
    inline: false,
  }
}
