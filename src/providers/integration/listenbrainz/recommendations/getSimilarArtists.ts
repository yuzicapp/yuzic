import { fetchWithTimeout } from '@/providers/http/fetchWithTimeout';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

type LBSimilarArtist = {
  artistMbid: string;
  name: string;
  score: number;
  /** MusicBrainz's disambiguation line ("Slovenian electro hip-hop artist"),
   * when there is one. The only description the endpoint offers. */
  comment?: string;
};

/**
 * Similar artists from ListenBrainz's session-based algorithm. Public — no
 * auth — and keyed by MBID rather than by user, so it works for any artist we
 * can look up.
 *
 * This lives on the labs host, not the main API: `api.listenbrainz.org/1/
 * similar-artists` redirects and then 404s, which the caller couldn't tell
 * apart from an artist with no similar artists, so the shelf on Home was
 * silently empty for everyone rather than failing where anyone would see it.
 *
 * The labs endpoint has no count parameter; it returns the algorithm's full
 * list and the caller takes the top of it.
 */
export async function getLBSimilarArtists(
  artistMbid: string,
  limit = 12
): Promise<LBSimilarArtist[]> {
  if (!artistMbid) return [];
  try {
    const url =
      `https://labs.api.listenbrainz.org/similar-artists/json` +
      `?artist_mbids=${encodeURIComponent(artistMbid)}` +
      `&algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30`;
    const res = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      artist_mbid?: string;
      name?: string;
      score?: number;
      comment?: string;
    }[];
    return (Array.isArray(data) ? data : [])
      .filter((r): r is { artist_mbid: string; name: string; score?: number; comment?: string } =>
        typeof r?.artist_mbid === 'string' && typeof r?.name === 'string'
      )
      // The seed comes back in its own results on some algorithms; a shelf of
      // artists like X should not lead with X.
      .filter((r) => r.artist_mbid !== artistMbid)
      .slice(0, limit)
      .map((r) => ({
        artistMbid: r.artist_mbid,
        name: r.name,
        score: Number(r.score ?? 0),
        comment: r.comment?.trim() || undefined,
      }));
  } catch (error) {
    log.integration.error('request failed', { provider: 'listenbrainz', operation: 'getSimilarArtists', detail: detailOf(error) });
    throw error;
  }
}
