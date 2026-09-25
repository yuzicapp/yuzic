/**
 * How much room each browse tile gets.
 *
 * The first version of this screen drew every tag at the same size, which is
 * what made it read as another library grid: a uniform grid of squares says
 * "here are some things", and nothing in it says where to start. Size is the
 * cheapest way to say that, and we already know what to size by — how much of
 * the library sits behind each tag.
 *
 * So the biggest tag gets the width of the screen, the next two get half each,
 * and the tail settles into a smaller grid. The rhythm is fixed rather than
 * proportional to the counts: a library where one genre holds most of
 * everything would otherwise give that tag a tile ten times the size of the
 * next, and a screen with one enormous rectangle on it is not a browse screen.
 * Rank is the honest signal, and rank is all this uses.
 */

type TileShape = {
  /** Fraction of the row's width: 1 fills it, 1/3 puts three in a row. */
  span: number
  /** Height as a multiple of the tile's own width — heroes are letterboxed. */
  aspect: number
}

const HERO: TileShape = { span: 1, aspect: 0.42 }
const WIDE: TileShape = { span: 1 / 2, aspect: 0.8 }
const SMALL: TileShape = { span: 1 / 3, aspect: 1 }

/**
 * The shape for the tile at `rank`, most-owned first.
 *
 * One hero, then a pair, then threes. Below the third rank the pattern stops
 * changing: past the first few, the tags are all tails of each other and
 * varying them further would be decoration rather than information.
 */
export function tileShape(rank: number): TileShape {
  if (rank === 0) return HERO
  if (rank <= 2) return WIDE
  return SMALL
}

/**
 * Tile widths for one row's worth of tiles, given the content width.
 *
 * Returned rather than applied as a percentage because the art has to be laid
 * out at a real pixel size — a cover drawn into a percentage-width box has no
 * height to work from until layout has run, which is a frame of empty tiles on
 * every scroll.
 */
export function tileSize(shape: TileShape, contentWidth: number, gap: number) {
  // Each tile carries a gap on both sides, so a row of `n` spends `n * gap * 2`
  // on margins — the same arithmetic `gridItemWidth` does, for the same reason.
  const perRow = Math.round(1 / shape.span)
  const width = (contentWidth - perRow * gap * 2) / perRow
  return { width, height: Math.round(width * shape.aspect) }
}
