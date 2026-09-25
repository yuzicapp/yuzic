import type { MediaItem } from '../player/mediaItem';
import type { RequestHeaders } from '../player/mediaHeaders';
import type { PlayableResource } from '@/features/playback/playableResource';
import { toEngineBoundaryTrack } from '@/features/playback/engineBoundary';
import { isContinuous } from '@/domain/playback/ContentKind';

/**
 * `extra` carries the ephemeral request headers a protected server needs — a
 * Plex behind a Basic-auth proxy — resolved by the caller against the active
 * server (see `mediaHeadersForSong`). Kept a parameter rather than read from
 * the store here so the builder stays pure and every playback consumer routes
 * headers through the same resolution point. Fields are set only when present,
 * so an unprotected server produces exactly the item it did before.
 *
 * The conversion itself — URI, headers, artwork, duration, identity — is
 * `engineBoundary`'s; this only reshapes that into `MediaItem`'s own field
 * names, which is the one thing that is genuinely specific to the phone
 * queue and lock screen.
 */
export function buildTrackItem(resource: PlayableResource, extra?: RequestHeaders): MediaItem {
  const track = toEngineBoundaryTrack(resource, extra);
  return {
    // Identity, not the origin's id: this is what the native player echoes
    // back, and `resourceFromPlayerItem` parses it to rebuild a track the app
    // has lost sight of.
    mediaId: track.id,
    title: track.title,
    artist: track.artist,
    albumTitle: track.album,
    duration: track.durationSec,
    url: track.uri.startsWith('file://') ? { uri: track.uri } : track.uri,
    artworkUrl: track.artworkUri,
    ...(isContinuous(track.contentKind) ? { continuous: true } : {}),
    ...(track.headers ? { headers: track.headers } : {}),
    ...(track.artworkHeaders ? { artworkHeaders: track.artworkHeaders } : {}),
    ...(track.loudness ? { loudness: track.loudness } : {}),
  };
}
