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
 * Overwrites the server's queue with the given song ids. Subsonic takes the
 * queue as repeated `id` params, one per song, and the client's request layer
 * repeats a key for an array value. Navidrome reads nothing else: an `id` plus
 * a comma-joined `ids` (the jukebox `set` shape) kept only the first song, so
 * the queue on the server was always a single track.
 */
export async function savePlayQueue(
  client: NavidromeClient,
  input: { songIds: string[]; currentSongId?: string; positionMs?: number }
): Promise<void> {
  // The array is the whole queue, in order: one `id` per song, not the first
  // song under `id` and the others under a second key.
  const params: Record<string, string | readonly string[]> = { id: input.songIds };
  // Navidrome looks `current` up among the ids and falls back to the first song
  // when it is not there, so it has to be one of the ids above.
  if (input.currentSongId) params.current = input.currentSongId;
  // `position` is whole milliseconds. A position of 0 is still sent: the check
  // is on the type, not on truthiness, or a restart at 0:00 would be dropped.
  if (typeof input.positionMs === 'number') {
    params.position = String(Math.floor(input.positionMs));
  }
  await client.request('savePlayQueue.view', params, { method: 'POST' });
}
