import type { Song } from "@/domain/entities/Song";
import type { Provenance } from "@/domain/identity/Provenance";
import type { NavidromeClient } from "../client";
import { mapSong } from "../mapSong";
import { SubsonicResponse } from "../types";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

export async function getSimilarSongs(
  client: NavidromeClient,
  provenance: Provenance,
  id: string,
  count = 50
): Promise<Song[]> {
  try {
    const raw = await client.request<SubsonicResponse>("getSimilarSongs.view", { id, count });
    const similar = raw?.["subsonic-response"]?.similarSongs?.song ?? [];
    if (!Array.isArray(similar)) return [];

    return similar
      .filter((s): s is typeof s & { id: string } => !!s?.id)
      .map((s) => mapSong(s, { provenance }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getSimilarSongs', detail: detailOf(error) });
    throw error;
  }
}
