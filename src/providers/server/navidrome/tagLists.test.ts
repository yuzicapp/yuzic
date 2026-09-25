import { genresOf, loudnessOf, moodsOf } from './tagLists';

describe('genresOf', () => {
  it('reads the OpenSubsonic list, in the order the server gave it', () => {
    expect(genresOf({ genres: [{ name: 'Electronic' }, { name: 'Ambient' }] })).toEqual([
      'Electronic',
      'Ambient',
    ]);
  });

  it('accepts plain strings, which some servers send instead of objects', () => {
    expect(genresOf({ genres: ['Jazz', 'Bebop'] })).toEqual(['Jazz', 'Bebop']);
  });

  /** The bug this module exists for: albums used to read only this field. */
  it('falls back to the single legacy field when there is no list', () => {
    expect(genresOf({ genre: 'Rock' })).toEqual(['Rock']);
    expect(genresOf({ genre: 'Rock', genres: [] })).toEqual(['Rock']);
  });

  it('does not add the legacy field to the list, which would double the first genre', () => {
    expect(genresOf({ genre: 'Electronic', genres: [{ name: 'Electronic' }, { name: 'Ambient' }] }))
      .toEqual(['Electronic', 'Ambient']);
  });

  it('is empty when the origin names no genre at all', () => {
    expect(genresOf({})).toEqual([]);
    expect(genresOf({ genre: '' })).toEqual([]);
  });

  it('drops entries the server sent without a name', () => {
    expect(genresOf({ genres: [{ name: 'Jazz' }, {}, { name: '' }] })).toEqual(['Jazz']);
  });
});

describe('moodsOf', () => {
  it('reads the mood tags the files carry', () => {
    expect(moodsOf({ moods: ['Melancholy', 'Late night'] })).toEqual(['Melancholy', 'Late night']);
  });

  /**
   * Absent, not empty — a library with no mood tags should not be offered
   * mood as a way to browse. See `Album.moods`.
   */
  it('is undefined when the server says nothing about mood', () => {
    expect(moodsOf({})).toBeUndefined();
    expect(moodsOf({ moods: [] })).toBeUndefined();
  });

  it('is undefined when every reported mood is blank', () => {
    expect(moodsOf({ moods: ['', '  '] })).toBeUndefined();
  });

  it('ignores anything that is not a string', () => {
    expect(moodsOf({ moods: ['Calm', null, 7, { name: 'Sad' }] })).toEqual(['Calm']);
  });
});

describe('loudnessOf', () => {
  it('reads every figure the server measured', () => {
    expect(
      loudnessOf({
        replayGain: {
          trackGain: -6.5,
          albumGain: -3,
          trackPeak: 0.98,
          albumPeak: 1,
          baseGain: -2,
          fallbackGain: -8,
        },
      })
    ).toEqual({
      trackGainDb: -6.5,
      albumGainDb: -3,
      trackPeak: 0.98,
      albumPeak: 1,
      baseGainDb: -2,
      fallbackGainDb: -8,
    })
  })

  it('keeps a measured zero, which is a real figure', () => {
    expect(loudnessOf({ replayGain: { trackGain: 0 } })).toEqual({ trackGainDb: 0 })
  })

  /**
   * The spec says the object is always present on a song, so "present and
   * empty" is the normal shape for a library nobody has scanned. Reading that
   * as a measurement of zero would correct every untagged track.
   */
  it('is undefined for an unscanned library, which reports the object empty', () => {
    expect(loudnessOf({ replayGain: {} })).toBeUndefined()
    expect(loudnessOf({})).toBeUndefined()
  })

  it('ignores figures that are not numbers', () => {
    expect(loudnessOf({ replayGain: { trackGain: '-6' as never, albumGain: -3 } }))
      .toEqual({ albumGainDb: -3 })
  })
})
