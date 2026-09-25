/**
 * How much room each browse tile gets.
 *
 * Measured in *cells* of the same grid the library uses, not in fractions of
 * the screen. The first version invented its own sizes — a full-width hero,
 * then halves, then thirds — which ignored the grid-density setting every
 * other grid in the app respects, and came out visibly larger than anything
 * around it. The hierarchy was the point; the scale was an accident of not
 * asking.
 *
 * So the rhythm stays and the unit changes: one tag is given two cells instead
 * of one, and everything else takes a single cell at whatever density the
 * listener has chosen. At the default of three columns that is a tile two
 * thirds of the width — an accent, not a billboard.
 */

/** Cells wide. Tiles are one cell tall whatever their width. */
type TileSpan = 1 | 2

/**
 * How wide the tile at `rank` is, most-owned first.
 *
 * Only the first tag is widened, and only when the grid is wide enough for it
 * to still leave a neighbour beside it. On a two-column grid a two-cell tile
 * is a full-width banner, which is the thing this was rewritten to stop being.
 */
export function tileSpan(rank: number, columns: number): TileSpan {
  return rank === 0 && columns >= 3 ? 2 : 1
}

/**
 * The width of a tile spanning `span` cells.
 *
 * Built from the single-cell width rather than from the row: a two-cell tile
 * is two cells plus the gap that would have sat between them, so it lines up
 * with the cells above and below it instead of being merely twice as wide.
 */
export function tileWidth(span: TileSpan, cellWidth: number, gap: number): number {
  return cellWidth * span + gap * 2 * (span - 1)
}
