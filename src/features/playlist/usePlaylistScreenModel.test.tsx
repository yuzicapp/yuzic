import { renderHook } from '@testing-library/react-native';

import { buildCatalogStore, type CatalogStore } from '@/features/library/catalogStore';
import type { DownloadedCollectionEntry } from '@/features/offline/downloadStore';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';

/**
 * The offline-first query is mocked to hand back whatever `fallbackValue` it
 * was given, which is the real `selectOfflineFirstData`'s answer when this
 * query has no data of its own — the case under test. The fallback is also
 * captured so the assertion can be about what was *passed*, not just what
 * came out.
 */
/* eslint-disable no-var -- hoisted for the jest.mock factories below */
var capturedFallback: { playlist?: Playlist; songs?: Song[] } | undefined;
var mockStore: CatalogStore | undefined;
var mockCollections: DownloadedCollectionEntry[] = [];
/* eslint-enable no-var */

jest.mock('@/state/query/useOfflineFirstQuery', () => ({
  hasValue: (value: unknown) => value !== null && value !== undefined,
  useOfflineFirstQuery: (options: { fallbackValue?: { playlist?: Playlist; songs?: Song[] } }) => {
    capturedFallback = options.fallbackValue;
    return {
      // No data of its own (never fetched, offline): the fallback is the
      // answer, exactly as `selectOfflineFirstData` decides.
      data: options.fallbackValue ?? null,
      isLoading: false,
      error: null,
      isOffline: true,
      serverUnreachable: false,
      degraded: true,
      query: { isFetching: false, refetch: jest.fn() },
    };
  },
}));

jest.mock('@/features/library/useCatalogStore', () => ({
  useCatalogStore: () => mockStore,
}));

jest.mock('@/features/offline/DownloadContext', () => ({
  useDownloadState: () => ({ getAllDownloadedCollections: () => mockCollections }),
}));

jest.mock('@/features/playlist/usePlaylists', () => ({
  usePlaylists: () => ({ playlists: [] }),
}));

jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({ playlists: {} }),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({ id: 'srv-1', isAuthenticated: true }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (_effect: () => void) => {},
}));

import { usePlaylistScreenModel } from './usePlaylistScreenModel';

const provenance = serverProvenance('srv-1');
const songId = (n: string) => makeLocalId('song', provenance, n);
const albumId = (n: string) => makeLocalId('album', provenance, n);
const artistId = (n: string) => makeLocalId('artist', provenance, n);
const playlistId = (n: string) => makeLocalId('playlist', provenance, n);

const artist = (nativeId: string): Artist => ({
  localId: artistId(nativeId), nativeId, provenance, externalIds: {},
  name: `Artist ${nativeId}`, cover: { kind: 'none' }, tags: [], albumIds: [],
});

const album = (nativeId: string): Album => ({
  localId: albumId(nativeId), nativeId, provenance, externalIds: {},
  title: `Album ${nativeId}`, cover: { kind: 'none' },
  artist: artist('a1'), releaseType: 'album', genres: [], songIds: [],
});

const song = (nativeId: string): Song => ({
  localId: songId(nativeId), nativeId, provenance, externalIds: {},
  title: `Song ${nativeId}`, cover: { kind: 'none' },
  artist: artist('a1'), album: album('al1'), durationSeconds: 100,
  contentKind: 'song', genres: [],
});

const playlist = (nativeId: string, songIds: unknown[] = []): Playlist => ({
  localId: playlistId(nativeId), nativeId, provenance, externalIds: {},
  title: `Playlist ${nativeId}`, cover: { kind: 'none' }, isOwned: true,
  songIds: songIds as Song['localId'][],
});

beforeEach(() => {
  capturedFallback = undefined;
  mockCollections = [];
});

describe('usePlaylistScreenModel — offline fallback', () => {
  it('rebuilds a downloaded playlist from its collection tracks, in playlist order', async () => {
    mockStore = buildCatalogStore({
      playlists: [playlist('p1')],
      artists: [artist('a1')],
      albums: [album('al1')],
      songs: [song('s1'), song('s2'), song('s3')],
    });
    // `downloadPlaylistById` records the collection under the playlist's
    // `nativeId`, with `localId`s in playlist order.
    mockCollections = [{ id: 'p1', type: 'playlist', trackIds: [songId('s2'), songId('s1')], downloadedAt: 1 }];

    const { result } = await renderHook(() => usePlaylistScreenModel({ id: 'p1' }));

    expect(capturedFallback?.playlist?.nativeId).toBe('p1');
    expect(result.current.songs.map(s => s.nativeId)).toEqual(['s2', 's1']);
    expect(result.current.status).toBe('ready');
  });

  it('resolves the playlist’s own songIds when it carries them (generated/favorites)', async () => {
    mockStore = buildCatalogStore({
      playlists: [playlist('p1', [songId('s3'), songId('s1')])],
      artists: [artist('a1')],
      albums: [album('al1')],
      songs: [song('s1'), song('s2'), song('s3')],
    });
    mockCollections = [];

    const { result } = await renderHook(() => usePlaylistScreenModel({ id: 'p1' }));

    expect(result.current.songs.map(s => s.nativeId)).toEqual(['s3', 's1']);
  });

  it('opens empty when the playlist is known but neither carries nor has downloaded songs', async () => {
    mockStore = buildCatalogStore({
      playlists: [playlist('p1')],
      artists: [artist('a1')],
      albums: [album('al1')],
      songs: [song('s1'), song('s2')],
    });
    mockCollections = [];

    const { result } = await renderHook(() => usePlaylistScreenModel({ id: 'p1' }));

    expect(result.current.playlist?.nativeId).toBe('p1');
    expect(result.current.songs).toEqual([]);
  });

  it('skips ids the catalog no longer holds rather than leaving holes in the list', async () => {
    mockStore = buildCatalogStore({
      playlists: [playlist('p1')],
      artists: [artist('a1')],
      albums: [album('al1')],
      songs: [song('s1'), song('s2')],
    });
    mockCollections = [
      { id: 'p1', type: 'playlist', trackIds: [songId('s2'), songId('gone'), songId('s1')], downloadedAt: 1 },
    ];

    const { result } = await renderHook(() => usePlaylistScreenModel({ id: 'p1' }));

    expect(result.current.songs.map(s => s.nativeId)).toEqual(['s2', 's1']);
  });
});