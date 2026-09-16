import type { NavidromeClient } from '../client';
import {
  createInternetRadioStation,
  getInternetRadioStations,
  updateInternetRadioStation,
} from './getInternetRadioStations';

function clientReturning(body: unknown) {
  const request = jest.fn().mockResolvedValue(body);
  return { client: { request } as unknown as NavidromeClient, request };
}

const station = (extra: Record<string, unknown>) => ({
  'subsonic-response': {
    internetRadioStations: {
      internetRadioStation: [
        { id: 'r1', name: 'Radio Paradise', streamUrl: 'https://stream.example/aac', ...extra },
      ],
    },
  },
});

describe('getInternetRadioStations', () => {
  it("reads the homepage from the field a server answers with (`homePageUrl`)", async () => {
    const { client } = clientReturning(station({ homePageUrl: 'https://radioparadise.com' }));

    await expect(getInternetRadioStations(client)).resolves.toEqual([
      {
        id: 'r1',
        name: 'Radio Paradise',
        streamUrl: 'https://stream.example/aac',
        homepageUrl: 'https://radioparadise.com',
      },
    ]);
  });

  it('still reads the parameter spelling, for a server that echoes it back', async () => {
    const { client } = clientReturning(station({ homepageUrl: 'https://example.fm' }));

    const [read] = await getInternetRadioStations(client);
    expect(read.homepageUrl).toBe('https://example.fm');
  });

  it('leaves the homepage undefined when the station has none', async () => {
    const { client } = clientReturning(station({}));

    const [read] = await getInternetRadioStations(client);
    expect(read.homepageUrl).toBeUndefined();
  });
});

describe('writing a station', () => {
  it('sends the homepage when creating one', async () => {
    const { client, request } = clientReturning({});

    await createInternetRadioStation(client, {
      name: 'Radio Paradise',
      streamUrl: 'https://stream.example/aac',
      homepageUrl: 'https://radioparadise.com',
    });

    expect(request).toHaveBeenCalledWith('createInternetRadioStation.view', {
      name: 'Radio Paradise',
      streamUrl: 'https://stream.example/aac',
      homepageUrl: 'https://radioparadise.com',
    });
  });

  it('sends the homepage on every update, so clearing one reaches the server', async () => {
    const { client, request } = clientReturning({});

    await updateInternetRadioStation(client, {
      id: 'r1',
      name: 'Radio Paradise',
      streamUrl: 'https://stream.example/aac',
    });

    expect(request).toHaveBeenCalledWith('updateInternetRadioStation.view', {
      id: 'r1',
      name: 'Radio Paradise',
      streamUrl: 'https://stream.example/aac',
      homepageUrl: '',
    });
  });

  it('keeps a homepage an update carries', async () => {
    const { client, request } = clientReturning({});

    await updateInternetRadioStation(client, {
      id: 'r1',
      name: 'Radio Paradise',
      streamUrl: 'https://stream.example/aac',
      homepageUrl: 'https://radioparadise.com',
    });

    expect(request).toHaveBeenCalledWith(
      'updateInternetRadioStation.view',
      expect.objectContaining({ homepageUrl: 'https://radioparadise.com' })
    );
  });
});
