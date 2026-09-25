/**
 * Crossfade and equalizer, as the app stores and offers them.
 *
 * These mirror yuzic-engine's own types rather than re-exporting them, for the
 * same reason `mediaItem.ts` does: these values are persisted in Redux and read
 * by settings screens that have no business importing a player library.
 */

export interface CrossfadeSettings {
  /** Seconds of overlap. */
  durationSec: number;
  /**
   * `gapless-aware` hard-cuts where a track is marked as following the
   * previous one, so a segued album is not faded through its own joins.
   * `always` fades everything, which some people want for shuffle.
   */
  mode: 'always' | 'gapless-aware';
  /**
   * Cut rather than fade when the *user* pressed next. A fade is for a track
   * that ended; a skip should feel immediate.
   */
  skipIsImmediate: boolean;
}

/** One band. Frequency in Hz, gain in dB. */
/**
 * Levelling every track to one loudness, from the server's own measurements.
 *
 * Deliberately narrower than the engine's `ReplayGainOptions`: a switch and a
 * preamp, where the engine also offers track/album/auto modes. Those three
 * behave identically today because the engine's `Track` carries a single gain
 * figure rather than a track/album pair, so offering the choice would be
 * offering three names for one behaviour. Album mode wants an engine change,
 * not a settings entry.
 */
export interface LoudnessSettings {
  enabled: boolean;
  /** Extra gain on top of the correction, in dB. */
  preampDb: number;
}

export interface EqualizerBand {
  frequencyHz: number;
  gainDb: number;
}

/**
 * The bands the UI offers, fixed rather than user-defined.
 *
 * Ten octave-spaced centres from 32Hz to 16kHz — the layout every hardware
 * graphic EQ has used for decades, which matters because the shape people
 * expect to see *is* the interface. A custom set would be more flexible and
 * less usable.
 */
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/**
 * How far a band can be pushed, in dB.
 *
 * ±12 rather than the ±20 some players offer. Past about 12dB of boost the
 * result is clipping rather than tone, and a slider whose top third only makes
 * things worse is a slider that lies about what it does.
 */
export const EQ_GAIN_LIMIT_DB = 12;

/**
 * Named curves, as offsets in dB per band.
 *
 * Kept deliberately gentle. A preset that sounds dramatic in a shop demo is
 * one people turn off within a week, and every one of these has to survive
 * being left on.
 */
export const EQ_PRESETS: { id: string; labelKey: string; gains: number[] }[] = [
  {
    id: 'flat',
    labelKey: 'settings.player.equalizer.presetFlat',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'bass',
    labelKey: 'settings.player.equalizer.presetBass',
    gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'treble',
    labelKey: 'settings.player.equalizer.presetTreble',
    gains: [0, 0, 0, 0, 0, 1, 2, 4, 5, 5],
  },
  {
    id: 'vocal',
    labelKey: 'settings.player.equalizer.presetVocal',
    gains: [-2, -2, 0, 2, 4, 4, 3, 1, 0, 0],
  },
  {
    id: 'loudness',
    labelKey: 'settings.player.equalizer.presetLoudness',
    gains: [5, 4, 2, 0, -1, -1, 0, 2, 4, 5],
  },
];

/** A preset's gains as bands the engine can take. */
export function presetToBands(gains: number[]): EqualizerBand[] {
  return EQ_FREQUENCIES.map((frequencyHz, index) => ({
    frequencyHz,
    gainDb: gains[index] ?? 0,
  }));
}

/**
 * Which preset a set of bands corresponds to, or `null` for a custom curve.
 *
 * Used so that opening the screen after dragging a slider does not show a
 * preset the sound no longer matches. Compared exactly because the presets are
 * whole numbers and the sliders step in whole numbers.
 */
export function matchPreset(bands: EqualizerBand[]): string | null {
  const found = EQ_PRESETS.find(preset =>
    preset.gains.every((gain, index) => bands[index]?.gainDb === gain)
  );
  return found?.id ?? null;
}

/** True when no band is doing anything, so the engine can bypass entirely. */
export function isFlat(bands: EqualizerBand[]): boolean {
  return bands.every(band => band.gainDb === 0);
}
