import type { CoverSource } from '@/domain/entities/Cover';
import type { LocalId } from '../identity/LocalId';
import type { EntityCore } from './EntityCore';
import type { ArtistRef } from './EntityRef';

/** What an album release is, where the origin says. */
export type ReleaseType = 'album' | 'single' | 'ep' | 'compilation';

/**
 * One album.
 *
 * Songs are referenced, not embedded: an album's track list is separately
 * loaded, and an album that browses fine without it should not have to fetch
 * it. `songIds` is empty until the tracks have been loaded, which is a
 * different statement from an album that genuinely has none — callers that
 * care ask the song repository rather than inferring it from length.
 */
export interface Album extends EntityCore {
  title: string;
  cover: CoverSource;
  artist: ArtistRef;
  /** Release year, where the origin reports one. */
  year?: number;
  /** Full release date as reported, where finer than a year. */
  releaseDate?: string;
  releaseType: ReleaseType;
  genres: string[];
  /**
   * Mood tags the origin reports, where it reports any.
   *
   * The listener's own tags, read and shown as they are — not inferred. A
   * server that says nothing about mood is absent here rather than empty,
   * the same distinction every other optional origin-reported field draws:
   * "this library is not mood-tagged" and "this album has no moods" are
   * different facts, and a browse surface that offers mood as a way in should
   * only offer it to a library that actually carries them.
   */
  moods?: string[];
  /** When this arrived in the library, unix ms. Server-originated records only. */
  addedAt?: number;
  /**
   * Plays the origin has recorded for this album, where it reports them.
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
   * How many tracks the origin says it has, where it says.
   *
   * Travels separately from `songIds` for the reason that array's own comment
   * gives: its length is what has been *loaded*, which is zero for an album
   * nobody has opened yet. The server reports the real number in every album
   * listing and we were dropping it, so the album header showed "0 songs" and
   * a runtime of 0:00 until the track list resolved.
   */
  songCount?: number;
  /** Total running time in seconds, where the origin reports it. */
  durationSeconds?: number;
  /** Tracks that have been loaded, in running order, as references. */
  songIds: LocalId[];
}

/**
 * How many songs an album has, for a surface that wants to say so.
 *
 * The origin's own count where it gave one, else what has been loaded — the
 * same rule, and the same reasoning, as `playlistSongCount`.
 */
export function albumSongCount(album: Album): number {
  return album.songCount ?? album.songIds.length;
}
