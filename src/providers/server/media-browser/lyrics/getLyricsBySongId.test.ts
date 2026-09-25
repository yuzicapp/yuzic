import { getLyricsBySongId } from './getLyricsBySongId';
import { MediaBrowserRequestError } from '../requestError';
import type { MediaBrowserClient } from '../client';

const clientThatThrows = (error: unknown) =>
  ({ request: jest.fn().mockRejectedValue(error) }) as unknown as MediaBrowserClient;

const clientThatReturns = (json: unknown) =>
  ({ request: jest.fn().mockResolvedValue(json) }) as unknown as MediaBrowserClient;

describe('getLyricsBySongId', () => {
  /**
   * The bug this covers: Jellyfin says "no lyrics" with a 404, and that was
   * rethrown as a failure. `resolveLyrics` deliberately keeps a server failure
   * and rethrows it when nothing else finds lyrics either, so every unsynced
   * track on a Jellyfin server reported an error instead of showing nothing —
   * and in development, a red box over the app on each one.
   */
  it('reads a 404 as "this track has no lyrics", not as a failure', async () => {
    const client = clientThatThrows(new MediaBrowserRequestError('Jellyfin', 404, 'Not Found'));

    await expect(getLyricsBySongId(client, 'song-1')).resolves.toBeNull();
  });

  it('still fails for a server that is actually broken', async () => {
    const client = clientThatThrows(new MediaBrowserRequestError('Jellyfin', 500, 'boom'));

    await expect(getLyricsBySongId(client, 'song-1')).rejects.toThrow('Jellyfin API error (500)');
  });

  it('still fails when the request never reached a server', async () => {
    const client = clientThatThrows(new TypeError('Network request failed'));

    await expect(getLyricsBySongId(client, 'song-1')).rejects.toThrow('Network request failed');
  });

  it('returns null when the server answers with no lyrics at all', async () => {
    await expect(getLyricsBySongId(clientThatReturns({}), 'song-1')).resolves.toBeNull();
  });

  it('prefers the timed list where the server sends one', async () => {
    const client = clientThatReturns({
      SyncedLyrics: [{ StartPositionTicks: 10_000, Text: 'first' }],
      Lyrics: [{ Text: 'plain' }],
    });

    await expect(getLyricsBySongId(client, 'song-1')).resolves.toEqual({
      synced: true,
      lines: [{ startMs: 1, text: 'first' }],
    });
  });
});
