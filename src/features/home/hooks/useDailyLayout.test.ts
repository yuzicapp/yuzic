import { renderHook } from '@testing-library/react-native';

type Artist = { nativeId: string; name: string };

let mockArtists: Artist[] = [];
// Constant, like a query's cached data: a new array per call would rebuild the
// layout for reasons that have nothing to do with play counts.
const mockNoAlbums: unknown[] = [];
const mockNoGenres: string[] = [];
let mockArtistPlayCounts: Record<string, number> = {};

jest.mock('@/features/album/useAlbums', () => ({ useAlbums: () => ({ albums: mockNoAlbums }) }));
jest.mock('@/features/artist/useArtists', () => ({ useArtists: () => ({ artists: mockArtists }) }));
jest.mock('@/features/genre/useGenres', () => ({ useGenres: () => ({ genres: mockNoGenres }) }));
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => false }));
jest.mock('@/state/redux/selectors/statsSelectors', () => ({ selectArtistPlayCounts: "artistPlayCounts" }));
jest.mock('react-redux', () => ({ useSelector: () => mockArtistPlayCounts }));
// One tier that echoes its seeds, so the test sees exactly what reached it.
jest.mock('@/providers/registry/homeDiscovery', () => ({
  HOME_SOURCE_TIERS: [{
    source: 'listenbrainz',
    shuffleDaily: false,
    build: (seeds: { becauseSeeds: string[]; similarSeeds: string[] }) => [
      { key: `because:${seeds.becauseSeeds.join('|')}`, type: 'becauseYouListened' },
      { key: `similar:${seeds.similarSeeds.join('|')}`, type: 'lbSimilarArtistsForYou' },
    ],
  }],
}));

import { useDailyLayout } from './useDailyLayout';

/**
 * Home's layout keeps its identity when a play count changes nothing it shows.
 *
 * The scrobble at every track change bumps a play count, which re-sorts the
 * artist seed pool. The seed names almost never change, but the arrays built
 * from them were new every time, so `sources` changed and every shelf on Home
 * re-rendered at the end of every song — the single largest commit measured
 * on a track change.
 */
describe('useDailyLayout identity across play-count changes', () => {
  beforeEach(() => {
    mockArtists = [
      { nativeId: 'a1', name: 'Lil Baby' },
      { nativeId: 'a2', name: 'Playboi Carti' },
      { nativeId: 'a3', name: 'Lucki' },
    ];
    mockArtistPlayCounts = { a1: 10, a2: 5, a3: 1 };
  });

  it('keeps the same sources when a count changes but the seed names do not', async () => {
    const hook = await renderHook(() => useDailyLayout(0));
    const before = hook.result.current;

    // One more play of an artist already on top: same names, same order.
    mockArtistPlayCounts = { ...mockArtistPlayCounts, a1: 11 };
    await hook.rerender({});

    expect(hook.result.current.sources).toBe(before.sources);
    expect(hook.result.current).toBe(before);
  });

  it('rebuilds when the seed names really change', async () => {
    const hook = await renderHook(() => useDailyLayout(0));
    const before = hook.result.current;
    const keysBefore = before.sources.listenbrainz?.map(s => s.key);

    // A new artist enters the pool: the similar-artist seeds now include it.
    mockArtists = [...mockArtists, { nativeId: 'a4', name: 'Young Thug' }];
    mockArtistPlayCounts = { ...mockArtistPlayCounts, a4: 50 };
    await hook.rerender({});

    expect(hook.result.current.sources).not.toBe(before.sources);
    expect(hook.result.current.sources.listenbrainz?.map(s => s.key)).not.toEqual(keysBefore);
  });

  it('keeps names with spaces whole', async () => {
    const hook = await renderHook(() => useDailyLayout(0));
    const similar = hook.result.current.sources.listenbrainz?.find(s => s.type === 'lbSimilarArtistsForYou');
    const names = similar?.key.replace('similar:', '').split('|') ?? [];
    expect(names.sort()).toEqual(['Lil Baby', 'Lucki', 'Playboi Carti']);
  });
});
