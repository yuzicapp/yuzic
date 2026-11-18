import { getAlbums, normalizeAlbum } from './getAlbums';
import { MediaBrowserClient } from '../client';
import { JELLYFIN_BRAND, EMBY_BRAND } from '../brand';
import { log } from '@/features/diagnostics/log';

function makeClient(overrides: Partial<MediaBrowserClient> = {}): MediaBrowserClient {
  return {
    request: jest.fn().mockResolvedValue({ Items: [] }),
    requestText: jest.fn(),
    serverUrl: 'https://server.example',
    serverId: 'server-1',
    token: 'tok',
    userId: 'user-1',
    parentId: undefined,
    buildStreamUrl: jest.fn(),
    brand: JELLYFIN_BRAND,
    ...overrides,
  } as MediaBrowserClient;
}

const rawAlbum = {
  Id: 'album-1',
  Name: 'Album One',
  ArtistItems: [{ Id: 'artist-1', Name: 'Artist One' }],
  ProductionYear: 2020,
  Genres: ['Rock;Pop'],
  DateCreated: '2020-01-01T00:00:00Z',
  ImageTags: { Primary: 'tag-abc' },
};

describe('normalizeAlbum', () => {
  it('gives jellyfin albums an itemId-only cover regardless of image tag', () => {
    const client = makeClient({ brand: JELLYFIN_BRAND });
    const album = normalizeAlbum(rawAlbum, client);
    expect(album?.cover).toEqual({ kind: 'jellyfin', itemId: 'album-1' });
  });

  it('gives emby albums a cover only when an image tag is present', () => {
    const client = makeClient({ brand: EMBY_BRAND });
    expect(normalizeAlbum(rawAlbum, client)?.cover).toEqual({ kind: 'emby', itemId: 'album-1', tag: 'tag-abc' });
    expect(normalizeAlbum({ ...rawAlbum, ImageTags: undefined }, client)?.cover).toEqual({
      kind: 'none',
      subject: { kind: 'album', title: 'Album One', artistName: 'Artist One' },
    });
  });

  it('returns null when the album has no Id', () => {
    const client = makeClient();
    expect(normalizeAlbum({ ...rawAlbum, Id: undefined }, client)).toBeNull();
  });

  it('splits comma/semicolon-joined genres', () => {
    const client = makeClient();
    expect(normalizeAlbum(rawAlbum, client)?.genres).toEqual(['Rock', 'Pop']);
  });
});

describe('getAlbums', () => {
  it('filters out unparseable items and maps the rest', async () => {
    const client = makeClient({
      request: jest.fn().mockResolvedValue({ Items: [rawAlbum, { Id: undefined }] }),
    });
    const albums = await getAlbums(client);
    expect(albums).toHaveLength(1);
    expect(albums[0].nativeId).toBe('album-1');
  });

  // `mapAlbum` reads `PremiereDate`, and the discography ordering reads the
  // `releaseDate` it produces — so a field list that omits it leaves every
  // album undated without anything failing.
  it('asks for PremiereDate, so the mapped album carries a release date', async () => {
    const request = jest.fn().mockResolvedValue({
      Items: [{ ...rawAlbum, PremiereDate: '2020-03-04T00:00:00.000Z' }],
    });
    const albums = await getAlbums(makeClient({ request }));
    expect(request.mock.calls[0][0]).toContain('PremiereDate');
    expect(albums[0].releaseDate).toBe('2020-03-04T00:00:00.000Z');
  });
});

describe('normalizeAlbum identity', () => {
  it('sets a stable localId when the client carries a serverId', () => {
    const client = makeClient({ serverId: 'server-1' });
    const album = normalizeAlbum(rawAlbum, client);
    expect(album?.localId).toBe('local:album:srv:server-1:album-1');
    expect(album?.artist.localId).toBe('local:artist:srv:server-1:artist-1');

    // Stable: normalizing the same raw item against the same server again yields the same id.
    const again = normalizeAlbum(rawAlbum, client);
    expect(again?.localId).toBe(album?.localId);
  });

  // A missing serverId is a programming error (every real adapter is built
  // from `Server.id`, which is required) — not a data case to paper over with
  // a fabricated scope that would corrupt every LocalId built against it.
  // `normalizeAlbum` reports it (to the diagnostics log, same as any other
  // unparseable item) and drops the record rather than inventing one.
  it('drops the album instead of fabricating a placeholder identity, when the client has no serverId', () => {
    log.clear();
    const client = makeClient({ serverId: undefined });

    expect(normalizeAlbum(rawAlbum, client)).toBeNull();
    expect(log.records()).toEqual([
      expect.objectContaining({
        scope: 'server',
        level: 'error',
        fields: expect.objectContaining({ operation: 'normalizeAlbum' }),
      }),
    ]);
  });
});
