import { serverProvenance } from '@/domain/identity/Provenance';
import { getSimilarSongs } from './similar/getSimilarSongs';
import { getSimilarArtists } from './similar/getSimilarArtists';
import { getTopSongs } from './artists/getTopSongs';
import { getInternetRadioStations } from './radio/getInternetRadioStations';
import { getRandomSongs } from './discovery/random';
import type { NavidromeClient } from './client';
import { log } from '@/features/diagnostics/log';

/**
 * A request that failed is not a library that is empty.
 *
 * These fetchers used to `catch` and return `[]` or `null`, which reads as a
 * successful load of nothing. That is not only a wrong message on screen — it
 * silently disables three mechanisms in `src/app/_layout.tsx` that all key off
 * a query *throwing*:
 *
 *   - `isLikelyNetworkError(error)` → `setServerUnreachable(true)`, which is
 *     the whole server-unreachable banner
 *   - the `libraryLoadFailed` toast
 *   - `retry: 1` in the query defaults
 *
 * A resolved empty array is recorded by React Query as a success, so none of
 * the three fire: no banner, no toast, and no retry on a blip that would have
 * cleared on the second attempt.
 *
 * The same shape as the engine's stalled-read bug, one layer up: a failure
 * relabelled as a plausible success before anything above can see it.
 *
 * Genuinely-absent data is a different thing and is deliberately not covered
 * here — a server with no radio stations still answers, and those paths return
 * empty from a *successful* response rather than from a catch.
 */
describe('a failed request rejects rather than resolving empty', () => {
  const failing = {
    request: jest.fn().mockRejectedValue(new Error('Network request failed')),
  } as unknown as NavidromeClient;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  const provenance = serverProvenance('srv-1');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getSimilarSongs rejects', async () => {
    await expect(getSimilarSongs(failing, provenance, 'song-1')).rejects.toThrow('Network request failed');
  });

  it('getSimilarArtists rejects', async () => {
    await expect(getSimilarArtists(failing, provenance, 'artist-1')).rejects.toThrow('Network request failed');
  });

  it('getTopSongs rejects', async () => {
    await expect(getTopSongs(failing, provenance, 'Artist Name')).rejects.toThrow('Network request failed');
  });

  it('getInternetRadioStations rejects', async () => {
    await expect(getInternetRadioStations(failing)).rejects.toThrow('Network request failed');
  });

  it('getRandomSongs rejects', async () => {
    await expect(getRandomSongs(failing, provenance)).rejects.toThrow('Network request failed');
  });

  it('still logs the failure, so the reason survives the rethrow', async () => {
    log.clear();

    await expect(getSimilarSongs(failing, provenance, 'song-1')).rejects.toThrow();

    // Recorded rather than printed: the reason has to reach the diagnostics
    // export, not a console no user can read.
    expect(log.records()).toEqual([
      expect.objectContaining({
        scope: 'server',
        level: 'error',
        fields: expect.objectContaining({
          provider: 'navidrome',
          operation: 'getSimilarSongs',
          detail: 'Network request failed',
        }),
      }),
    ]);
  });
});
