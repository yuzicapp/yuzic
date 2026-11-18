import type { MediaBrowserClient } from '../client';
import type { MediaBrowserItemsResponse } from '../types';
import type { Bookmark } from '@/providers/contracts/ServerAdapter';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Jellyfin/Emby don't have a dedicated bookmarks API, but they DO store a
 * per-user, per-item PlaybackPositionTicks — the exact same concept. It's
 * what powers their "Continue Watching" surface. Reading and writing this
 * gives yuzic the same cross-device resume story on mediaBrowser servers
 * that Subsonic's bookmarks give on Navidrome.
 *
 * Writing is already done: every /Sessions/Playing/Progress event we send
 * updates PlaybackPositionTicks server-side. So this module only covers
 * the read path, seeding the local map on connect.
 */

// Ticks are 100-nanosecond intervals, same as everywhere else in the
// mediaBrowser API surface. Converting to milliseconds is /10_000.
const TICKS_TO_MS = 10_000;

/**
 * Fetches every audio track the user has a non-zero playback position on.
 * One request via ItemFilters=IsResumable (Jellyfin's own "unfinished
 * things" filter) — the same request the "Continue Watching" row uses,
 * scoped to audio.
 */
export async function getBookmarksFromUserData(client: MediaBrowserClient): Promise<Bookmark[]> {
  try {
    const path =
      `/Users/${encodeURIComponent(client.userId)}/Items` +
      `?IncludeItemTypes=Audio` +
      `&Filters=IsResumable` +
      `&Recursive=true` +
      `&Fields=UserData` +
      `&Limit=200`;
    const res = await client.request<MediaBrowserItemsResponse>(path);
    const items = res?.Items ?? [];
    return items
      .filter((it): it is typeof it & { Id: string } => Boolean(it.Id))
      .map((it) => {
        const ticks = it.UserData?.PlaybackPositionTicks ?? 0;
        return ticks > 0
          ? { songId: it.Id, positionMs: Math.floor(ticks / TICKS_TO_MS) }
          : null;
      })
      .filter((b): b is Bookmark => b !== null);
  } catch (error) {
    log.server.error('request failed', { provider: 'media-browser', operation: 'readBookmarks', detail: detailOf(error) });
    throw error;
  }
}
