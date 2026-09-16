import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import { integrationProvenance, serverProvenance } from '@/domain/identity/Provenance';
import {
  buildLibraryIndex,
  localAlbum,
  localArtist,
  localSong,
  preferLocalSong,
} from './localFirst';

const LIBRARY = serverProvenance('server-1');
const DEEZER = integrationProvenance('deezer');

const song = (over: Partial<Song> = {}): Song => ({
  localId: 'local:song:srv:server-1:s1' as Song['localId'],
  nativeId: 's1',
  provenance: LIBRARY,
  externalIds: {},
  libraryState: 'in-library',
  title: 'Roygbiv',
  artist: {
    localId: 'local:artist:srv:server-1:a1' as Song['artist']['localId'],
    nativeId: 'a1', externalIds: {}, cover: { kind: 'none' }, name: 'Boards of Canada',
  },
  album: {
    localId: 'local:album:srv:server-1:al1' as Song['album']['localId'],
    nativeId: 'al1', externalIds: {}, cover: { kind: 'none' }, title: 'Music Has the Right to Children',
  },
  cover: { kind: 'none' },
  durationSeconds: 310,
  contentKind: 'song',
  genres: [],
  ...over,
});

const externalSong = (over: Partial<Song> = {}): Song =>
  song({
    localId: 'local:song:int:deezer:x1' as Song['localId'],
    nativeId: 'x1',
    provenance: DEEZER,
    libraryState: 'external',
    contentKind: 'preview',
    durationSeconds: 30,
    streamId: 'https://cdn.deezer.example/preview.mp3',
    ...over,
  });

const album = (over: Partial<Album> = {}): Album => ({
  localId: 'local:album:srv:server-1:al1' as Album['localId'],
  nativeId: 'al1',
  provenance: LIBRARY,
  externalIds: {},
  libraryState: 'in-library',
  title: 'Geogaddi',
  cover: { kind: 'none' },
  artist: {
    localId: 'local:artist:srv:server-1:a1' as Album['artist']['localId'],
    nativeId: 'a1', externalIds: {}, cover: { kind: 'none' }, name: 'Boards of Canada',
  },
  releaseType: 'album',
  genres: [],
  songIds: [],
  ...over,
});

const artist = (over: Partial<Artist> = {}): Artist => ({
  localId: 'local:artist:srv:server-1:a1' as Artist['localId'],
  nativeId: 'a1',
  provenance: LIBRARY,
  externalIds: {},
  libraryState: 'in-library',
  name: 'Boards of Canada',
  cover: { kind: 'none' },
  tags: [],
  albumIds: [],
  ...over,
});

const indexOf = (over: { songs?: Song[]; albums?: Album[]; artists?: Artist[] } = {}) =>
  buildLibraryIndex({ songs: over.songs ?? [], albums: over.albums ?? [], artists: over.artists ?? [] });

describe('localSong', () => {
  it('answers a browsed sample with the library’s full track', () => {
    const mine = song();
    const index = indexOf({ songs: [mine] });

    expect(localSong(index, externalSong())).toBe(mine);
  });

  it('matches on an identifier even when the titles are written differently', () => {
    const mine = song({ title: 'Roygbiv (2018 Remaster)', externalIds: { isrc: 'GB-XYZ-98-00001' } });
    const index = indexOf({ songs: [mine] });

    expect(localSong(index, externalSong({ externalIds: { isrc: 'GB-XYZ-98-00001' } }))).toBe(mine);
  });

  it('needs the artist to agree, not the title alone', () => {
    // Titles collide constantly across artists — a cover, a coincidence, a
    // standard — so the pair is what the fallback compares.
    const index = indexOf({ songs: [song({ title: 'Alive' })] });
    const someoneElse = externalSong({
      title: 'Alive',
      artist: { ...song().artist, name: 'Pearl Jam' },
    });

    expect(localSong(index, someoneElse)).toBeNull();
  });

  it('normalises case and spacing, and nothing more', () => {
    const index = indexOf({ songs: [song({ title: 'Roygbiv' })] });

    expect(localSong(index, externalSong({ title: '  ROYGBIV  ' }))).not.toBeNull();
    // A live take is a different recording, and the suffix is what says so.
    expect(localSong(index, externalSong({ title: 'Roygbiv (Live)' }))).toBeNull();
  });

  it('never resolves a record the library already owns against itself', () => {
    const mine = song();

    expect(localSong(indexOf({ songs: [mine] }), mine)).toBeNull();
  });

  it('is null when nothing in the library corresponds', () => {
    expect(localSong(indexOf({ songs: [song()] }), externalSong({ title: 'Everything Ecstatic' }))).toBeNull();
  });
});

describe('preferLocalSong', () => {
  it('hands back the full track, so a sample is never what plays', () => {
    const mine = song();
    const browsed = externalSong();

    const played = preferLocalSong(indexOf({ songs: [mine] }), browsed);

    expect(played).toBe(mine);
    expect(played.durationSeconds).toBe(310);
    expect(played.streamId).toBeUndefined();
  });

  it('keeps the browsed record when the library has no copy', () => {
    const browsed = externalSong({ title: 'Unowned' });

    expect(preferLocalSong(indexOf({ songs: [song()] }), browsed)).toBe(browsed);
  });
});

describe('localAlbum and localArtist', () => {
  it('resolve a browsed album and artist to the library’s own', () => {
    const myAlbum = album();
    const myArtist = artist();
    const index = indexOf({ albums: [myAlbum], artists: [myArtist] });

    const browsedAlbum = album({
      localId: 'local:album:int:deezer:1' as Album['localId'],
      provenance: DEEZER, libraryState: 'external', externalIds: { deezerId: '1' },
    });
    const browsedArtist = artist({
      localId: 'local:artist:int:deezer:9' as Artist['localId'],
      provenance: DEEZER, libraryState: 'external', externalIds: { deezerId: '9' },
    });

    expect(localAlbum(index, browsedAlbum)).toBe(myAlbum);
    expect(localArtist(index, browsedArtist)).toBe(myArtist);
  });

  it('does not match a release id against a release-group id', () => {
    const index = indexOf({
      albums: [album({ externalIds: { mbid: 'shared', mbidType: 'release' } })],
    });
    const browsed = album({
      localId: 'local:album:int:musicbrainz:g' as Album['localId'],
      provenance: integrationProvenance('musicbrainz'),
      libraryState: 'external',
      title: 'Something Else',
      externalIds: { mbid: 'shared', mbidType: 'release-group' },
    });

    expect(localAlbum(index, browsed)).toBeNull();
  });
});

describe('the index itself', () => {
  it('is built once for a whole library, not per lookup', () => {
    // The guarantee the shelves depend on: a row costs a map lookup, so ten
    // rows against a big library are ten lookups rather than ten scans.
    const songs = Array.from({ length: 5000 }, (_, i) =>
      song({ localId: `local:song:srv:server-1:s${i}` as Song['localId'], nativeId: `s${i}`, title: `Track ${i}` })
    );
    const index = buildLibraryIndex({ songs, albums: [], artists: [] });

    expect(index.songs.size).toBe(5000);
    expect(localSong(index, externalSong({ title: 'Track 4999' }))?.nativeId).toBe('s4999');
    expect(localSong(index, externalSong({ title: 'Track 5000' }))).toBeNull();
  });
});
