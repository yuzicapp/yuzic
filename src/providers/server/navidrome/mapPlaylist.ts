/**
 * Subsonic playlist DTO -> domain Playlist.
 *
 * Playlists get the same identity and provenance contract as every other
 * entity. They previously had neither, which is why a server playlist and a
 * generated one were indistinguishable once both were on screen.
 */
import type { Playlist } from '@/domain/entities/Playlist';
import { makeLocalId } from '@/domain/identity/LocalId';
import type { LocalId } from '@/domain/identity/LocalId';
import type { Provenance } from '@/domain/identity/Provenance';
import type { CoverSource } from '@/domain/entities/Cover';
import type { SubsonicPlaylist } from './types';

interface MapPlaylistContext {
  provenance: Provenance;
  /** Ids of the playlist's tracks, in playlist order, where they were mapped. */
  songIds?: LocalId[];
  /** The signed-in account, to tell its playlists from other accounts' public ones. */
  username?: string;
}

/** Owned unless the server names a different owner; usernames ignore case on Navidrome. */
function ownedBy(owner: string | undefined, username: string | undefined): boolean {
  if (!owner || !username) return true;
  return owner.toLowerCase() === username.toLowerCase();
}

export function mapPlaylist(dto: SubsonicPlaylist, context: MapPlaylistContext): Playlist {
  const { provenance } = context;
  const nativeId = dto.id ?? '';
  const cover: CoverSource = dto.coverArt
    ? { kind: 'navidrome', coverArtId: dto.coverArt }
    : { kind: 'none' };

  return {
    localId: makeLocalId('playlist', provenance, nativeId),
    nativeId,
    provenance,
    externalIds: {},
    title: dto.name ?? 'Untitled playlist',
    cover,
    description: dto.comment,
    // Navidrome lists the caller's own playlists and other accounts' public
    // ones; only the owner may edit, so the others must not offer to.
    isOwned: ownedBy(dto.owner, context.username),
    // Where the server states it, believe it: `readonly` is the fact `ownedBy`
    // approximates, and it is the only thing that can describe a playlist
    // shared *with* edit rights, which owner-matching reads as someone else's.
    canEdit: typeof dto.readonly === 'boolean' ? !dto.readonly : undefined,
    createdAt: dto.created ? Date.parse(dto.created) || undefined : undefined,
    updatedAt: dto.changed ? Date.parse(dto.changed) || undefined : undefined,
    songIds: context.songIds ?? [],
    // `getPlaylists` maps no tracks, but it does report how many there are.
    songCount: dto.songCount,
  };
}
