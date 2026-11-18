import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import type { ServerPlayQueue } from '@/providers/contracts/ServerAdapter';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * The user's cross-device play queue on the server. Subsonic stores one queue
 * per user — playing on a different device replaces it, playing on this device
 * saves back to it. yuzic uses this as a "resume on any device" surface, not
 * as the source of truth mid-session (that stays local).
 */
export async function getPlayQueue(client: NavidromeClient): Promise<ServerPlayQueue | null> {
  try {
    const raw = await client.request<SubsonicResponse>('getPlayQueue.view', {});
    const pq = raw?.['subsonic-response']?.playQueue;
    if (!pq) return null;
    const entries = pq.entry;
    if (!Array.isArray(entries) || entries.length === 0) return null;
    return {
      currentSongId: pq.current ?? undefined,
      positionMs: typeof pq.position === 'number' ? pq.position : undefined,
      changed: pq.changed ?? undefined,
      changedBy: pq.changedBy ?? undefined,
      songIds: entries
        .map((e) => e?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    };
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getPlayQueue', detail: detailOf(error) });
    throw error;
  }
}

/**
 * Overwrites the server's queue with the given song ids. Subsonic spec calls
 * for repeated `id` params; the shared client's request layer flattens
 * duplicates through URLSearchParams so we use the same pattern as jukebox
 * setPlaylist: first id under `id`, the rest comma-joined under `ids`.
 * Navidrome accepts either form.
 */
export async function savePlayQueue(
  client: NavidromeClient,
  input: { songIds: string[]; currentSongId?: string; positionMs?: number }
): Promise<void> {
  const [first, ...rest] = input.songIds;
  const extra: Record<string, string | number> = {};
  if (first) extra.id = first;
  if (rest.length) extra.ids = rest.join(',');
  if (input.currentSongId) extra.current = input.currentSongId;
  if (typeof input.positionMs === 'number') {
    extra.position = String(Math.floor(input.positionMs));
  }
  await client.request('savePlayQueue.view', extra, { method: 'POST' });
}
