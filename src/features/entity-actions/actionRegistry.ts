/**
 * The full entity-action registry, aggregated for discovery and testing.
 *
 * There is no single unified context type across all six lists — a song's
 * context is not shape-compatible with a playlist's — so this does not try
 * to force one `ActionDef<AnyContext>[]`. Each list stays typed against its
 * own context (see `registry/*.ts`); `useEntityActions.ts` resolves each
 * against its matching context. This file exists so the whole action surface
 * can be enumerated in one place — every action, which entity kind/origin
 * declares it — without hunting through six files.
 */
import { songLibraryActions } from './registry/songLibraryActions';
import { songExternalActions } from './registry/songExternalActions';
import { albumLibraryActions } from './registry/albumLibraryActions';
import { albumExternalActions } from './registry/albumExternalActions';
import { artistActions } from './registry/artistActions';
import { artistExternalActions } from './registry/artistExternalActions';
import { playlistActions } from './registry/playlistActions';

export { songLibraryActions } from './registry/songLibraryActions';
export type { SongLibraryActionContext } from './registry/songLibraryActions';
export { songExternalActions } from './registry/songExternalActions';
export type { SongExternalActionContext } from './registry/songExternalActions';
export { albumLibraryActions } from './registry/albumLibraryActions';
export type { AlbumLibraryActionContext } from './registry/albumLibraryActions';
export { albumExternalActions } from './registry/albumExternalActions';
export type { AlbumExternalActionContext } from './registry/albumExternalActions';
export { artistActions } from './registry/artistActions';
export type { ArtistActionContext } from './registry/artistActions';
export { artistExternalActions } from './registry/artistExternalActions';
export type { ArtistExternalActionContext } from './registry/artistExternalActions';
export { playlistActions } from './registry/playlistActions';
export type { PlaylistActionContext } from './registry/playlistActions';

/** `{kind}.{origin}` (or bare `{kind}` for the no-origin kinds) -> action ids, in declared order. */
export const actionRegistrySummary = {
  'song.library': songLibraryActions.map(a => a.id),
  'song.external': songExternalActions.map(a => a.id),
  'album.library': albumLibraryActions.map(a => a.id),
  'album.external': albumExternalActions.map(a => a.id),
  /** Bare `artist` is the library set; a browsed artist has its own short list. */
  artist: artistActions.map(a => a.id),
  'artist.external': artistExternalActions.map(a => a.id),
  playlist: playlistActions.map(a => a.id),
} as const;
