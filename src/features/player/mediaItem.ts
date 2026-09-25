import type { Loudness } from '@/domain/entities/Loudness';
/**
 * What the app calls a playable item.
 *
 * This used to be `@rntp/player`'s `MediaItem`, imported into a dozen files
 * that had no other reason to know a player library existed — builders,
 * selectors, a Redux slice. Owning it here is what let that library be removed
 * without touching any of them beyond the import line.
 *
 * Deliberately smaller than the type it replaces. It carries the eight fields
 * this app actually sets, and none of the ones it never did: no `extras`, no
 * `isLive`, no bundle-relative asset forms. A field nobody writes is a field
 * that silently stops being populated, and the type should not promise one.
 *
 * `url` keeps the two forms the app actually produces and drops the rest —
 * no require()-style asset numbers or bundle-relative names, since every URL
 * here is a server URL or a local file path resolved at runtime.
 */
type MediaUrl = string | { uri: string };

export interface MediaItem {
  /**
   * Stable identity, used to match a playing item back to a library track.
   * Distinct from `url`: stream URLs carry a quality parameter and a token,
   * so the same track has different URLs at different times and the URL
   * cannot stand in for identity.
   */
  mediaId?: string;
  /**
   * A bare string for remote streams; `{ uri }` for local files. Both forms
   * are in use — `buildTrackItem` wraps `file://` and leaves http alone — so
   * read it through `getMediaItemUrl` rather than assuming either.
   */
  url: MediaUrl;
  title?: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
  /** Seconds. A hint for the UI, not authoritative — the engine measures it. */
  duration?: number;
  /**
   * A live stream with no end — internet radio. Passed to the engine as
   * `Track.continuous`, which reads it with a stream parser; without it the
   * engine's file parser waits for the end of a broadcast and no station
   * starts. Set from `contentKind` in `buildTrackItem`, and only when true.
   */
  continuous?: boolean;
  /**
   * Set when the URL has no file extension to identify the format by. Bare
   * stream endpoints are the case that needs it.
   */
  mimeType?: string;
  /**
   * Request headers sent with the *audio* fetch, for a server that
   * authenticates a stream by header rather than by signing the URL — a Plex
   * behind a Basic-auth reverse proxy is the concrete case. Ephemeral by
   * design: attached at playback-resolution time, never persisted on a Song,
   * a queue snapshot or a cache key, and kept out of the URL query string.
   */
  headers?: Record<string, string>;
  /**
   * The same idea for the *artwork* fetch. A separate field because the engine
   * fetches cover art independently of the stream and wires them to two
   * distinct `Track` fields; for Plex Basic auth both carry the same
   * Authorization header.
   */
  artworkHeaders?: Record<string, string>;
  /**
   * What the origin measured about the track's loudness. Unlike the headers
   * above this is not ephemeral — it is a property of the recording, and the
   * engine needs it on every queue item to level one track against the next.
   */
  loudness?: Loudness;
}
