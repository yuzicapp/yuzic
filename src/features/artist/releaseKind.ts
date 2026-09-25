import type { Album } from '@/domain/entities/Album';

/**
 * Splits an artist's releases between the Albums and the Singles & EPs
 * sections.
 *
 * The server's own answer first. OpenSubsonic reports `releaseTypes` on an
 * album, and a server that says "Single" or "EP" has told us something no
 * amount of counting can improve on — it read the release's MusicBrainz type,
 * where we would be inferring one.
 *
 * Everything below is the fallback for the servers and releases that say
 * nothing: track count where the library knows one, and the title where it
 * doesn't, because a release whose tracks haven't been indexed reports zero
 * rather than admitting it doesn't know.
 */

/** At most this many tracks reads as a single or an EP rather than an album. */
export const SINGLE_OR_EP_MAX_TRACKS = 6;

/**
 * "ep" or "single" as whole words.
 *
 * A plain substring test mis-files real albums: " ep" matches "The Epic", and
 * "single" matches "Singles Collection" — a compilation, not a single. It also
 * missed a release titled just "EP", which has no leading space.
 */
const SINGLE_OR_EP_TITLE = /\b(ep|single)\b/;

export function isSingleOrEpTitle(title: string): boolean {
  return SINGLE_OR_EP_TITLE.test(title.toLowerCase());
}

/**
 * @param songCount tracks the library knows about; zero means unknown, not
 * empty, so it falls through to the title rather than counting as a single.
 */
export function isSingleOrEp(album: Album, songCount: number): boolean {
  // A reported 'single' or 'ep' settles it, and so does a reported
  // 'compilation' — a compilation belongs with the albums however few tracks
  // it happens to carry. Only 'album' falls through, because that is both what
  // a server reports for an album and what every provider that knows nothing
  // about release types defaults to; the two are indistinguishable here, so
  // the guess below still has to run for them.
  if (album.releaseType === 'single' || album.releaseType === 'ep') return true;
  if (album.releaseType === 'compilation') return false;

  if (songCount > 0) return songCount <= SINGLE_OR_EP_MAX_TRACKS;
  return isSingleOrEpTitle(album.title);
}
