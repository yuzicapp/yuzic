import type { Song } from "@/domain/entities/Song";
import { requireProvenance, type MediaBrowserClient } from "../client";
import { mapSong } from "../mapSong";
import { MediaBrowserItemsResponse } from "../types";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

export async function getSong(
  client: MediaBrowserClient,
  songId: string
): Promise<Song | null> {
  try {
    const path =
      `/Users/${client.userId}/Items` +
      `?Ids=${encodeURIComponent(songId)}` +
      `&Fields=RunTimeTicks,ArtistItems,AlbumId,MediaSources,Genres,PremiereDate,DateCreated`;

    const raw = await client.request<MediaBrowserItemsResponse>(path);
    const dto = raw?.Items?.[0];
    if (!dto || dto.Type !== "Audio") return null;

    return mapSong(dto, { provenance: requireProvenance(client), brand: client.brand });
  } catch (error) {
    log.server.error('request failed', { provider: client.brand.label, operation: 'getSong', detail: detailOf(error) });
    throw error;
  }
}
