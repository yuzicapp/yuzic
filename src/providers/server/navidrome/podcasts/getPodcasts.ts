import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import type { PodcastChannel, PodcastEpisode } from '@/providers/contracts/ServerAdapter';
import type { CoverSource } from '@/domain/entities/Cover';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * A channel or episode cover. `coverArt` is a Subsonic image id the server
 * serves; `originalImageUrl` is the feed's own image, already a URL — handing
 * that to getCoverArt as an id drew nothing.
 */
function podcastCover(coverArt: string | undefined, originalImageUrl?: string): CoverSource {
  if (coverArt) return { kind: 'navidrome', coverArtId: coverArt };
  if (originalImageUrl) return { kind: 'url', url: originalImageUrl };
  return { kind: 'none' };
}

type RawEpisode = {
  id?: string;
  streamId?: string;
  channelId?: string;
  title?: string;
  description?: string;
  publishDate?: string;
  status?: string;
  duration?: number;
  coverArt?: string;
  contentType?: string;
  bitRate?: number;
  path?: string;
};

type RawChannel = {
  id?: string;
  url?: string;
  title?: string;
  description?: string;
  coverArt?: string;
  originalImageUrl?: string;
  status?: string;
  errorMessage?: string;
  episode?: RawEpisode[];
};

function normalizeEpisode(e: RawEpisode, channelId: string): PodcastEpisode | null {
  if (!e?.id) return null;
  const status = normalizeStatus(e.status);
  return {
    id: e.id,
    streamId: e.streamId ?? null,
    channelId: e.channelId ?? channelId,
    title: e.title ?? 'Untitled episode',
    description: e.description,
    publishDate: e.publishDate,
    status,
    playableStreamId: status === 'completed' ? e.streamId ?? null : null,
    durationSeconds: typeof e.duration === 'number' ? e.duration : undefined,
    cover: podcastCover(e.coverArt),
  };
}

function normalizeStatus(raw: string | undefined): PodcastEpisode['status'] {
  switch (raw) {
    case 'downloading':
    case 'completed':
    case 'skipped':
    case 'error':
      return raw;
    default:
      return 'new';
  }
}

export async function getPodcasts(
  client: NavidromeClient,
  opts: { includeEpisodes?: boolean } = {}
): Promise<PodcastChannel[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getPodcasts.view', {
      includeEpisodes: opts.includeEpisodes === false ? 'false' : 'true',
    });
    const channels = raw?.['subsonic-response']?.podcasts?.channel ?? [];
    if (!Array.isArray(channels)) return [];
    return channels
      .filter((c): c is RawChannel & { id: string } => !!c?.id)
      .map((c) => ({
        id: c.id,
        url: c.url ?? '',
        title: c.title ?? 'Untitled podcast',
        description: c.description,
        cover: podcastCover(c.coverArt, c.originalImageUrl),
        status: c.status ?? 'ok',
        errorMessage: c.errorMessage,
        episodes: (c.episode ?? [])
          .map((e) => normalizeEpisode(e, c.id))
          .filter((e): e is PodcastEpisode => e !== null),
      }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getPodcasts', detail: detailOf(error) });
    throw error;
  }
}

export async function getNewestPodcasts(
  client: NavidromeClient,
  count = 20
): Promise<PodcastEpisode[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getNewestPodcasts.view', { count });
    const items = raw?.['subsonic-response']?.newestPodcasts?.episode ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .map((e) => normalizeEpisode(e as RawEpisode, ''))
      .filter((e): e is PodcastEpisode => e !== null);
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getNewestPodcasts', detail: detailOf(error) });
    throw error;
  }
}

export async function createPodcastChannel(client: NavidromeClient, url: string): Promise<void> {
  await client.request('createPodcastChannel.view', { url });
}

export async function deletePodcastChannel(client: NavidromeClient, id: string): Promise<void> {
  await client.request('deletePodcastChannel.view', { id });
}

export async function deletePodcastEpisode(client: NavidromeClient, id: string): Promise<void> {
  await client.request('deletePodcastEpisode.view', { id });
}

export async function downloadPodcastEpisode(client: NavidromeClient, id: string): Promise<void> {
  await client.request('downloadPodcastEpisode.view', { id });
}

export async function refreshPodcasts(client: NavidromeClient): Promise<void> {
  await client.request('refreshPodcasts.view', {});
}
