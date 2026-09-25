/**
 * Subsonic album DTO -> domain Album.
 *
 * Two shapes arrive from Subsonic: the ID3 `album` object (titled `name`, may
 * carry its song list) and the `getAlbumList` entry (titled `title`, never
 * carries songs). Both map here, because a caller should not have to know
 * which endpoint an album came from to render it.
 */
import type { Album } from '@/domain/entities/Album';
import { makeLocalId } from '@/domain/identity/LocalId';
import type { LocalId } from '@/domain/identity/LocalId';
import type { Provenance } from '@/domain/identity/Provenance';
import { albumCoverSubject, missingCover, type CoverSource } from '@/domain/entities/Cover';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import { reportedRating } from '@/domain/entities/Rating';
import { artistRef } from './mapRefs';
import { releaseTypeOf } from './releaseType';
import { genresOf, moodsOf } from './tagLists';
import type { SubsonicAlbum, SubsonicAlbumListEntry } from './types';

type AnyAlbumDto = SubsonicAlbum | SubsonicAlbumListEntry;

const titleOf = (dto: AnyAlbumDto): string =>
  ('name' in dto ? dto.name : undefined) ?? ('title' in dto ? dto.title : undefined) ?? 'Unknown Album';

/**
 * Navidrome's album MBID is the release: its Subsonic layer reports the
 * album's `MbzAlbumID` (the "MusicBrainz Album Id" tag), not the release group.
 */
function externalIdsOf(dto: AnyAlbumDto): ExternalIds {
  return 'musicBrainzId' in dto && dto.musicBrainzId
    ? { mbid: dto.musicBrainzId, mbidType: 'release' }
    : {};
}

/**
 * The album's own cover, or a gap naming it. Shared by every endpoint that
 * maps an album, so its songs fall back to the same gap the album has.
 */
export function albumCoverOf(dto: AnyAlbumDto): CoverSource {
  return dto.coverArt
    ? { kind: 'navidrome', coverArtId: dto.coverArt }
    : missingCover(albumCoverSubject(titleOf(dto), dto.artist, externalIdsOf(dto)));
}

interface MapAlbumContext {
  provenance: Provenance;
  /**
   * The artist's own cover, where the caller already has it.
   *
   * Subsonic's album payload names the artist but carries no artwork for
   * them, and `{ kind: 'none' }` is not nullish — a consumer written as
   * `album.artist.cover ?? song.cover` does not fall through it, so an
   * unresolved ref renders as a broken image rather than a fallback. The one
   * caller that fetches the artist anyway passes it here.
   */
  artistCover?: CoverSource;
  /**
   * Ids of the album's tracks, in running order, where they have been mapped.
   * Passed in rather than derived here so that mapping an album never implies
   * mapping its songs.
   */
  songIds?: LocalId[];
}

export function mapAlbum(dto: AnyAlbumDto, context: MapAlbumContext): Album {
  const { provenance } = context;
  const nativeId = dto.id ?? '';
  return {
    localId: makeLocalId('album', provenance, nativeId),
    nativeId,
    provenance,
    externalIds: externalIdsOf(dto),
    title: titleOf(dto),
    cover: albumCoverOf(dto),
    artist: artistRef(provenance, dto.artistId, dto.artist, context.artistCover),
    year: dto.year,
    releaseType: releaseTypeOf(dto),
    genres: genresOf(dto),
    moods: moodsOf(dto),
    addedAt: dto.created ? Date.parse(dto.created) || undefined : undefined,
    // Both shapes report these — the comment here used to claim only the list
    // shape did, which the spec contradicts: `playCount` is base Subsonic on
    // AlbumID3 and `played` is an OpenSubsonic extension on it. Nothing was
    // actually lost, because `in` is a runtime test and the value arrives
    // whether or not the interface admitted it existed; the DTO now says so.
    serverPlayCount: dto.playCount,
    serverLastPlayedAt: dto.played ? Date.parse(dto.played) || undefined : undefined,
    songCount: dto.songCount,
    durationSeconds: dto.duration,
    userRating: reportedRating(dto.userRating),
    songIds: context.songIds ?? [],
  };
}
