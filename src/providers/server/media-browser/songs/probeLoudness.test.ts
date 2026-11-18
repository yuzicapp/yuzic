import type { MediaBrowserClient } from '../client';
import { probeLoudness } from './probeLoudness';

/**
 * Whether a figure actually arrives (#314). Values below are real ones, from a
 * Jellyfin 12.4 server.
 */
function client(response: unknown, parentId?: string) {
  const request = jest.fn().mockResolvedValue(response);
  return {
    client: { userId: 'user-1', parentId, request } as unknown as MediaBrowserClient,
    request,
  };
}

describe('probeLoudness', () => {
  it('is true when the track carries a track figure', async () => {
    const { client: c } = client({ Items: [{ Id: 'tr-1', NormalizationGain: -6.6 }] });

    await expect(probeLoudness(c)).resolves.toBe(true);
  });

  it('is true when only an album figure came back', async () => {
    const { client: c } = client({ Items: [{ Id: 'tr-1', AlbumNormalizationGain: -8.1 }] });

    await expect(probeLoudness(c)).resolves.toBe(true);
  });

  it('is true for a measured zero, which is a figure', async () => {
    const { client: c } = client({ Items: [{ Id: 'tr-1', NormalizationGain: 0 }] });

    await expect(probeLoudness(c)).resolves.toBe(true);
  });

  it('is false where the server measured nothing', async () => {
    // Jellyfin before 10.10, or a library it has not scanned.
    const { client: c } = client({ Items: [{ Id: 'tr-1' }] });

    await expect(probeLoudness(c)).resolves.toBe(false);
  });

  it('is false for an empty library rather than throwing', async () => {
    const { client: c } = client({ Items: [] });

    await expect(probeLoudness(c)).resolves.toBe(false);
  });

  it('asks for one track and does not request the field', async () => {
    const { client: c, request } = client({ Items: [] });

    await probeLoudness(c);

    const path = request.mock.calls[0]?.[0] as string;
    expect(path).toContain('IncludeItemTypes=Audio');
    expect(path).toContain('Limit=1');
    // Not `SortName`: the same track every time lets one unscanned file at the
    // top of the alphabet speak for a measured library.
    expect(path).toContain('SortBy=Random');
    // `NormalizationGain` is not a name in `ItemFields`, and arrives unasked.
    expect(path).not.toContain('Fields=');
  });

  it('stays inside the chosen library', async () => {
    const { client: c, request } = client({ Items: [] }, 'lib-7');

    await probeLoudness(c);

    expect(request.mock.calls[0]?.[0]).toContain('ParentId=lib-7');
  });
});
