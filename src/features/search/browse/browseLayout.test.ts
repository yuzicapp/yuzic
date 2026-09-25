import { tileSpan, tileWidth } from './browseLayout'

describe('tileSpan', () => {
  it('widens the biggest tag, and only that one', () => {
    expect(tileSpan(0, 3)).toBe(2)
    expect(tileSpan(1, 3)).toBe(1)
    expect(tileSpan(9, 3)).toBe(1)
  })

  /**
   * Two cells of a two-column grid is the full width, which is the billboard
   * this was rewritten to stop being.
   */
  it('leaves every tile alone on a narrow grid', () => {
    expect(tileSpan(0, 2)).toBe(1)
    expect(tileSpan(0, 1)).toBe(1)
  })

  it('still widens on a roomier grid', () => {
    expect(tileSpan(0, 4)).toBe(2)
    expect(tileSpan(0, 6)).toBe(2)
  })
})

describe('tileWidth', () => {
  const CELL = 100
  const GAP = 8

  it('leaves a single cell as the grid sized it', () => {
    expect(tileWidth(1, CELL, GAP)).toBe(CELL)
  })

  /**
   * Two cells *plus the gap that would have sat between them*, so the wide
   * tile's right edge lines up with the cell above it rather than falling
   * short by one gap.
   */
  it('spans two cells and the gap between them', () => {
    expect(tileWidth(2, CELL, GAP)).toBe(CELL * 2 + GAP * 2)
  })
})
