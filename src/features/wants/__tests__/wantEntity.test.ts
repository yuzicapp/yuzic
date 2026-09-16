import { wantAlbum, wantArtist, wantTrack } from '../wantEntity';
import { makeLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance } from '@/domain/identity/Provenance';
import type { Want } from '@/state/redux/slices/wantsSlice';
import type { LocalId } from '@/domain/identity/LocalId';

const DEEZER = integrationProvenance('deezer');

function want(overrides: Partial<Want> = {}): Want {
  return {
    localId: makeLocalId('album', DEEZER, '12345'),
    unit: 'album',
    title: 'Kid A',
    artist: 'Radiohead',
    origin: 'search',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('wantAlbum', () => {
  it('recovers the catalogue record the want was saved from', () => {
    // Identity comes back out of the localId rather than being guessed from
    // the title, so the rebuilt album points at the same Deezer release the
    // want was made from.
    const album = wantAlbum(want());

    expect(album.provenance).toEqual(DEEZER);
    expect(album.nativeId).toBe('12345');
    expect(album.title).toBe('Kid A');
    expect(album.artist.name).toBe('Radiohead');
  });

  it('is external, which is the only thing a want can be', () => {
    // Something in the library is not a want any more — the arrival watcher
    // removes it.
    expect(wantAlbum(want()).libraryState).toBe('external');
  });

  it('carries the cover the want stored, so it resolves the same way here', () => {
    const cover = { kind: 'none' as const, subject: { kind: 'album' as const, title: 'Kid A', artistName: 'Radiohead' } };

    expect(wantAlbum(want({ cover })).cover).toEqual(cover);
  });

  it('keeps the identifiers a downloader resolves a release by', () => {
    expect(wantAlbum(want({ externalIds: { mbid: 'mbid-1' } })).externalIds).toEqual({ mbid: 'mbid-1' });
  });

  it('falls back to a name-only identity for a want whose id says nothing', () => {
    // Honest about carrying no origin, and still enough for a downloader
    // that searches by name.
    const album = wantAlbum(want({ localId: 'not-a-local-id' as LocalId }));

    expect(album.provenance.origin).toBe('integration');
    expect(album.title).toBe('Kid A');
  });
});

describe('wantArtist', () => {
  it('rebuilds the artist an artist want names', () => {
    const artist = wantArtist(want({
      localId: makeLocalId('artist', DEEZER, '999'),
      unit: 'artist',
      title: 'Radiohead',
      artist: 'Radiohead',
      externalIds: { mbid: 'artist-mbid' },
    }));

    expect(artist.nativeId).toBe('999');
    expect(artist.name).toBe('Radiohead');
    expect(artist.externalIds).toEqual({ mbid: 'artist-mbid' });
    expect(artist.libraryState).toBe('external');
  });

  it('names itself even when only the title was filled in', () => {
    const artist = wantArtist(want({ unit: 'artist', title: 'Radiohead', artist: '' }));

    expect(artist.name).toBe('Radiohead');
  });
});

describe('wantTrack', () => {
  it('is the title and artist a downloader is asked for', () => {
    expect(wantTrack(want({ unit: 'track', title: 'Idioteque' })))
      .toEqual({ title: 'Idioteque', artist: 'Radiohead' });
  });
});
