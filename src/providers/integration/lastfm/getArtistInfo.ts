import { lastfmRequest } from './client';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

type LastFmArtistInfo = {
  bio: string | null;
  tags: string[];
};

// artist.getinfo is a public read like artist.getsimilar — no session or
// api_sig needed, just the bundled api_key. Used for display-only bio/tag
// gap-filling (see features/metadata) — never written back to any server.
export async function getLastFmArtistInfo(
  apiKey: string,
  artistName: string
): Promise<LastFmArtistInfo | null> {
  if (!apiKey || !artistName.trim()) return null;
  try {
    const data = await lastfmRequest<{
      artist?: {
        bio?: { summary?: string; content?: string };
        tags?: { tag?: { name?: string }[] };
      };
    }>(
      {
        method: 'artist.getinfo',
        artist: artistName,
        autocorrect: '1',
      },
      { apiKey }
    );

    const artist = data.artist;
    if (!artist) return null;

    // Last.fm's summary carries an embedded "Read more on Last.fm" link;
    // strip the trailing <a href=...>...</a> so the bio reads as plain text.
    const rawBio = artist.bio?.summary ?? artist.bio?.content ?? '';
    const bio = rawBio.replace(/<a\s+href="[^"]*">[^<]*<\/a>/gi, '').trim();

    const tags = (artist.tags?.tag ?? [])
      .map(tag => tag.name?.trim())
      .filter((name): name is string => !!name);

    if (!bio && tags.length === 0) return null;

    return {
      bio: bio || null,
      tags,
    };
  } catch (error) {
    log.integration.error('request failed', { provider: 'lastfm', operation: 'getArtistInfo', detail: detailOf(error) });
    throw error;
  }
}
