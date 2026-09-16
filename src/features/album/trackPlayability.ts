/**
 * The real preview-vs-full-playback distinction, typed as one decision per
 * track instead of two component types (`LocalAlbumBody`/`ExternalAlbumBody`
 * — deleted alongside this file's introduction).
 *
 * An album whose tracks can only be sampled is the same entity as one that
 * can be played in full; what differs is what the player can do with each
 * track. A library album's songs are always `full` — the server can stream
 * them outright. A browse-only album's songs are `preview` when a 30-second
 * clip could be resolved for them (`useExternalAlbumPreviews`) and
 * `unavailable` otherwise — nothing to tap at all.
 */
import type { Song } from '@/domain/entities/Song';

export type TrackPlayability =
  | { kind: 'full' }
  | { kind: 'preview'; streamId: string }
  | { kind: 'unavailable' };

/**
 * @param isLocal Whether the album is a library album (full server
 * playback) or a browse-only external one (preview-only, at best).
 * @param previewUrlsByNativeId External clip URLs, keyed by each song's
 * `nativeId` — only consulted when `isLocal` is false.
 */
export function resolveTrackPlayability(
  song: Song,
  isLocal: boolean,
  previewUrlsByNativeId: Readonly<Record<string, string>>
): TrackPlayability {
  if (isLocal) return { kind: 'full' };
  // Playability follows the *track*, not the album it was browsed on. A
  // browsed album's track that the library turns out to hold has been replaced
  // by the library's own record (features/library/localFirst), and the server
  // can stream that outright — sampling it instead would be the app choosing a
  // thirty-second clip over a recording the user already owns.
  if (song.provenance.origin === 'server') return { kind: 'full' };
  const streamId = previewUrlsByNativeId[song.nativeId];
  return streamId ? { kind: 'preview', streamId } : { kind: 'unavailable' };
}

/** Every song, decorated with its playability — the shape both a full
 *  library play queue and a preview-only play queue are built from. */
export function classifyTrackPlayability(
  songs: readonly Song[],
  isLocal: boolean,
  previewUrlsByNativeId: Readonly<Record<string, string>>
): Map<string, TrackPlayability> {
  const byId = new Map<string, TrackPlayability>();
  for (const song of songs) {
    byId.set(song.localId, resolveTrackPlayability(song, isLocal, previewUrlsByNativeId));
  }
  return byId;
}

/** Songs a player could actually do something with — full tracks as-is,
 *  preview tracks with their clip URL attached as `streamId` (the slot
 *  every adapter uses to carry "the id to build a stream from where that
 *  isn't `nativeId`" — see `Song.streamId`). Unavailable tracks are
 *  dropped: there is nothing to queue for them. */
export function playableSongs(
  songs: readonly Song[],
  playability: ReadonlyMap<string, TrackPlayability>
): Song[] {
  const result: Song[] = [];
  for (const song of songs) {
    const p = playability.get(song.localId);
    if (!p || p.kind === 'unavailable') continue;
    result.push(p.kind === 'preview' ? { ...song, streamId: p.streamId } : song);
  }
  return result;
}
