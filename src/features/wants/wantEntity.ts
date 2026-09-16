/**
 * A want, back in the shape the rest of the app speaks.
 *
 * A want is saved rather than held: the browsed record it came from is long
 * gone by the time its row is drawn. Everything the row then wants to do —
 * open the catalogue screen for it, hand it to a downloader — is expressed in
 * terms of an `Album` or an `Artist`, so this rebuilds one from what the want
 * stored.
 *
 * Nothing is invented. Identity comes back out of the want's own `localId`
 * via `parseLocalId` — that id was derived from the record's provenance and
 * native id when it was saved, and is exactly those two facts in a readable
 * string — so the rebuilt record points at the same catalogue entry the want
 * was made from, rather than at a guess made from its title.
 *
 * These are honest records, not stand-ins: `libraryState: 'external'` is
 * true of anything on this screen (something in the library is not a want any
 * more, and the arrival watcher removes it), and the cover is the one the
 * want saved, so the one picture rule resolves it identically here.
 */
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import { makeLocalId, parseLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance, type Provenance } from '@/domain/identity/Provenance';
import { normalizeExternalIds } from '@/domain/identity/ExternalIds';
import { artistCoverSubject, missingCover } from '@/domain/entities/Cover';
import type { Want } from '@/state/redux/slices/wantsSlice';

/**
 * Where the want's record came from, and what it was called there.
 *
 * A want saved before ids were parseable, or one typed in by hand, has no
 * origin to recover — it falls back to a name-only identity, which is enough
 * for a downloader that searches by name and honest about carrying no id.
 */
function identityOf(want: Want): { provenance: Provenance; nativeId: string } {
  const parsed = parseLocalId(want.localId);
  if (parsed) return { provenance: parsed.provenance, nativeId: parsed.nativeId };
  return { provenance: integrationProvenance('unknown'), nativeId: want.localId };
}

/** The album an album or track want stands for. */
export function wantAlbum(want: Want): Album {
  const { provenance, nativeId } = identityOf(want);
  const externalIds = normalizeExternalIds(want.externalIds);
  return {
    localId: want.localId,
    nativeId,
    provenance,
    externalIds,
    libraryState: 'external',
    title: want.title,
    cover: want.cover ?? { kind: 'none' },
    artist: {
      localId: makeLocalId('artist', provenance, `want-artist:${nativeId}`),
      nativeId: `want-artist:${nativeId}`,
      externalIds: {},
      name: want.artist,
      cover: missingCover(artistCoverSubject(want.artist)),
    },
    releaseType: 'album',
    genres: [],
    songIds: [],
  };
}

/** The artist an artist want stands for. */
export function wantArtist(want: Want): Artist {
  const { provenance, nativeId } = identityOf(want);
  const name = want.artist || want.title;
  return {
    localId: want.localId,
    nativeId,
    provenance,
    externalIds: normalizeExternalIds(want.externalIds),
    libraryState: 'external',
    name,
    cover: want.cover ?? missingCover(artistCoverSubject(name)),
    tags: [],
    albumIds: [],
  };
}

/** The single track a track want asks a downloader for. */
export const wantTrack = (want: Want): { title: string; artist: string } => ({
  title: want.title,
  artist: want.artist,
});
