import { monitorArtist } from './monitor';
import type { LidarrClient } from '../client';

/**
 * Following an artist is the artist want's Get. The two things worth holding
 * still are that it resolves the *same* artist an album request would, and
 * that it does not turn one tap into a discography's worth of downloads.
 */

type Routes = {
  artists?: unknown[];
  lookup?: unknown[];
  rootFolders?: { path: string }[];
  created?: { id: number };
};

function fakeClient(routes: Routes) {
  const posted: { path: string; body: any }[] = [];
  const request = jest.fn(async (path: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'POST') {
      posted.push({ path, body: JSON.parse(options.body ?? '{}') });
      return routes.created ?? { id: 42 };
    }
    if (path.startsWith('/artist/lookup')) return routes.lookup ?? [];
    if (path === '/artist') return routes.artists ?? [];
    if (path === '/rootfolder') return routes.rootFolders ?? [{ path: '/music' }];
    return [];
  });
  return { client: { request } as unknown as LidarrClient, request, posted };
}

const IVE = {
  artistName: 'IVE',
  foreignArtistId: 'b2f2216a-d7a9-4ce0-8b8f-f494d9a8c196',
};

describe('monitorArtist', () => {
  it('resolves an artist Lidarr already holds without a metadata lookup', async () => {
    const { client, request } = fakeClient({ artists: [{ ...IVE, id: 7 }] });

    const result = await monitorArtist(client, { name: 'IVE' });

    expect(result).toEqual({ success: true, artistId: 7, created: false });
    expect(request.mock.calls.some(([path]) => String(path).startsWith('/artist/lookup'))).toBe(false);
  });

  it('adds an artist it has never heard of, and follows them from now on', async () => {
    const { client, posted } = fakeClient({ artists: [], lookup: [IVE], created: { id: 42 } });

    const result = await monitorArtist(client, { name: 'IVE' });

    expect(result).toEqual({ success: true, artistId: 42, created: true });
    expect(posted).toHaveLength(1);
    expect(posted[0].body.monitored).toBe(true);
  });

  it('does not go looking for the back catalogue — a Get is not an auto-download', async () => {
    // One tap must not become every album the artist ever released. They are
    // followed for what comes next; existing records are had one Get at a time.
    const { client, posted } = fakeClient({ artists: [], lookup: [IVE] });

    await monitorArtist(client, { name: 'IVE' });

    expect(posted[0].body.addOptions).toEqual({ searchForMissingAlbums: false, monitor: 'future' });
  });

  it('prefers the MBID, so it follows the same artist an album request would', async () => {
    const other = { artistName: 'IVE', foreignArtistId: 'a92e9703-929f-45bb-aa78-b78dfde731a4' };
    const { client } = fakeClient({ artists: [{ ...other, id: 3 }, { ...IVE, id: 9 }] });

    const result = await monitorArtist(client, { name: 'IVE', mbid: IVE.foreignArtistId });

    expect(result).toEqual({ success: true, artistId: 9, created: false });
  });

  it('refuses rather than guessing when the name matches several artists', async () => {
    const { client, posted } = fakeClient({
      artists: [],
      lookup: [IVE, { artistName: 'IVE', foreignArtistId: 'a760a4d1-1258-4833-9ed5-fa083902d907' }],
    });

    const result = await monitorArtist(client, { name: 'IVE' });

    expect(result).toEqual({
      success: false,
      code: 'artist_identity_ambiguous',
      message: expect.stringContaining('artist_identity_ambiguous'),
    });
    expect(posted).toHaveLength(0);
  });

  it('refuses an empty name without calling Lidarr at all', async () => {
    const { client, request } = fakeClient({});

    const result = await monitorArtist(client, { name: '  ' });

    expect(result).toMatchObject({ success: false });
    expect(request).not.toHaveBeenCalled();
  });
});
