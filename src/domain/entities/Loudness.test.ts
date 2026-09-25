import { loudnessFor } from './Loudness'

describe('loudnessFor', () => {
  it('applies nothing when the listener has it off', () => {
    expect(loudnessFor({ trackGainDb: -6 }, 'off')).toEqual({})
  })

  it('applies nothing for a track the origin never measured', () => {
    expect(loudnessFor(undefined, 'track')).toEqual({})
    expect(loudnessFor({}, 'track')).toEqual({})
  })

  it('takes the track figure in track mode', () => {
    expect(loudnessFor({ trackGainDb: -6.5, albumGainDb: -3, trackPeak: 0.98 }, 'track'))
      .toEqual({ gainDb: -6.5, peak: 0.98 })
  })

  it('takes the album figure and the album peak in album mode', () => {
    expect(loudnessFor({ trackGainDb: -6.5, albumGainDb: -3, trackPeak: 0.9, albumPeak: 1 }, 'album'))
      .toEqual({ gainDb: -3, peak: 1 })
  })

  /**
   * An album measured per-track but not as a whole is still better levelled by
   * its track figure than by nothing.
   */
  it('falls back to the track figure in album mode when there is no album one', () => {
    expect(loudnessFor({ trackGainDb: -6.5, trackPeak: 0.9 }, 'album'))
      .toEqual({ gainDb: -6.5, peak: 0.9 })
  })

  it('does not fall back the other way — track mode never uses the album figure', () => {
    expect(loudnessFor({ albumGainDb: -3 }, 'track')).toEqual({})
  })

  it("uses the origin's own fallback where it measured nothing itself", () => {
    expect(loudnessFor({ fallbackGainDb: -8 }, 'track')).toEqual({ gainDb: -8, peak: undefined })
  })

  it('prefers a real measurement over the fallback', () => {
    expect(loudnessFor({ trackGainDb: -6, fallbackGainDb: -8 }, 'track').gainDb).toBe(-6)
  })

  /**
   * A gain the format carries describes the decoder's output, not the
   * mastering, so it is additive to whichever measurement wins.
   */
  it('adds the format’s own base gain on top', () => {
    expect(loudnessFor({ trackGainDb: -6, baseGainDb: -2 }, 'track').gainDb).toBe(-8)
    expect(loudnessFor({ albumGainDb: -3, baseGainDb: 1.5 }, 'album').gainDb).toBe(-1.5)
  })

  /**
   * Zero is a measurement — "already at reference" — and must not be read as
   * the absence of one, or a correctly-levelled track would fall through to
   * the fallback and be moved off reference.
   */
  it('treats a measured 0 dB as a measurement, not as nothing', () => {
    expect(loudnessFor({ trackGainDb: 0, fallbackGainDb: -8 }, 'track').gainDb).toBe(0)
  })
})
