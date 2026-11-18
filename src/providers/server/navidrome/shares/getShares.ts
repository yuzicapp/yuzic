import type { NavidromeClient } from '../client';
import type { SubsonicResponse } from '../types';
import type { Share } from '@/providers/contracts/ServerAdapter';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * User-managed shares — Subsonic exposes public URLs to a track, album or
 * playlist. Navidrome hosts the share page; the URL is safe to send outside
 * the app.
 */
export async function getShares(client: NavidromeClient): Promise<Share[]> {
  try {
    const raw = await client.request<SubsonicResponse>('getShares.view', {});
    const shares = raw?.['subsonic-response']?.shares?.share ?? [];
    if (!Array.isArray(shares)) return [];
    return shares
      .filter((s): s is typeof s & { id: string; url: string } => !!s?.id && !!s?.url)
      .map((s) => ({
        id: s.id,
        url: s.url,
        description: s.description ?? undefined,
        created: s.created ?? undefined,
        expires: s.expires ?? undefined,
        visitCount: s.visitCount ?? undefined,
      }));
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getShares', detail: detailOf(error) });
    throw error;
  }
}

/**
 * Creates a shareable link for one item and returns its public URL. Expires
 * defaults to no expiry — Navidrome interprets a missing value as forever.
 */
export async function createShare(
  client: NavidromeClient,
  input: { itemId: string; description?: string; expiresAtMs?: number | null }
): Promise<Share | null> {
  try {
    const params: Record<string, string> = { id: input.itemId };
    if (input.description) params.description = input.description;
    if (input.expiresAtMs) params.expires = String(input.expiresAtMs);
    const raw = await client.request<SubsonicResponse>('createShare.view', params);
    const created = raw?.['subsonic-response']?.shares?.share?.[0];
    if (!created?.id || !created?.url) return null;
    return {
      id: created.id,
      url: created.url,
      description: created.description ?? undefined,
      created: created.created ?? undefined,
      expires: created.expires ?? undefined,
    };
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'createShare', detail: detailOf(error) });
    throw error;
  }
}

export async function deleteShare(client: NavidromeClient, id: string): Promise<void> {
  await client.request('deleteShare.view', { id });
}

export async function updateShare(
  client: NavidromeClient,
  input: { id: string; description?: string; expiresAtMs?: number | null }
): Promise<void> {
  const params: Record<string, string> = { id: input.id };
  if (input.description !== undefined) params.description = input.description;
  if (input.expiresAtMs !== undefined) params.expires = String(input.expiresAtMs ?? 0);
  await client.request('updateShare.view', params);
}
