import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import { makeLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance, serverProvenance, type Provenance } from '@/domain/identity/Provenance';
import { ALL_SOURCES } from './registry';
import { knownAlbumRoute, knownArtistRoute, pickFrom } from './resolutionRoutes';

const deezer = ALL_SOURCES.filter(s => s.id === 'deezer');
const musicbrainz = ALL_SOURCES.filter(s => s.id === 'musicbrainz');
const both = [...deezer, ...musicbrainz];

function artist(provenance: Provenance, nativeId: string, externalIds: Artist['externalIds'] = {}): Artist {
  return {
    localId: makeLocalId('artist', provenance, nativeId),
    nativeId,
    provenance,
    externalIds,
    name: 'Artist',
    cover: { kind: 'none' },
    tags: [],
    albumIds: [],
  };
}

function album(provenance: Provenance, nativeId: string): Album {
  return {
    localId: makeLocalId('album', provenance, nativeId),
    nativeId,
    provenance,
    externalIds: {},
    title: 'Album',
    cover: { kind: 'none' },
    artist: {
      localId: makeLocalId('artist', provenance, 'a1'),
      nativeId: 'a1',
      externalIds: {},
      name: 'Artist',
      cover: { kind: 'none' },
    },
    releaseType: 'album',
    genres: [],
    songIds: [],
  };
}

describe('knownArtistRoute', () => {
  it('opens an artist on the source it was browsed through, with both sources on', () => {
    // The artist name on a Deezer album. This used to search both sources by
    // name and ask which one was meant.
    const item = artist(integrationProvenance('deezer'), '27', { deezerId: '27' });

    expect(knownArtistRoute(item, both)).toEqual({
      source: 'deezer', artistId: '27', mbid: undefined, name: 'Artist',
    });
  });

  it('falls back to the native id when the ref carries no external ids', () => {
    const item = artist(integrationProvenance('musicbrainz'), 'mb-1');

    expect(knownArtistRoute(item, both)).toMatchObject({ source: 'musicbrainz', artistId: 'mb-1' });
  });

  it('uses an enabled source the record has an id for, from any origin', () => {
    const item = artist(integrationProvenance('lastfm'), 'Artist', { mbid: 'mb-1' });

    expect(knownArtistRoute(item, both)).toMatchObject({ source: 'musicbrainz', artistId: 'mb-1', mbid: 'mb-1' });
    expect(knownArtistRoute(item, deezer)).toBeNull();
  });

  it('asks when nothing is known, as for an uncredited MusicBrainz ref', () => {
    expect(knownArtistRoute(artist(integrationProvenance('musicbrainz'), ''), both)).toBeNull();
    expect(knownArtistRoute(artist(serverProvenance('srv'), '42'), both)).toBeNull();
  });
});

describe('knownAlbumRoute', () => {
  it('opens an album on the source it was browsed through', () => {
    expect(knownAlbumRoute(album(integrationProvenance('musicbrainz'), 'rg-1'))).toEqual({
      source: 'musicbrainz', albumId: 'rg-1', artist: 'Artist', title: 'Album',
    });
  });

  it('knows nothing about an album from anywhere else', () => {
    expect(knownAlbumRoute(album(serverProvenance('srv'), '9'))).toBeNull();
    expect(knownAlbumRoute(album(integrationProvenance('lastfm'), '9'))).toBeNull();
  });
});

describe('pickFrom', () => {
  it('goes straight to the best match when only one source answered', () => {
    expect(pickFrom([['a1', 'a2'], []])).toEqual({ direct: 'a1', all: ['a1', 'a2'] });
  });

  it('keeps every source\'s runners-up for the picker when two answered', () => {
    expect(pickFrom([['a1', 'a2'], ['b1']])).toEqual({ direct: null, all: ['a1', 'a2', 'b1'] });
  });

  it('has nothing when nobody answered', () => {
    expect(pickFrom([[], []])).toEqual({ direct: null, all: [] });
  });
});
