/**
 * What the origin measured about a track's loudness, in ReplayGain's terms.
 *
 * Every figure is optional and absent means "the origin did not measure it",
 * which is emphatically not zero: 0 dB is a real measurement meaning "already
 * at reference loudness", and treating an unmeasured track as one is how
 * normalisation makes an untagged library sound worse than leaving it alone.
 *
 * Both the track and the album figure are kept rather than one being chosen
 * here, because which one is right is the listener's setting, not the server's:
 * track gain levels every track against every other, and album gain levels
 * albums against each other while leaving the quiet track on a loud record
 * quiet, which is how the record was mastered to sound.
 */
export interface Loudness {
  /** Gain to apply to level this track against others, in dB. */
  trackGainDb?: number;
  /** Gain to apply to level this track's album against others, in dB. */
  albumGainDb?: number;
  /** Sample peak, 1.0 being full scale. Guards against clipping on boost. */
  trackPeak?: number;
  /** The loudest peak on the album, for album-mode's clipping guard. */
  albumPeak?: number;
  /**
   * A gain the format itself carries, separate from the measurement — Opus
   * output gain is the case the spec names. Additive to whichever figure is
   * chosen, since it describes the decoder's output rather than the mastering.
   */
  baseGainDb?: number;
  /** What the origin suggests for tracks it has no measurement for. */
  fallbackGainDb?: number;
}

/** Which of the two measurements a listener wants applied. */
type LoudnessMode = 'off' | 'track' | 'album'

/**
 * The single gain figure and peak to hand the player, for a mode.
 *
 * Album mode falls back to the track figure rather than to nothing: an album
 * the server measured per-track but not as a whole is still better levelled by
 * its track gain than by silence about it. `baseGainDb` is added on top of
 * whichever figure wins, because it describes a different thing.
 */
export function loudnessFor(
  loudness: Loudness | undefined,
  mode: LoudnessMode
): { gainDb?: number; peak?: number } {
  if (!loudness || mode === 'off') return {}

  const measured =
    mode === 'album'
      ? loudness.albumGainDb ?? loudness.trackGainDb
      : loudness.trackGainDb

  const gain = measured ?? loudness.fallbackGainDb
  if (gain === undefined) return {}

  const peak = mode === 'album' ? loudness.albumPeak ?? loudness.trackPeak : loudness.trackPeak

  return { gainDb: gain + (loudness.baseGainDb ?? 0), peak }
}
