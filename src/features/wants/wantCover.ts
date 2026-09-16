/**
 * The picture a want is saved with.
 *
 * A want is the one kind of row the app draws for something nobody's server
 * has, so there is no cover to look up later and no entity left in hand to
 * look it up from — the browsed record is gone the moment the sheet closes.
 * What is saved instead is the record's own cover, and where it had none, a
 * gap naming *who it is of*: `{ kind: 'none', subject }`.
 *
 * That subject is the whole point. `features/artwork/coverResolution`'s one
 * rule — the item's own source, then the library's copy, then the artwork
 * backups (Cover Art Archive by MBID, then Deezer) — is driven entirely by it,
 * and a `{ kind: 'none' }` carrying no subject is where that rule stops: there
 * is nobody to ask about. Wants drew the placeholder for exactly that reason,
 * and the fix belongs here, at the one place a want is born, rather than as a
 * lookup on the Wants screen.
 *
 * So this adds no resolution of its own. It only makes sure the cover a want
 * carries names its subject, using the same `Cover` helpers every provider
 * mapper uses, so a want row resolves identically to a shelf tile.
 */
import {
  albumCoverSubject,
  artistCoverSubject,
  coverOrMissing,
  type CoverSource,
} from '@/domain/entities/Cover';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import type { WantUnit } from '@/state/redux/slices/wantsSlice';

interface WantCoverInput {
  unit: WantUnit;
  /** The record's own cover, as its source gave it. */
  cover: CoverSource;
  /** The want's title — an album/track title, or the artist's name. */
  title: string;
  /** The credited artist. Equal to `title` for an artist want. */
  artist: string;
  externalIds?: ExternalIds;
}

/**
 * The cover to store on a want: the source's own picture where it has one,
 * otherwise a gap naming the subject for the backups to answer.
 *
 * An artist want is looked up as an artist and an album/track want as an
 * album, which is what each backup can actually answer — Cover Art Archive
 * has no picture of a person, and a track has no art of its own that is not
 * its album's.
 */
export function wantCover(input: WantCoverInput): CoverSource {
  const subject = input.unit === 'artist'
    ? artistCoverSubject(input.artist || input.title, input.externalIds)
    : albumCoverSubject(input.title, input.artist, input.externalIds);
  return coverOrMissing(input.cover, subject);
}
