import { tileShape, tileSize } from './browseLayout'

describe('tileShape', () => {
  /**
   * The point of the whole layout: the grid used to be uniform, which is what
   * made it read as another library screen.
   */
  it('gives the biggest tag the width of the screen', () => {
    expect(tileShape(0).span).toBe(1)
  })

  it('pairs the next two', () => {
    expect(tileShape(1).span).toBeCloseTo(1 / 2)
    expect(tileShape(2).span).toBeCloseTo(1 / 2)
  })

  it('settles the tail into threes and stays there', () => {
    expect(tileShape(3).span).toBeCloseTo(1 / 3)
    expect(tileShape(11).span).toBeCloseTo(1 / 3)
    expect(tileShape(50)).toEqual(tileShape(3))
  })

  it('letterboxes the hero and squares the tail', () => {
    expect(tileShape(0).aspect).toBeLessThan(tileShape(1).aspect)
    expect(tileShape(3).aspect).toBe(1)
  })
})

describe('tileSize', () => {
  const GAP = 8
  const CONTENT = 360

  it('fills the row, gaps included', () => {
    const hero = tileSize(tileShape(0), CONTENT, GAP)
    expect(hero.width + GAP * 2).toBe(CONTENT)
  })

  it('fits two halves and three thirds in the same width', () => {
    const half = tileSize(tileShape(1), CONTENT, GAP)
    const third = tileSize(tileShape(3), CONTENT, GAP)

    expect(half.width * 2 + GAP * 4).toBeCloseTo(CONTENT)
    expect(third.width * 3 + GAP * 6).toBeCloseTo(CONTENT)
  })

  it('derives height from the shape, not from layout', () => {
    const third = tileSize(tileShape(3), CONTENT, GAP)
    expect(third.height).toBe(Math.round(third.width))
  })
})
