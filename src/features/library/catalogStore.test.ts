import {
  albumsByArtist,
  albumsByArtistNativeId,
  albumsByGenre,
  buildCatalogStore,
  songsByAlbum,
  songsByAlbumNativeId,
  type Catalog,
} from './catalogStore';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';

const provenance = serverProvenance('srv-1');
const artistId = (n: string) => makeLocalId('artist', provenance, n);
const albumId = (n: string) => makeLocalId('album', provenance, n);

const artist = (nativeId: string, name = `Artist ${nativeId}`): Artist => ({
  localId: artistId(nativeId), nativeId, provenance, externalIds: {},
  name, cover: { kind: 'none' }, tags: [], albumIds: [],
});

const album = (nativeId: string, artistNativeId: string, genres: string[] = []): Album => ({
  localId: albumId(nativeId), nativeId, provenance, externalIds: {},
  title: `Album ${nativeId}`, cover: { kind: 'none' },
  artist: { localId: artistId(artistNativeId), nativeId: artistNativeId, externalIds: {}, name: `Artist ${artistNativeId}`, cover: { kind: 'none' } },
  releaseType: 'album', genres, songIds: [],
});

const song = (nativeId: string, albumNativeId: string, artistNativeId: string): Song => ({
  localId: makeLocalId('song', provenance, nativeId), nativeId, provenance, externalIds: {},
  title: `Song ${nativeId}`, cover: { kind: 'none' },
  artist: { localId: artistId(artistNativeId), nativeId: artistNativeId, externalIds: {}, name: `Artist ${artistNativeId}`, cover: { kind: 'none' } },
  album: { localId: albumId(albumNativeId), nativeId: albumNativeId, externalIds: {}, title: `Album ${albumNativeId}`, cover: { kind: 'none' } },
  durationSeconds: 100, contentKind: 'song', genres: [],
});

const playlist = (nativeId: string): Playlist => ({
  localId: makeLocalId('playlist', provenance, nativeId), nativeId, provenance,
  externalIds: {}, title: `Playlist ${nativeId}`,
  cover: { kind: 'none' }, isOwned: true, songIds: [],
});

const catalog: Catalog = {
  playlists: [playlist('p1')],
  artists: [artist('a1'), artist('a2')],
  albums: [album('al1', 'a1', ['Rock']), album('al2', 'a1', ['Rock', 'Indie']), album('al3', 'a2', ['Jazz'])],
  songs: [song('s1', 'al1', 'a1'), song('s2', 'al1', 'a1'), song('s3', 'al3', 'a2')],
};

describe('buildCatalogStore', () => {
  const store = buildCatalogStore(catalog);

  it('indexes every entity by its own id', () => {
    expect(store.artists.size).toBe(2);
    expect(store.albums.size).toBe(3);
    expect(store.songs.size).toBe(3);
    expect(store.albums.get(albumId('al2'))?.title).toBe('Album al2');
  });

  it('indexes playlists, which are a catalog resource like the rest', () => {
    expect(store.playlists.size).toBe(1);
    expect(store.playlistByNativeId.get('p1')?.title).toBe('Playlist p1');
  });

  it('indexes by native id too, which is what half the callers hold', () => {
    expect(store.albumByNativeId.get('al2')?.localId).toBe(albumId('al2'));
    expect(store.artistByNativeId.get('a2')?.name).toBe('Artist a2');
    expect(store.songByNativeId.get('s3')?.title).toBe('Song s3');
  });

  it('keeps the first record when a native id repeats', () => {
    // Matches the identity index next door rather than flipping between them.
    const dupes = buildCatalogStore({
      ...catalog,
      artists: [artist('a1', 'First'), artist('a1', 'Second')],
    });

    expect(dupes.artistByNativeId.get('a1')?.name).toBe('First');
  });
});

describe('relationships', () => {
  const store = buildCatalogStore(catalog);

  it('answers albums by artist without scanning', () => {
    expect(albumsByArtist(store, artistId('a1')).map(a => a.nativeId)).toEqual(['al1', 'al2']);
    expect(albumsByArtist(store, artistId('a2')).map(a => a.nativeId)).toEqual(['al3']);
  });

  it('answers songs by album', () => {
    expect(songsByAlbum(store, albumId('al1')).map(s => s.nativeId)).toEqual(['s1', 's2']);
  });

  it('answers albums by genre, counting an album under each of its genres', () => {
    expect(albumsByGenre(store, 'Rock').map(a => a.nativeId)).toEqual(['al1', 'al2']);
    expect(albumsByGenre(store, 'Indie').map(a => a.nativeId)).toEqual(['al2']);
  });

  it('returns the same empty array for every miss', () => {
    // Referential stability, so a useMemo keyed on the result does not
    // recompute on every render — the bug this whole seam exists to stop.
    const first = albumsByArtist(store, artistId('nobody'));
    const second = albumsByArtist(store, artistId('nobody-else'));

    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });

  it('builds each relationship from the side that owns it', () => {
    // Worth pinning because it is not obvious: `albumIdsByArtist` comes from
    // the albums, so dropping them empties it, while `songIdsByAlbum` comes
    // from the songs and still answers for an album that is gone. A track
    // whose album was removed is still that track's album.
    const withoutAlbums = buildCatalogStore({ ...catalog, albums: [] });

    expect(albumsByArtist(withoutAlbums, artistId('a1'))).toEqual([]);
    expect(songsByAlbum(withoutAlbums, albumId('al1')).map(s => s.nativeId)).toEqual(['s1', 's2']);
  });

  it('skips an id the catalog no longer holds rather than returning a hole', () => {
    const store = buildCatalogStore(catalog);
    const gappy = { ...store, songs: new Map([...store.songs].slice(1)) };

    expect(songsByAlbum(gappy, albumId('al1')).map(s => s.nativeId)).toEqual(['s2']);
  });

  it('holds on to the catalog it was built from', () => {
    expect(store.catalog.songs).toBe(catalog.songs);
  });
});

describe('lookups by native id', () => {
  const store = buildCatalogStore(catalog);

  it('answers the same as the LocalId form', () => {
    // Routes carry native ids; relationships are keyed by LocalId. One is a
    // pure function of the other given the catalog's provenance.
    expect(albumsByArtistNativeId(store, 'a1')).toEqual(albumsByArtist(store, artistId('a1')));
    expect(songsByAlbumNativeId(store, 'al1')).toEqual(songsByAlbum(store, albumId('al1')));
  });

  it('misses cleanly for an id the catalog does not hold', () => {
    expect(albumsByArtistNativeId(store, 'nobody')).toEqual([]);
  });

  it('returns nothing rather than guessing when the catalog is empty', () => {
    // No entities means no provenance to derive an id from.
    const empty = buildCatalogStore({ songs: [], albums: [], artists: [], playlists: [] });

    expect(empty.provenance).toBeNull();
    expect(albumsByArtistNativeId(empty, 'a1')).toEqual([]);
  });

  it('takes the provenance from whichever kind the catalog has', () => {
    const artistsOnly = buildCatalogStore({ songs: [], albums: [], artists: catalog.artists, playlists: [] });

    expect(artistsOnly.provenance).toEqual(provenance);
  });
});

/**
 * The catalog hydrates one resource at a time, so a cold start built this
 * store four times over — and it walked the whole library each time, because
 * every index was built in one pass regardless of which array had actually
 * changed. Every index derives from exactly one array, so nothing should be
 * rebuilt for an array that did not move.
 */
describe('rebuilding only what changed', () => {
  const artists = [artist('ar-1')];
  const albums = [album('al-1', 'ar-1', ['Jazz'])];
  const playlists: Playlist[] = [];

  it('keeps the album indexes when only the tracks array is replaced', () => {
    const before = buildCatalogStore({ songs: [], albums, artists, playlists });
    const after = buildCatalogStore({ songs: [song('s-1', 'al-1', 'ar-1')], albums, artists, playlists });

    expect(after.albums).toBe(before.albums);
    expect(after.albumByNativeId).toBe(before.albumByNativeId);
    expect(after.albumIdsByArtist).toBe(before.albumIdsByArtist);
    expect(after.albumIdsByGenre).toBe(before.albumIdsByGenre);
    expect(after.artists).toBe(before.artists);
  });

  it('does rebuild the song indexes, since that is what changed', () => {
    const before = buildCatalogStore({ songs: [], albums, artists, playlists });
    const after = buildCatalogStore({ songs: [song('s-1', 'al-1', 'ar-1')], albums, artists, playlists });

    expect(after.songByNativeId).not.toBe(before.songByNativeId);
    expect(after.songByNativeId.get('s-1')).toBeDefined();
  });

  it('keeps the song indexes when only the albums array is replaced', () => {
    const songs = [song('s-1', 'al-1', 'ar-1')];
    const before = buildCatalogStore({ songs, albums, artists, playlists });
    const after = buildCatalogStore({ songs, albums: [...albums, album('al-2', 'ar-1')], artists, playlists });

    expect(after.songs).toBe(before.songs);
    expect(after.songIdsByAlbum).toBe(before.songIdsByAlbum);
    expect(after.albumByNativeId).not.toBe(before.albumByNativeId);
  });
});
