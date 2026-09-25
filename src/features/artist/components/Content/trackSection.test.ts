import { COLLAPSED_TRACK_ROWS, MAX_TRACK_ROWS, visibleTrackRows } from './trackSection'

/**
 * The artist screen's three track sections had three different ideas about how
 * many rows to show — ten with no way past it, five fixed at fetch time, and
 * five opening to ten — and only the last was deliberate. This is the rule
 * they now share.
 */
describe('how many track rows an artist section shows', () => {
  it('shows five while closed', () => {
    expect(visibleTrackRows(10, false)).toBe(COLLAPSED_TRACK_ROWS)
    expect(visibleTrackRows(50, false)).toBe(COLLAPSED_TRACK_ROWS)
  })

  it('shows ten when opened, and no more — a chart is a peek, not a list', () => {
    expect(visibleTrackRows(50, true)).toBe(MAX_TRACK_ROWS)
  })

  it('never claims more rows than there are', () => {
    expect(visibleTrackRows(3, false)).toBe(3)
    expect(visibleTrackRows(3, true)).toBe(3)
    expect(visibleTrackRows(0, true)).toBe(0)
  })
})
