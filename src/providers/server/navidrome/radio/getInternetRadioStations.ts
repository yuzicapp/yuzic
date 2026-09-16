import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import type { InternetRadioStation } from '@/providers/contracts/ServerAdapter';


/**
 * User-defined internet radio stations stored on the Subsonic server. Navidrome
 * supports the full CRUD; other Subsonic servers may not, but reading always
 * works when the endpoint is present.
 */
export async function getInternetRadioStations(
  client: NavidromeClient
): Promise<InternetRadioStation[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getInternetRadioStations.view', {});
    const stations = raw?.['subsonic-response']?.internetRadioStations?.internetRadioStation ?? [];
    if (!Array.isArray(stations)) return [];
    return stations
      .filter((s): s is typeof s & { id: string; name: string; streamUrl: string } =>
        !!s?.id && !!s?.name && !!s?.streamUrl
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        streamUrl: s.streamUrl,
        // Subsonic spells this two different ways and the difference is not a
        // typo: the *parameter* create/update take is `homepageUrl`, while the
        // station a server *returns* carries `homePageUrl` (capital P, in both
        // the XML attribute and the JSON field — see Navidrome's
        // `responses.Radio`). Reading the parameter's spelling back meant every
        // saved homepage arrived as undefined, so the edit form opened blank and
        // the next save wrote that blank back to the server. The lowercase form
        // is still accepted here because a non-Navidrome Subsonic server may
        // answer with it.
        homepageUrl: s.homePageUrl ?? s.homepageUrl ?? undefined,
      }));
  } catch (error) {
    console.error('Navidrome getInternetRadioStations failed:', error);
    throw error;
  }
}

export async function createInternetRadioStation(
  client: NavidromeClient,
  input: { name: string; streamUrl: string; homepageUrl?: string }
): Promise<void> {
  await client.request('createInternetRadioStation.view', {
    name: input.name,
    streamUrl: input.streamUrl,
    ...(input.homepageUrl ? { homepageUrl: input.homepageUrl } : {}),
  });
}

export async function updateInternetRadioStation(
  client: NavidromeClient,
  input: { id: string; name: string; streamUrl: string; homepageUrl?: string }
): Promise<void> {
  // `homepageUrl` is always sent, empty string included. The server replaces
  // the whole station record from this call, so leaving the parameter out is
  // indistinguishable from clearing it — sending it explicitly is what makes
  // "remove the homepage" an intent the server is actually told about, rather
  // than a side effect of an omitted parameter.
  await client.request('updateInternetRadioStation.view', {
    id: input.id,
    name: input.name,
    streamUrl: input.streamUrl,
    homepageUrl: input.homepageUrl ?? '',
  });
}

export async function deleteInternetRadioStation(
  client: NavidromeClient,
  id: string
): Promise<void> {
  await client.request('deleteInternetRadioStation.view', { id });
}
