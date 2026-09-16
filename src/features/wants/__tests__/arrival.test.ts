import { findArrivedWants, hasWantArrived } from '../arrival';
import { makeLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance, serverProvenance } from '@/domain/identity/Provenance';
import type { Want } from '@/state/redux/slices/wantsSlice';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';

const ALBUM_LOCAL_ID = makeLocalId('album', integrationProvenance('deezer'), 'w-album-1');
const TRACK_LOCAL_ID = makeLocalId('song', integrationProvenance('deezer'), 'w-track-1');
const ARTIST_LOCAL_ID = makeLocalId('artist', integrationProvenance('deezer'), 'w-artist-1');
const PRESENT_LOCAL_ID = makeLocalId('album', integrationProvenance('deezer'), 'present');
const MISSING_LOCAL_ID = makeLocalId('album', integrationProvenance('deezer'), 'missing');

/** What the notification opens: the library record the want arrived as. */
const asAlbum = (want: Want) => ({ want, libraryCopy: { kind: 'album', nativeId: 'lib-album-1' } });

const PROVENANCE = serverProvenance('server-1');

function albumWant(overrides: Partial<Want> = {}): Want {
  return {
    localId: ALBUM_LOCAL_ID,
    unit: 'album',
    title: 'Some Album',
    artist: 'Some Artist',
    origin: 'search',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function trackWant(overrides: Partial<Want> = {}): Want {
  return {
    localId: TRACK_LOCAL_ID,
    unit: 'track',
    title: 'Some Track',
    artist: 'Some Artist',
    origin: 'search',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function libraryAlbum(overrides: Partial<Album> = {}): Album {
  return {
    localId: makeLocalId('album', PROVENANCE, 'lib-album-1'),
    nativeId: 'lib-album-1',
    provenance: PROVENANCE,
    externalIds: {},
    libraryState: 'in-library',
    title: 'Some Album',
    cover: { kind: 'none' },
    artist: {
      localId: makeLocalId('artist', PROVENANCE, 'artist-1'),
      nativeId: 'artist-1',
      externalIds: {},
      name: 'Some Artist',
      cover: { kind: 'none' },
    },
    year: 2020,
    releaseType: 'album',
    genres: [],
    songIds: [],
    ...overrides,
  };
}

function artistWant(overrides: Partial<Want> = {}): Want {
  return {
    localId: ARTIST_LOCAL_ID,
    unit: 'artist',
    title: 'Some Artist',
    artist: 'Some Artist',
    origin: 'artist-page',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function libraryArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    localId: makeLocalId('artist', PROVENANCE, 'lib-artist-1'),
    nativeId: 'lib-artist-1',
    provenance: PROVENANCE,
    externalIds: {},
    libraryState: 'in-library',
    name: 'Some Artist',
    cover: { kind: 'none' },
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

function libraryTrack(overrides: Partial<Song> = {}): Song {
  return {
    localId: makeLocalId('song', PROVENANCE, 'lib-track-1'),
    nativeId: 'lib-track-1',
    provenance: PROVENANCE,
    externalIds: {},
    libraryState: 'in-library',
    title: 'Some Track',
    artist: {
      localId: makeLocalId('artist', PROVENANCE, 'artist-1'),
      nativeId: 'artist-1',
      externalIds: {},
      name: 'Some Artist',
      cover: { kind: 'none' },
    },
    album: {
      localId: makeLocalId('album', PROVENANCE, 'lib-album-1'),
      nativeId: 'lib-album-1',
      externalIds: {},
      title: 'Some Album',
      cover: { kind: 'none' },
    },
    cover: { kind: 'none' },
    durationSeconds: 180,
    contentKind: 'song',
    genres: [],
    ...overrides,
  };
}

describe('findArrivedWants', () => {
  it('returns an album want when a normalized title/artist match is in library.albums', () => {
    const want = albumWant();
    const arrived = findArrivedWants([want], { albums: [libraryAlbum()] });
    expect(arrived).toEqual([asAlbum(want)]);
  });

  it('returns an album want when the mbid matches even if title/artist differ in case/spacing', () => {
    const want = albumWant({
      title: '  SOME    Album ',
      externalIds: { mbid: 'mbid-123' },
    });
    const album = libraryAlbum({ title: 'Totally Different Title', externalIds: { mbid: 'mbid-123' } });
    const arrived = findArrivedWants([want], { albums: [album] });
    expect(arrived).toEqual([asAlbum(want)]);
  });

  it('returns a track want when the track is present in library.tracks', () => {
    const want = trackWant();
    const arrived = findArrivedWants([want], { albums: [], tracks: [libraryTrack()] });
    // The album it arrived on, not the track: a library track has no screen
    // of its own to open.
    expect(arrived).toEqual([asAlbum(want)]);
  });

  it('returns nothing when the album is absent from the library', () => {
    const want = albumWant();
    const arrived = findArrivedWants([want], { albums: [libraryAlbum({ title: 'Different Album' })] });
    expect(arrived).toEqual([]);
  });

  it('returns nothing when the track is absent from the library', () => {
    const want = trackWant();
    const arrived = findArrivedWants([want], { albums: [], tracks: [libraryTrack({ title: 'Different Track' })] });
    expect(arrived).toEqual([]);
  });

  it('leaves a wanted-but-not-present want out of the arrived set while others resolve', () => {
    const present = albumWant({ localId: PRESENT_LOCAL_ID });
    const missing = albumWant({ localId: MISSING_LOCAL_ID, title: 'Nope', artist: 'Nobody' });
    const arrived = findArrivedWants([present, missing], { albums: [libraryAlbum()] });
    expect(arrived).toEqual([asAlbum(present)]);
  });

  it('returns nothing when library.tracks is omitted and a track want is checked', () => {
    const want = trackWant();
    const arrived = findArrivedWants([want], { albums: [] });
    expect(arrived).toEqual([]);
  });

  /**
   * An artist want arrives the same way everything else does — the artist is
   * findable in the synced library — and through the same matcher every other
   * surface asks that question with.
   */
  describe('artist wants', () => {
    it('arrives when the artist turns up in the library, and opens their page', () => {
      const want = artistWant();
      const arrived = findArrivedWants([want], { albums: [], artists: [libraryArtist()] });

      expect(arrived).toEqual([{ want, libraryCopy: { kind: 'artist', nativeId: 'lib-artist-1' } }]);
    });

    it('matches on the mbid ahead of the name, as the artist matcher does', () => {
      const want = artistWant({ title: 'Renamed', artist: 'Renamed', externalIds: { mbid: 'artist-mbid' } });
      const artist = libraryArtist({ name: 'Totally Different', externalIds: { mbid: 'artist-mbid' } });

      expect(findArrivedWants([want], { albums: [], artists: [artist] })).toHaveLength(1);
    });

    it('does not arrive on an artist the library does not have', () => {
      expect(findArrivedWants([artistWant()], { albums: [], artists: [libraryArtist({ name: 'Nobody' })] }))
        .toEqual([]);
    });

    it('does not arrive when no artists were supplied at all', () => {
      expect(findArrivedWants([artistWant()], { albums: [] })).toEqual([]);
    });
  });
});

describe('hasWantArrived', () => {
  it('answers the same question as a yes/no, for a row asking about itself', () => {
    expect(hasWantArrived(albumWant(), { albums: [libraryAlbum()] })).toBe(true);
    expect(hasWantArrived(albumWant(), { albums: [] })).toBe(false);
  });
});
