import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import type { Bookmark } from '@/providers/contracts/ServerAdapter';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Subsonic bookmarks store a resume position (ms) per track, keyed by song
 * id — the natural fit for audiobooks, podcast episodes and long-form mixes
 * that a user pauses and doesn't come back to for hours.
 */
export async function getBookmarks(client: NavidromeClient): Promise<Bookmark[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getBookmarks.view', {});
    const rows = raw?.['subsonic-response']?.bookmarks?.bookmark ?? [];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((b): b is typeof b & { position: number; entry: { id: string } } =>
        typeof b?.position === 'number' && !!b?.entry?.id
      )
      .map((b) => ({
        songId: b.entry.id,
        positionMs: b.position,
        comment: b.comment ?? undefined,
        changed: b.changed ?? undefined,
      }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getBookmarks', detail: detailOf(error) });
    throw error;
  }
}

export async function createBookmark(
  client: NavidromeClient,
  input: { songId: string; positionMs: number; comment?: string }
): Promise<void> {
  await client.request('createBookmark.view', {
    id: input.songId,
    position: String(Math.floor(input.positionMs)),
    ...(input.comment ? { comment: input.comment } : {}),
  });
}

export async function deleteBookmark(client: NavidromeClient, songId: string): Promise<void> {
  await client.request('deleteBookmark.view', { id: songId });
}
