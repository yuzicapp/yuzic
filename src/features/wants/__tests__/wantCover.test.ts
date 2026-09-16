import { wantCover } from '../wantCover';

/**
 * The artwork half of the Wants bug: a want stored no cover at all, so its row
 * had nothing to draw and nothing to *ask* about either — the one picture rule
 * stops at a `{ kind: 'none' }` that names no subject. What it needs is the
 * subject, which is what these assert.
 */
describe('wantCover', () => {
  it('keeps the picture the source already had', () => {
    const own = { kind: 'url' as const, url: 'https://example.test/cover.jpg' };

    expect(wantCover({ unit: 'album', cover: own, title: 'Kid A', artist: 'Radiohead' })).toBe(own);
  });

  it('names the album a release want is of, so a backup can be asked for it', () => {
    const cover = wantCover({
      unit: 'album', cover: { kind: 'none' }, title: 'Kid A', artist: 'Radiohead',
    });

    expect(cover).toEqual({
      kind: 'none',
      subject: { kind: 'album', title: 'Kid A', artistName: 'Radiohead' },
    });
  });

  it('carries the MBID through, which is what an archive looks a release up by', () => {
    const cover = wantCover({
      unit: 'album',
      cover: { kind: 'none' },
      title: 'Kid A',
      artist: 'Radiohead',
      externalIds: { mbid: 'mbid-1', mbidType: 'release-group' },
    });

    expect(cover).toEqual({
      kind: 'none',
      subject: { kind: 'album', title: 'Kid A', artistName: 'Radiohead', mbid: 'mbid-1', mbidType: 'release-group' },
    });
  });

  it('looks a track want up as its album, which is the art that exists', () => {
    const cover = wantCover({
      unit: 'track', cover: { kind: 'none' }, title: 'Idioteque', artist: 'Radiohead',
    });

    expect(cover).toEqual({
      kind: 'none',
      subject: { kind: 'album', title: 'Idioteque', artistName: 'Radiohead' },
    });
  });

  it('names an artist want as a person, not as a release', () => {
    const cover = wantCover({
      unit: 'artist', cover: { kind: 'none' }, title: 'Radiohead', artist: 'Radiohead',
    });

    expect(cover).toEqual({ kind: 'none', subject: { kind: 'artist', name: 'Radiohead' } });
  });

  it('files a featured credit under its lead artist, as every other surface does', () => {
    const cover = wantCover({
      unit: 'artist', cover: { kind: 'none' }, title: 'Drake feat. Rihanna', artist: 'Drake feat. Rihanna',
    });

    expect(cover).toEqual({ kind: 'none', subject: { kind: 'artist', name: 'Drake' } });
  });

  it('leaves a plain gap when there is nobody to name', () => {
    // Honest rather than useless: a subject built from an empty title would
    // send every backup looking for nothing.
    expect(wantCover({ unit: 'album', cover: { kind: 'none' }, title: '', artist: '' }))
      .toEqual({ kind: 'none' });
  });
});
