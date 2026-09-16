import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import { integrationProvenance, serverProvenance } from '@/domain/identity/Provenance';
import { albumWebLink, artistWebLink } from './sourceLinks';

const album = (over: Partial<Album>): Album => ({
  localId: 'local:album:int:deezer:1' as Album['localId'],
  nativeId: '1',
  provenance: integrationProvenance('deezer'),
  externalIds: {},
  libraryState: 'external',
  title: 'Geogaddi',
  cover: { kind: 'none' },
  artist: {
    localId: 'local:artist:int:deezer:9' as Album['artist']['localId'],
    nativeId: '9',
    externalIds: {},
    cover: { kind: 'none' },
    name: 'Boards of Canada',
  },
  releaseType: 'album',
  genres: [],
  songIds: [],
  ...over,
});

const artist = (over: Partial<Artist>): Artist => ({
  localId: 'local:artist:int:deezer:9' as Artist['localId'],
  nativeId: '9',
  provenance: integrationProvenance('deezer'),
  externalIds: {},
  libraryState: 'external',
  name: 'Boards of Canada',
  cover: { kind: 'none' },
  tags: [],
  albumIds: [],
  ...over,
});

describe('albumWebLink', () => {
  it("addresses a Deezer album by Deezer's own id", () => {
    expect(albumWebLink(album({ externalIds: { deezerId: '119606' } }))).toEqual(
      expect.objectContaining({ source: 'deezer', url: 'https://www.deezer.com/album/119606' })
    );
  });

  it('files a MusicBrainz release and a release group under different paths', () => {
    const release = album({
      provenance: integrationProvenance('musicbrainz'),
      externalIds: { mbid: 'abc', mbidType: 'release' },
    });
    const group = album({
      provenance: integrationProvenance('musicbrainz'),
      externalIds: { mbid: 'abc', mbidType: 'release-group' },
    });

    expect(albumWebLink(release)?.url).toBe('https://musicbrainz.org/release/abc');
    expect(albumWebLink(group)?.url).toBe('https://musicbrainz.org/release-group/abc');
  });

  it('prefers the source the record was browsed through', () => {
    const browsed = album({
      provenance: integrationProvenance('musicbrainz'),
      externalIds: { deezerId: '1', mbid: 'abc' },
    });

    expect(albumWebLink(browsed)?.source).toBe('musicbrainz');
  });

  it('falls back to any other id the record carries', () => {
    const fromServer = album({
      provenance: serverProvenance('srv'),
      externalIds: { mbid: 'abc' },
    });

    expect(albumWebLink(fromServer)?.source).toBe('musicbrainz');
  });

  it('is null when nothing identifies the record publicly', () => {
    expect(albumWebLink(album({ externalIds: {} }))).toBeNull();
  });
});

describe('artistWebLink', () => {
  it('addresses an artist on each source', () => {
    expect(artistWebLink(artist({ externalIds: { deezerId: '9' } }))?.url)
      .toBe('https://www.deezer.com/artist/9');
    expect(
      artistWebLink(artist({
        provenance: integrationProvenance('musicbrainz'),
        externalIds: { mbid: 'mb-1' },
      }))?.url
    ).toBe('https://musicbrainz.org/artist/mb-1');
  });

  it('is null without an id either source knows them by', () => {
    expect(artistWebLink(artist({ externalIds: {} }))).toBeNull();
  });
});
