import type { Song } from "@/domain/entities/Song";
import type { Provenance } from "@/domain/identity/Provenance";
import type { NavidromeClient } from "../client";
import { mapSong } from "../mapSong";
import { SubsonicResponse } from "../types";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

export async function getSong(
  client: NavidromeClient,
  songId: string,
  provenance: Provenance
): Promise<Song | null> {
  try {
    const raw = await client.request<SubsonicResponse>("getSong.view", { id: songId });
    const s = raw?.["subsonic-response"]?.song;
    if (!s?.id) return null;

    return mapSong(s, { provenance });
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getSong', detail: detailOf(error) });
    throw error;
  }
}
