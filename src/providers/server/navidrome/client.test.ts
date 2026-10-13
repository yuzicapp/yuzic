import { createNavidromeClient, SubsonicRequestError } from './client';
import { ServerFeatureUnavailableError } from '@/providers/contracts/ServerAdapter';

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

const client = () =>
  createNavidromeClient({
    serverUrl: 'https://music.example.com',
    username: 'zack',
    password: 'hunter2',
  });

/**
 * A Subsonic server refuses a request with HTTP 200.
 *
 * Wrong credentials, a missing parameter, a library the account can't see —
 * every one comes back `200 OK` with `status: "failed"` in the body. The client
 * only threw on a non-2xx status, so a refusal reached the fetchers as a normal
 * response with no `albumList` in it, and they read that as a library with
 * nothing in it. Cached as a success under `staleTime: Infinity`, it never
 * refetched: on a cold start that raced the keystore read, Albums, Tracks and
 * Artists stayed empty until the app's data was cleared.
 */
describe('form POST', () => {
  beforeEach(() => mockServerFetch.mockReset());

  const ok = { 'subsonic-response': { status: 'ok' } };
  const extensions = (names: string[]) => ({
    'subsonic-response': { status: 'ok', openSubsonicExtensions: names.map(name => ({ name, versions: [1] })) },
  });

  it('sends a POST form-encoded in the body when the server declares formPost', async () => {
    mockServerFetch
      .mockReturnValueOnce(respond(extensions(['formPost', 'songLyrics'])))
      .mockReturnValue(respond(ok));
    const nd = client();

    await nd.request('updatePlaylist.view', { playlistId: 'p1', songIdToAdd: ['a', 'b'] }, { method: 'POST' });
    await nd.request('updatePlaylist.view', { playlistId: 'p1' }, { method: 'POST' });

    const [url, init] = mockServerFetch.mock.calls[1];
    expect(url).toBe('https://music.example.com/rest/updatePlaylist.view');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(init.body).getAll('songIdToAdd')).toEqual(['a', 'b']);
    // Asked once, not per request.
    expect(mockServerFetch.mock.calls.filter(([u]) => String(u).includes('getOpenSubsonicExtensions'))).toHaveLength(1);
  });

  it('keeps parameters in the URL on a server without it, or one that cannot say', async () => {
    mockServerFetch
      .mockReturnValueOnce(respond({ 'subsonic-response': { status: 'failed', error: { code: 0, message: 'not found' } } }))
      .mockReturnValue(respond(ok));

    await client().request('updatePlaylist.view', { playlistId: 'p1' }, { method: 'POST' });

    const [url, init] = mockServerFetch.mock.calls[1];
    expect(url).toContain('/rest/updatePlaylist.view?');
    expect(url).toContain('playlistId=p1');
    expect(init.body).toBeUndefined();
  });

  it('never asks for extensions on a GET', async () => {
    mockServerFetch.mockReturnValue(respond(ok));

    await client().request('ping.view');

    expect(mockServerFetch).toHaveBeenCalledTimes(1);
  });
});

describe('request', () => {
  beforeEach(() => mockServerFetch.mockReset());

  it('rejects a refused request instead of returning it as data', async () => {
    mockServerFetch.mockReturnValueOnce(respond({
      'subsonic-response': { status: 'failed', error: { code: 40, message: 'Wrong username or password' } },
    }));

    const request = client().request('getAlbumList.view', { type: 'newest' });

    await expect(request).rejects.toBeInstanceOf(SubsonicRequestError);
    await expect(request).rejects.toMatchObject({ code: 40, message: 'Wrong username or password' });
  });

  it('still hands back an ok response untouched', async () => {
    const body = { 'subsonic-response': { status: 'ok', albumList: { album: [] } } };
    mockServerFetch.mockReturnValueOnce(respond(body));

    await expect(client().request('getAlbumList.view')).resolves.toEqual(body);
  });

  it('reports an endpoint the server has not implemented as a feature it lacks', async () => {
    // What Navidrome answers to getPodcasts, and to getShares with sharing off.
    mockServerFetch.mockReturnValueOnce(respond('This endpoint is not implemented, but may be in future releases', 501));

    await expect(client().request('getPodcasts.view')).rejects.toBeInstanceOf(ServerFeatureUnavailableError);
  });

  it('still rejects a non-2xx response', async () => {
    mockServerFetch.mockReturnValueOnce(respond('nope', 502));

    await expect(client().request('ping.view')).rejects.toThrow('Navidrome API error (502)');
  });
});

/**
 * Nextcloud Music cannot take a salted token (#271): it stores only a hash of
 * the app password, so it answers every token request with error 41 and
 * expects the password itself. Signing in failed outright.
 */
describe('password auth fallback', () => {
  beforeEach(() => mockServerFetch.mockReset());

  const ok = { 'subsonic-response': { status: 'ok' } };
  const refused = (code: number) => ({
    'subsonic-response': { status: 'failed', error: { code, message: 'Token-based authentication not supported' } },
  });
  const paramsOf = (call: unknown[]) => new URL(String(call[0])).searchParams;

  it.each([41, 42])('retries with the password when the server refuses a token (%i), and keeps using it', async code => {
    mockServerFetch.mockReturnValueOnce(respond(refused(code))).mockReturnValue(respond(ok));
    const nd = client();

    await expect(nd.request('ping.view')).resolves.toEqual(ok);
    await nd.request('getAlbumList2.view');

    const [first, retry, next] = mockServerFetch.mock.calls.map(paramsOf);
    expect(first.has('t')).toBe(true);
    // 'hunter2' as UTF-8 hex — Subsonic's `enc:` form of `p`.
    expect(retry.get('p')).toBe('enc:68756e74657232');
    expect(retry.has('t')).toBe(false);
    expect(next.get('p')).toBe('enc:68756e74657232');
    expect(paramsOf([nd.buildStreamUrl('s1')]).get('p')).toBe('enc:68756e74657232');
  });

  it('keeps token auth, and the refusal, for any other error', async () => {
    mockServerFetch.mockReturnValue(respond(refused(40)));
    const nd = client();

    await expect(nd.request('ping.view')).rejects.toMatchObject({ code: 40 });
    expect(mockServerFetch).toHaveBeenCalledTimes(1);
    expect(paramsOf([nd.buildStreamUrl('s1')]).has('t')).toBe(true);
  });

  it('gives up after one password retry rather than looping', async () => {
    mockServerFetch.mockReturnValue(respond(refused(41)));

    await expect(client().request('ping.view')).rejects.toBeInstanceOf(SubsonicRequestError);
    expect(mockServerFetch).toHaveBeenCalledTimes(2);
  });

  it('hex-encodes a password as UTF-8 bytes', async () => {
    mockServerFetch.mockReturnValueOnce(respond(refused(41))).mockReturnValue(respond(ok));
    const nd = createNavidromeClient({ serverUrl: 'https://music.example.com', username: 'zack', password: 'pä&ss' });

    await nd.request('ping.view');
    expect(paramsOf(mockServerFetch.mock.calls[1]).get('p')).toBe('enc:70c3a4267373');
  });
});
