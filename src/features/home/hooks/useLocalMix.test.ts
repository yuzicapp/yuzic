import type { Song } from '@/domain/entities/Song';

jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({}) }));
jest.mock('@/features/connectivity/useServerReachable', () => ({ useServerReachable: () => true }));
jest.mock('@/features/song/useSongsById', () => ({ useSongsById: () => new Map() }));
jest.mock('@/state/redux/selectors/statsSelectors', () => ({ selectSongPlayCounts: () => ({}) }));

import { chooseDailySeeds } from './useLocalMix';

const song = (id: string) => ({ localId: id }) as unknown as Song;
const library = (...ids: string[]) => new Map(ids.map(id => [id, song(id)]));

/**
 * The local mix keeps its seeds for the day.
 *
 * A scrobble at the end of every song changed the play counts the seeds are
 * picked from, which re-picked them, changed the query key and re-fetched the
 * mix behind a skeleton at every track change.
 */
describe('chooseDailySeeds', () => {
  it('keeps the held seeds when play counts suggest different ones on the same day', () => {
    const held = chooseDailySeeds(null, [song('a'), song('b')], 'Mon:0', library('a', 'b', 'c'));
    const next = chooseDailySeeds(held, [song('c'), song('a')], 'Mon:0', library('a', 'b', 'c'));
    expect(next).toBe(held);
    expect(next.seeds.map(s => s.localId)).toEqual(['a', 'b']);
  });

  it('picks again on a new day or a manual refresh', () => {
    const held = chooseDailySeeds(null, [song('a'), song('b')], 'Mon:0', library('a', 'b', 'c'));
    expect(chooseDailySeeds(held, [song('c')], 'Tue:0', library('a', 'b', 'c')).seeds.map(s => s.localId)).toEqual(['c']);
    expect(chooseDailySeeds(held, [song('c')], 'Mon:1', library('a', 'b', 'c')).seeds.map(s => s.localId)).toEqual(['c']);
  });

  it('picks once there is something to pick, after starting with nothing', () => {
    const empty = chooseDailySeeds(null, [], 'Mon:0', library('a'));
    expect(chooseDailySeeds(empty, [song('a')], 'Mon:0', library('a')).seeds.map(s => s.localId)).toEqual(['a']);
  });

  it('picks again when a held seed has left the library', () => {
    const held = chooseDailySeeds(null, [song('a'), song('b')], 'Mon:0', library('a', 'b'));
    // Another server's library, or the song removed.
    expect(chooseDailySeeds(held, [song('x')], 'Mon:0', library('x')).seeds.map(s => s.localId)).toEqual(['x']);
  });
});
