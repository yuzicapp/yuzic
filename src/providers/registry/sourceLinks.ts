/**
 * The page an external record came from, on the source's own website.
 *
 * A browsed album or artist has no server link to share — `shares` creates a
 * link to something on *your* server, and an external record is by definition
 * not on it — but every source it can come from does address the record with a
 * stable public URL. That is what an external screen's Share and "Open in …"
 * offer, so the two actions there mean the same thing they mean everywhere
 * else rather than being quietly absent.
 *
 * Derived from ids rather than stored: a mapper that kept a `link` field would
 * have to keep it per source, and an id the record already carries says the
 * same thing. Null when nothing identifies the record publicly — the actions
 * are then not offered at all, instead of opening a guess.
 *
 * Lives with the other provider declarations because naming a source, and
 * knowing the shape of its pages, is what this layer is for — feature code
 * asks for a link and never learns which company answered.
 */
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import type { Provenance } from '@/domain/identity/Provenance';

/** The source ids that have a public web address per entity. */
type WebSourceId = 'deezer' | 'musicbrainz';

const SOURCE_LABEL: Record<WebSourceId, string> = {
  deezer: 'settings.sources.deezer.name',
  musicbrainz: 'settings.sources.musicbrainz.name',
};

type WebLink = {
  source: WebSourceId;
  /** i18n key naming the source, for "Open in {{source}}". */
  sourceNameKey: string;
  url: string;
};

const link = (source: WebSourceId, url: string): WebLink => ({
  source,
  sourceNameKey: SOURCE_LABEL[source],
  url,
});

/** The provider a record was browsed through, where it is one with a website. */
function browsedThrough(provenance: Provenance): WebSourceId | null {
  if (provenance.origin !== 'integration') return null;
  return provenance.providerId === 'deezer' || provenance.providerId === 'musicbrainz'
    ? provenance.providerId
    : null;
}

/**
 * Ordered candidates for one record: the source it was browsed through first
 * (that is the page the user is looking at), then any other id it carries.
 */
function resolve(
  provenance: Provenance,
  ids: ExternalIds,
  build: (source: WebSourceId, ids: ExternalIds) => string | null
): WebLink | null {
  const browsed = browsedThrough(provenance);
  const order: WebSourceId[] = browsed
    ? [browsed, ...(['deezer', 'musicbrainz'] as WebSourceId[]).filter(s => s !== browsed)]
    : ['deezer', 'musicbrainz'];

  for (const source of order) {
    const url = build(source, ids);
    if (url) return link(source, url);
  }
  return null;
}

export function albumWebLink(album: Album): WebLink | null {
  return resolve(album.provenance, album.externalIds, (source, ids) => {
    if (source === 'deezer') {
      return ids.deezerId ? `https://www.deezer.com/album/${ids.deezerId}` : null;
    }
    if (!ids.mbid) return null;
    // An album's MBID is a release or a release group, and MusicBrainz files
    // the two under different paths — `mbidType` is carried for exactly this
    // kind of question (Cover Art Archive asks it too).
    return ids.mbidType === 'release-group'
      ? `https://musicbrainz.org/release-group/${ids.mbid}`
      : `https://musicbrainz.org/release/${ids.mbid}`;
  });
}

export function artistWebLink(artist: Artist): WebLink | null {
  return resolve(artist.provenance, artist.externalIds, (source, ids) => {
    if (source === 'deezer') {
      return ids.deezerId ? `https://www.deezer.com/artist/${ids.deezerId}` : null;
    }
    return ids.mbid ? `https://musicbrainz.org/artist/${ids.mbid}` : null;
  });
}
