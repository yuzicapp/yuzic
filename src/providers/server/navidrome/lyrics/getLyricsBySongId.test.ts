import { getLyricsBySongId } from './getLyricsBySongId';
import { SubsonicRequestError, type NavidromeClient } from '../client';

function makeClient(lyricsList: unknown): NavidromeClient {
  return {
    request: jest.fn().mockResolvedValue({ 'subsonic-response': { status: 'ok', lyricsList } }),
    buildStreamUrl: jest.fn(),
    serverUrl: 'https://example',
    username: 'u',
    password: 'p',
  } as unknown as NavidromeClient;
}

describe('getLyricsBySongId', () => {
  it('keeps the timings of a synced list', async () => {
    const client = makeClient({
      structuredLyrics: [
        { synced: true, line: [{ start: 0, value: 'first' }, { start: 4200, value: 'second' }] },
      ],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result).toEqual({
      synced: true,
      lines: [
        { startMs: 0, text: 'first' },
        { startMs: 4200, text: 'second' },
      ],
    });
  });

  /** The whole point of the change: this used to return null. */
  it('returns an unsynced list instead of dropping it', async () => {
    const client = makeClient({
      structuredLyrics: [
        { synced: false, line: [{ value: 'a plain line' }, { value: 'and another' }] },
      ],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result).toEqual({
      synced: false,
      lines: [
        { startMs: 0, text: 'a plain line' },
        { startMs: 0, text: 'and another' },
      ],
    });
  });

  it('zeroes an unsynced line that still carries a start value', async () => {
    const client = makeClient({
      structuredLyrics: [{ synced: false, line: [{ start: 999, value: 'untimed' }] }],
    });

    const result = await getLyricsBySongId(client, 'song-1');

    expect(result?.lines).toEqual([{ startMs: 0, text: 'untimed' }]);
  });

  it('is null when there are no lyrics at all', async () => {
    expect(await getLyricsBySongId(makeClient({}), 'song-1')).toBeNull();
    expect(await getLyricsBySongId(makeClient({ structuredLyrics: [] }), 'song-1')).toBeNull();
  });

  it('is null when every line is blank, rather than an empty sheet', async () => {
    const client = makeClient({
      structuredLyrics: [{ synced: false, line: [{ value: '   ' }, { value: '' }] }],
    });

    expect(await getLyricsBySongId(client, 'song-1')).toBeNull();
  });

  it('reads a later list when the first one is empty', async () => {
    const client = makeClient({
      structuredLyrics: [
        { synced: false, line: [] },
        { synced: false, line: [{ value: 'found it' }] },
      ],
    });

    expect(await getLyricsBySongId(client, 'song-1')).toEqual({
      synced: false,
      lines: [{ startMs: 0, text: 'found it' }],
    });
  });

  it('prefers a synced list over a plain one listed before it', async () => {
    const client = makeClient({
      structuredLyrics: [
        { synced: false, line: [{ value: 'plain' }] },
        { synced: true, line: [{ start: 1000, value: 'timed' }] },
      ],
    });

    expect(await getLyricsBySongId(client, 'song-1')).toEqual({
      synced: true,
      lines: [{ startMs: 1000, text: 'timed' }],
    });
  });

  it('tolerates a list with no line field', async () => {
    const client = makeClient({ structuredLyrics: [{ synced: false }] });

    expect(await getLyricsBySongId(client, 'song-1')).toBeNull();
  });

  describe('on a server without getLyricsBySongId', () => {
    function legacyClient(lyricsValue: string | undefined, songFails = false) {
      const request = jest.fn(async (endpoint: string, params: Record<string, unknown>) => {
        if (endpoint === 'getLyricsBySongId.view') throw new SubsonicRequestError(0, 'Unknown endpoint');
        if (endpoint === 'getSong.view') {
          if (songFails) throw new Error('offline');
          return { 'subsonic-response': { song: { id: params.id, title: 'Song', artist: 'Band' } } };
        }
        if (endpoint === 'getLyrics.view') {
          return { 'subsonic-response': { lyrics: lyricsValue === undefined ? {} : { value: lyricsValue } } };
        }
        throw new Error(`unexpected ${endpoint}`);
      });
      return { client: { request } as unknown as NavidromeClient, request };
    }

    it('asks getLyrics.view by artist and title, and splits the plain text', async () => {
      const { client, request } = legacyClient('first line\n\nsecond line\r\n');

      expect(await getLyricsBySongId(client, 'song-1')).toEqual({
        synced: false,
        lines: [
          { startMs: 0, text: 'first line' },
          { startMs: 0, text: 'second line' },
        ],
      });
      expect(request).toHaveBeenCalledWith('getLyrics.view', { artist: 'Band', title: 'Song' });
    });

    it('keeps the timings when the text is LRC', async () => {
      const { client } = legacyClient('[00:01.00] one\n[00:02.50] two');

      expect(await getLyricsBySongId(client, 'song-1')).toEqual({
        synced: true,
        lines: [
          { startMs: 1000, text: 'one' },
          { startMs: 2500, text: 'two' },
        ],
      });
    });

    it('is null when the plain lookup has nothing', async () => {
      expect(await getLyricsBySongId(legacyClient(undefined).client, 'song-1')).toBeNull();
      expect(await getLyricsBySongId(legacyClient('   ').client, 'song-1')).toBeNull();
    });

    it('reports the first failure when the fallback fails too', async () => {
      const { client } = legacyClient('unused', true);
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getLyricsBySongId(client, 'song-1')).rejects.toThrow('Unknown endpoint');
      spy.mockRestore();
    });
  });
});
