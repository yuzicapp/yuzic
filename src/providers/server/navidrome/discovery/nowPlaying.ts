import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import type { NowPlayingEntry } from '@/providers/contracts/ServerAdapter';
import type { CoverSource } from '@/domain/entities/Cover';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Users currently listening on this server. Small servers with a single user
 * mostly return this user; multi-user Navidromes return everyone active.
 */
export async function getNowPlaying(client: NavidromeClient): Promise<NowPlayingEntry[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getNowPlaying.view', {});
    const entries = raw?.['subsonic-response']?.nowPlaying?.entry ?? [];
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((e): e is typeof e & { id: string; username: string } => !!e?.id && !!e?.username)
      .map((e) => ({
        songId: e.id,
        title: e.title ?? 'Unknown',
        artist: e.artist ?? 'Unknown Artist',
        albumTitle: e.album ?? undefined,
        albumId: e.albumId ?? undefined,
        cover: e.coverArt
          ? ({ kind: 'navidrome', coverArtId: e.coverArt } as CoverSource)
          : ({ kind: 'none' } as CoverSource),
        username: e.username,
        minutesAgo: typeof e.minutesAgo === 'number' ? e.minutesAgo : undefined,
      }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getNowPlaying', detail: detailOf(error) });
    throw error;
  }
}
