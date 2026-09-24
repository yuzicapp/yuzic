import { contentWidth, spacing } from '@/constants/design'
import { playerLayout } from './playerLayout'

const portrait = (width: number, height: number) =>
  playerLayout({ width, height, landscape: false })
const landscape = (width: number, height: number) =>
  playerLayout({ width, height, landscape: true })

describe('playerLayout', () => {
  it('draws the phone player exactly as it drew it before', () => {
    // `width - 48` and a square of the same side, which is what the screen
    // hard-coded. A change here is a change every user sees.
    for (const width of [320, 375, 390, 430]) {
      const layout = portrait(width, 844)
      expect(layout.mode).toBe('stacked')
      expect(layout.columnWidth).toBe(width - spacing.section * 2)
      expect(layout.coverSize).toBe(width - spacing.section * 2)
    }
  })

  it('draws the tablet player at the 500pt column it was capped to', () => {
    const layout = portrait(768, 1024)
    expect(layout.columnWidth).toBe(contentWidth.player)
    expect(layout.coverSize).toBe(contentWidth.player)
  })

  it('splits in landscape, whatever the window is otherwise', () => {
    expect(landscape(844, 390).mode).toBe('split')
    expect(landscape(667, 375).mode).toBe('split')
    expect(landscape(1366, 1024).mode).toBe('split')
  })

  it('never lets the artwork outgrow a short window', () => {
    // The bug this exists for: stacked, a phone on its side asked for a
    // square wider than the window was tall and the transport left the screen.
    for (const [width, height] of [[844, 390], [667, 375], [932, 430]]) {
      const layout = landscape(width, height)
      expect(layout.coverSize).toBeLessThan(height)
    }
  })

  it('fits the cover, the gap and the column inside the window', () => {
    const windows: [number, number][] = [
      [844, 390], [667, 375], [1024, 768], [1366, 1024], [800, 780],
    ]
    for (const [width, height] of windows) {
      const layout = landscape(width, height)
      expect(layout.coverSize + layout.columnGap + layout.columnWidth).toBeCloseTo(layout.rowWidth)
      expect(layout.rowWidth).toBeLessThanOrEqual(width - spacing.section * 2)
    }
  })

  it('gives the artwork no more than half the row', () => {
    const layout = landscape(1366, 1024)
    expect(layout.coverSize).toBeLessThanOrEqual(layout.rowWidth / 2)
  })

  it('caps the split at two columns rather than spanning a 13-inch screen', () => {
    const layout = landscape(2000, 1200)
    expect(layout.columnWidth).toBe(contentWidth.player)
    expect(layout.coverSize).toBe(contentWidth.player)
  })

  it('never returns a negative size in a window too small to lay out', () => {
    for (const layout of [portrait(40, 40), landscape(40, 20), portrait(0, 0)]) {
      expect(layout.coverSize).toBeGreaterThanOrEqual(0)
      expect(layout.rowWidth).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('the compact player', () => {
  it('puts a small cover beside the title, in the same column', () => {
    const artwork = playerLayout({ width: 390, height: 844, landscape: false })
    const compact = playerLayout({ width: 390, height: 844, landscape: false }, 'compact')

    expect(compact.inline).toBe(true)
    expect(artwork.inline).toBe(false)
    expect(compact.coverSize).toBeLessThanOrEqual(128)
    expect(compact.coverSize).toBeGreaterThan(0)
    expect(compact.columnWidth).toBe(artwork.columnWidth)
  })

  it('keeps the cover a thumbnail on a wide window', () => {
    expect(playerLayout({ width: 1024, height: 1366, landscape: false }, 'compact').coverSize).toBe(128)
  })

  it('leaves the landscape player as it is', () => {
    const window = { width: 844, height: 390, landscape: true }
    expect(playerLayout(window, 'compact')).toEqual(playerLayout(window))
  })
})

describe('the full-width player', () => {
  it('runs the cover to both edges while the column keeps its inset', () => {
    const artwork = playerLayout({ width: 390, height: 844, landscape: false })
    const full = playerLayout({ width: 390, height: 844, landscape: false }, 'fullWidth')

    expect(full.bleed).toBe(true)
    expect(full.coverSize).toBe(390)
    expect(full.columnWidth).toBe(artwork.columnWidth)
  })

  it('caps the cover in a short window rather than pushing the controls off it', () => {
    expect(playerLayout({ width: 600, height: 700, landscape: false }, 'fullWidth').coverSize).toBeLessThanOrEqual(700 * 0.55)
  })

  it('leaves the landscape player as it is', () => {
    const window = { width: 844, height: 390, landscape: true }
    expect(playerLayout(window, 'fullWidth')).toEqual(playerLayout(window))
  })
})
