import type { CoverSource } from '@/domain/entities/Cover';
import type { ContentKind } from '../playback/ContentKind';
import type { EntityCore } from './EntityCore';
import type { Loudness } from './Loudness';
import type { AlbumRef, ArtistRef } from './EntityRef';

/** Technical detail about the file behind a song, where the origin reports it. */
interface AudioProperties {
  bitrateKbps?: number;
  sampleRateHz?: number;
  bitsPerSample?: number;
  mimeType?: string;
  /**
   * The file's path on the server, where it reports one.
   *
   * Distinct from a `PlayableResource`'s `filePath`, which names a downloaded
   * local copy and lives only for the session: this is what the origin says
   * about where the file sits in its own library, and it is shown in the
   * track's info sheet.
   */
  path?: string;
}

/**
 * One song.
 *
 * `durationSeconds` is a number, not a preformatted `'3:42'` string: a string
 * cannot be summed for an album runtime, compared against a sleep timer, or
 * localised, and every consumer that needed one of those had to parse it back.
 *
 * `contentKind` is required. A live stream, a podcast episode and a 30-second
 * preview are all carried by this type, and each of them breaks an assumption
 * the player would otherwise make — see {@link ContentKind}.
 */
export interface Song extends EntityCore {
  title: string;
  artist: ArtistRef;
  album: AlbumRef;
  cover: CoverSource;
  /** Length in seconds. Zero for content with no known duration. */
  durationSeconds: number;
  contentKind: ContentKind;
  /**
   * The id to build a stream from, where that is not `nativeId`.
   *
   * A podcast episode is keyed by a namespaced id of its own, while its
   * playable audio lives under a different id the server assigns only once it
   * has downloaded the episode. The entity carries that id rather than a
   * built URL: a credentialled URL is not safe to persist, and rebuilding one
   * later — for a resume shelf, an offline retry, a lock-screen handoff —
   * needs the id anyway.
   */
  streamId?: string;
  /** Beats per minute, where the origin reports it. */
  bpm?: number;
  discNumber?: number;
  trackNumber?: number;
  year?: number;
  /**
   * Full release date as reported, where the origin knows more than the year.
   *
   * Kept alongside `year` rather than replacing it: most servers report only a
   * year, and a date synthesised from one would claim a precision the origin
   * never stated.
   */
  releaseDate?: string;
  genres: string[];
  /**
   * Mood tags the origin reports, where it reports any. See `Album.moods` —
   * absent means the origin said nothing, not that the track has no mood.
   */
  moods?: string[];
  /** When this arrived in the library, unix ms. Server-originated records only. */
  addedAt?: number;
  /**
   * Plays the origin has recorded for this song, where it reports them.
   *
   * Server-reported rather than local: sync seeds the app's own stats from
   * these, so an install that has never played a track still knows what the
   * library has been listening to. Absent is distinct from zero — a server
   * that does not report play counts must not be read as reporting none.
   */
  serverPlayCount?: number;
  /** When the origin last recorded a play, unix ms. Same caveat as above. */
  serverLastPlayedAt?: number;
  /**
   * What the signed-in user rated this, out of five, where the origin holds
   * a rating and reports one.
   *
   * Absent is "the origin did not say" and zero is "not rated" — two states
   * a single number cannot carry, which is why this is optional rather than
   * defaulted. A server without ratings must not be read as one where the
   * user has rated nothing, or every list sorted by rating on it would be
   * a list of ties.
   */
  userRating?: number;
  /**
   * What the origin measured about this track's loudness, where it did.
   *
   * The engine has applied ReplayGain since it was written and nothing ever
   * gave it the figures — they arrive on every Subsonic song response and were
   * dropped on the floor. See {@link Loudness}.
   */
  loudness?: Loudness;
  audio?: AudioProperties;
}
