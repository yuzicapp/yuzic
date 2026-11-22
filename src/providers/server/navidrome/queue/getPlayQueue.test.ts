import { createNavidromeClient } from '../client';
import { savePlayQueue } from './getPlayQueue';

const mockServerFetch = jest.fn();
jest.mock('@/features/mtls/serverFetch', () => ({
  serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}));

const respond = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const ok = { 'subsonic-response': { status: 'ok' } };
const withFormPost = {
  'subsonic-response': { status: 'ok', openSubsonicExtensions: [{ name: 'formPost', versions: [1] }] },
};

const client = () =>
  createNavidromeClient({
    serverUrl: 'https://music.example.com',
    username: 'zack',
    password: 'hunter2',
  });

/**
 * What Navidrome receives. Call 0 is the client asking the server for its
 * extensions; call 1 is savePlayQueue itself.
 */
const sent = () => {
  const [url, init] = mockServerFetch.mock.calls[1];
  return { url: String(url), init, form: new URLSearchParams(init.body) };
};

/**
 * Subsonic stores the queue as repeated `id` parameters, one per song, and
 * Navidrome reads nothing else. The queue used to be sent as `id` (the first
 * song) plus `ids` (the rest, comma-joined), a shape borrowed from jukebox
 * `set`: Navidrome ignored `ids`, kept one song, and the cross-device queue
 * on the server was always a single track.
 */
describe('savePlayQueue', () => {
  beforeEach(() => {
    mockServerFetch.mockReset();
    mockServerFetch.mockReturnValueOnce(respond(withFormPost)).mockReturnValue(respond(ok));
  });

  it('sends one repeated id per song, in queue order', async () => {
    expect.hasAssertions();

    // The playing song is the second one, and the position has a fraction: both
    // would be lost if the queue were cut to its first entry or not floored.
    await savePlayQueue(client(), { songIds: ['a', 'b', 'c'], currentSongId: 'b', positionMs: 12345.9 });
    const { url, init, form } = sent();

    expect(url).toBe('https://music.example.com/rest/savePlayQueue.view');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(form.getAll('id')).toEqual(['a', 'b', 'c']);
    expect(form.get('current')).toBe('b');
    expect(form.get('position')).toBe('12345');
    expect(form.has('ids')).toBe(false);
  });

  it('leaves current and position out when it has none', async () => {
    expect.hasAssertions();

    await savePlayQueue(client(), { songIds: ['a', 'b'] });
    const { form } = sent();

    expect(form.getAll('id')).toEqual(['a', 'b']);
    expect(form.has('current')).toBe(false);
    expect(form.has('position')).toBe(false);
  });

  // A guard, not part of the fix: 0 is falsy, so a `if (positionMs)` check
  // would silently drop a song that has just restarted from 0:00.
  it('keeps a position of zero', async () => {
    expect.hasAssertions();

    await savePlayQueue(client(), { songIds: ['a'], currentSongId: 'a', positionMs: 0 });
    const { form } = sent();

    expect(form.getAll('id')).toEqual(['a']);
    expect(form.get('position')).toBe('0');
  });
});
