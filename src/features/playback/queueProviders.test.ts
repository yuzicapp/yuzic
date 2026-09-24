import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';
import type { ApiAdapter } from '@/providers/contracts/ServerAdapter';
import {
  resolveQueueFillProvider,
  createNativeSimilarityQueueFillProvider,
  createSimilarityServiceQueueFillProvider,
  createLibraryQueueFillProvider,
  type QueueFillProvider,
} from './queueProviders';

/** A similarity service that answers with these item ids. */
const similarityReturning = (itemIds: string[]) => ({ similarTrackIds: jest.fn(async () => itemIds) });

const provenance = serverProvenance('srv-1');

/** Identity as the app would derive it for a track on the active server. */
const idOf = (nativeId: string) => makeLocalId('song', provenance, nativeId);

const song = (nativeId: string): Song => ({
  localId: idOf(nativeId),
  nativeId,
  provenance,
  externalIds: {},
  title: nativeId,
  artist: {
    localId: makeLocalId('artist', provenance, 'artist-1'),
    nativeId: 'artist-1',
    externalIds: {},
    name: 'Artist',
    cover: { kind: 'none' },
  },
  album: {
    localId: makeLocalId('album', provenance, 'album-1'),
    nativeId: 'album-1',
    externalIds: {},
    title: 'Album',
    cover: { kind: 'none' },
  },
  cover: { kind: 'none' },
  durationSeconds: 120,
  contentKind: 'song',
  genres: [],
});

function fakeApi(overrides: Partial<ApiAdapter> = {}): ApiAdapter {
  return {
    auth: { connect: jest.fn(), ping: jest.fn(), startScan: jest.fn(), disconnect: jest.fn() },
    albums: { list: jest.fn(), get: jest.fn() },
    artists: { list: jest.fn(), get: jest.fn() },
    genres: { list: jest.fn() },
    playlists: { list: jest.fn(), get: jest.fn(), create: jest.fn(), rename: jest.fn(), addSong: jest.fn(), removeSong: jest.fn(), moveSong: jest.fn(), delete: jest.fn() },
    starred: { list: jest.fn(), add: jest.fn(), remove: jest.fn() },
    songs: { get: jest.fn(async () => null), scrobble: jest.fn(), buildStreamUrl: jest.fn() },
    tracks: { list: jest.fn(), get: jest.fn() },
    similar: { getSimilarSongs: jest.fn(async () => []) },
    lyrics: { getBySongId: jest.fn() },
    search: { search: jest.fn() },
    ...overrides,
  } as ApiAdapter;
}

describe('resolveQueueFillProvider', () => {
  const provider = (id: QueueFillProvider['id'], available: boolean): QueueFillProvider => ({
    id,
    isAvailable: () => available,
    fetchExtension: jest.fn(async () => []),
  });

  it('returns the first available provider in priority order', () => {
    const similarity = provider('similarity-service', true);
    const native = provider('native-similarity', true);
    expect(resolveQueueFillProvider([similarity, native])).toBe(similarity);
  });

  it('skips unavailable providers', () => {
    const similarity = provider('similarity-service', false);
    const native = provider('native-similarity', true);
    expect(resolveQueueFillProvider([similarity, native])).toBe(native);
  });

  it('returns null when no provider is available', () => {
    expect(resolveQueueFillProvider([provider('similarity-service', false)])).toBeNull();
  });
});

describe('createNativeSimilarityQueueFillProvider', () => {
  it('is always available', () => {
    const provider = createNativeSimilarityQueueFillProvider(fakeApi());
    expect(provider.isAvailable()).toBe(true);
  });

  it('returns nothing when there are no seed songs', async () => {
    const provider = createNativeSimilarityQueueFillProvider(fakeApi());
    const result = await provider.fetchExtension({ recentSongs: [], excludeIds: new Set(), count: 10 });
    expect(result).toEqual([]);
  });

  it('seeds from the last recent song and excludes already-queued ids', async () => {
    const getSimilarSongs = jest.fn(async () => [song('a'), song('b'), song('c')]);
    const api = fakeApi({ similar: { getSimilarSongs } });
    const provider = createNativeSimilarityQueueFillProvider(api);

    const result = await provider.fetchExtension({
      recentSongs: [song('x'), song('seed')],
      excludeIds: new Set([idOf('b')]),
      count: 10,
    });

    // The seed goes to the server, so it is the native id.
    expect(getSimilarSongs).toHaveBeenCalledWith('seed');
    expect(result.map(s => s.nativeId).sort()).toEqual(['a', 'c']);
  });

  it('caps the result at count', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map(song);
    const api = fakeApi({ similar: { getSimilarSongs: jest.fn(async () => many) } });
    const provider = createNativeSimilarityQueueFillProvider(api);

    const result = await provider.fetchExtension({ recentSongs: [song('seed')], excludeIds: new Set(), count: 2 });
    expect(result.length).toBe(2);
  });
});

describe('createSimilarityServiceQueueFillProvider', () => {
  it('is available whenever a service was handed to it', () => {
    expect(createSimilarityServiceQueueFillProvider(similarityReturning([]), fakeApi()).isAvailable()).toBe(true);
  });

  it('resolves similarity refs to library songs, dropping unresolvable and excluded ones', async () => {
    const similarity = similarityReturning(['a', 'b', 'missing']);
    const get = jest.fn(async (id: string) => (id === 'missing' ? null : song(id)));
    const api = fakeApi({ songs: { get, scrobble: jest.fn(), buildStreamUrl: jest.fn(), streamableCodecs: ['mp3'], scrobbleKind: 'scrobble' as const } });
    const provider = createSimilarityServiceQueueFillProvider(similarity, api);

    const result = await provider.fetchExtension({
      recentSongs: [song('seed')],
      excludeIds: new Set([idOf('b')]),
      count: 10,
    });

    expect(result.map(s => s.nativeId)).toEqual(['a']);
  });

  it('sends the service native item ids to exclude, not on-device identities', async () => {
    // The service only knows the media server's own item ids. Passing the
    // identity strings straight through would exclude nothing, because none of
    // them would match anything it holds.
    const similarity = similarityReturning(['a']);
    const get = jest.fn(async (id: string) => song(id));
    const api = fakeApi({ songs: { get, scrobble: jest.fn(), buildStreamUrl: jest.fn(), streamableCodecs: ['mp3'], scrobbleKind: 'scrobble' as const } });
    const provider = createSimilarityServiceQueueFillProvider(similarity, api);

    await provider.fetchExtension({
      recentSongs: [song('seed')],
      excludeIds: new Set([idOf('b'), idOf('c')]),
      count: 10,
    });

    expect(similarity.similarTrackIds).toHaveBeenCalledWith(
      expect.objectContaining({ seedItemIds: ['seed'], excludeItemIds: ['b', 'c'] })
    );
  });

  it('requests a larger candidate pool than count and samples down, so repeat plays of the same seed vary', async () => {
    const similarity = similarityReturning(['a', 'b', 'c', 'd', 'e']);
    const get = jest.fn(async (id: string) => song(id));
    const api = fakeApi({ songs: { get, scrobble: jest.fn(), buildStreamUrl: jest.fn(), streamableCodecs: ['mp3'], scrobbleKind: 'scrobble' as const } });
    const provider = createSimilarityServiceQueueFillProvider(similarity, api);

    const result = await provider.fetchExtension({
      recentSongs: [song('seed')],
      excludeIds: new Set(),
      count: 3,
    });

    const [opts] = similarity.similarTrackIds.mock.calls[0] as unknown as [{ limit: number }];
    expect(opts.limit).toBeGreaterThan(3);
    expect(result.length).toBe(3);
  });
});

describe('createLibraryQueueFillProvider', () => {
  const seed = { nativeId: 'seed', artistName: 'Artist' };

  it('is unavailable on a server with neither top songs nor random songs', () => {
    expect(createLibraryQueueFillProvider(fakeApi()).isAvailable()).toBe(false);
  });

  it('takes at most half the batch from the seed artist and fills the rest from the library', async () => {
    const getTopSongs = jest.fn(async () => ['a1', 'a2', 'a3', 'a4'].map(song));
    const getRandomSongs = jest.fn(async () => ['r1', 'r2', 'r3', 'r4'].map(song));
    const api = fakeApi({
      artists: { list: jest.fn(), get: jest.fn(), getTopSongs },
      discovery: { getRandomSongs, getNowPlaying: jest.fn() },
    });

    const result = await createLibraryQueueFillProvider(api).fetchExtension({
      recentSongs: [seed],
      excludeIds: new Set(),
      count: 4,
    });

    expect(getTopSongs).toHaveBeenCalledWith('Artist', 8);
    // Shuffled within each source, so assert on the split rather than the order.
    const picked = result.map(s => s.nativeId);
    expect(picked).toHaveLength(4);
    expect(picked.slice(0, 2).every(id => id.startsWith('a'))).toBe(true);
    expect(picked.slice(2).every(id => id.startsWith('r'))).toBe(true);
  });

  it('skips what is already queued and never returns a track twice', async () => {
    const api = fakeApi({
      artists: { list: jest.fn(), get: jest.fn(), getTopSongs: jest.fn(async () => [song('a1'), song('dup')]) },
      discovery: { getRandomSongs: jest.fn(async () => [song('dup'), song('queued'), song('r1')]), getNowPlaying: jest.fn() },
    });

    const result = await createLibraryQueueFillProvider(api).fetchExtension({
      recentSongs: [seed],
      excludeIds: new Set([idOf('queued')]),
      count: 10,
    });

    expect(result.map(s => s.nativeId).sort()).toEqual(['a1', 'dup', 'r1']);
  });

  it('still answers from the library when the artist lookup fails', async () => {
    const api = fakeApi({
      artists: { list: jest.fn(), get: jest.fn(), getTopSongs: jest.fn(async () => { throw new Error('down'); }) },
      discovery: { getRandomSongs: jest.fn(async () => [song('r1')]), getNowPlaying: jest.fn() },
    });

    const result = await createLibraryQueueFillProvider(api).fetchExtension({
      recentSongs: [seed],
      excludeIds: new Set(),
      count: 4,
    });

    expect(result.map(s => s.nativeId)).toEqual(['r1']);
  });
});
