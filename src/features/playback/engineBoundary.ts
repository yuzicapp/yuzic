/**
 * The one conversion from a `PlayableResource` to what the player consumes.
 *
 * Before this existed, "a song ready to hand to the engine" was built twice:
 * once in `buildTrackItem` for the phone queue and the lock screen, and once
 * again in `useCarPlayBrowseTree` for the browse tree CarPlay and Android Auto
 * read. The two happened to produce compatible-looking objects, which is worse
 * than producing incompatible ones — it hid that they disagreed. The browse
 * build only ever attached headers when it remembered to; the queue build
 * always did. A protected server behind Basic auth would stream fine from the
 * Now Playing screen and fail silently the moment the same track played from
 * CarPlay's Albums list, because the two paths were maintained by whoever
 * touched them last, not by one piece of code.
 *
 * This owns exactly the fields that matter to *playing the thing*: URI,
 * request headers, artwork URI and artwork headers, duration, identity and
 * content kind. `buildTrackItem` (phone queue / lock screen) and
 * `useCarPlayBrowseTree` (browse tree / vehicle surfaces) both build a
 * `PlayableResource` and hand it here; each then reshapes the result into its
 * own surface's field names (`MediaItem` or `BrowseItem`), but neither
 * decides on its own what a header or an artwork URI *is*.
 */
import type { ContentKind } from '@/domain/playback/ContentKind';
import type { Loudness } from '@/domain/entities/Loudness';
import { buildCover, isDrawnCover } from '@/providers/registry/covers';
import type { RequestHeaders } from '@/features/player/mediaHeaders';
import type { PlayableResource } from './playableResource';

/**
 * A remote URL, a `file://` URL, or a bare absolute path, normalized to
 * something every surface can open. Bare paths only come from a downloaded
 * local copy — see `PlayableResource.filePath` — so `file://` is the only
 * scheme this needs to add.
 */
/** An artwork URI the engine can actually fetch, or nothing. */
function drawnOrUrl(uri: string | null): string | undefined {
  return !uri || isDrawnCover(uri) ? undefined : uri;
}

function normalizeMediaUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (url.startsWith('/')) return `file://${url}`;
  return url;
}

/**
 * The fields every playback surface needs, independent of that surface's own
 * shape. `id` is the song's `localId`, not the origin's own id — the same
 * identity `resourceFromPlayerItem` parses back out of what the player
 * echoes, so a track recovered from the queue and one built fresh here agree
 * on what it is.
 */
interface EngineBoundaryTrack {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  album?: string;
  artworkUri?: string;
  /** Seconds. Absent, not zero, for an unknown duration. */
  durationSec?: number;
  contentKind: ContentKind;
  /** Ephemeral request headers for the audio fetch. */
  headers?: Record<string, string>;
  /** Ephemeral request headers for the artwork fetch. */
  artworkHeaders?: Record<string, string>;
  /**
   * What the origin measured about this track's loudness, carried through
   * unchosen: which figure gets applied is the listener's setting, and it is
   * read at the engine boundary so that changing it does not mean rebuilding
   * every queue item.
   */
  loudness?: Loudness;
}

/**
 * `extra` carries the ephemeral request headers a protected server needs — a
 * Plex behind a Basic-auth proxy — resolved by the caller against the active
 * server (see `mediaHeadersForSong`). Kept a parameter rather than read from
 * the store here so this stays pure and every playback consumer routes
 * headers through the same resolution point.
 */
export function toEngineBoundaryTrack(
  resource: PlayableResource,
  extra?: RequestHeaders
): EngineBoundaryTrack {
  const { song } = resource;
  const headers = extra?.headers;
  const artworkHeaders = extra?.artworkHeaders;
  return {
    id: song.localId,
    uri: normalizeMediaUrl(resource.streamUrl),
    title: song.title,
    artist: song.artist.name,
    album: song.album.title || undefined,
    // A drawn cover is a sentinel the app renders itself, not something the
    // engine could fetch — sent as an artwork URI it is a blank cover on the
    // lock screen and in the car, which is worse than none at all.
    artworkUri: drawnOrUrl(buildCover(song.cover, 'grid')),
    durationSec: song.durationSeconds || undefined,
    contentKind: song.contentKind,
    ...(headers ? { headers } : {}),
    ...(artworkHeaders ? { artworkHeaders } : {}),
    ...(song.loudness ? { loudness: song.loudness } : {}),
  };
}
