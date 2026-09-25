/**
 * Subsonic song DTO -> domain Song.
 *
 * No stream URL is produced here. A credentialled URL is not safe to persist
 * and goes stale with the session; the entity carries the id a stream can be
 * built from, and building one is the player boundary's job.
 */
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import type { Provenance } from '@/domain/identity/Provenance';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import { albumCoverSubject, missingCover, type CoverSource } from '@/domain/entities/Cover';
import { reportedRating } from '@/domain/entities/Rating';
import { albumRef, artistRef } from './mapRefs';
import { genresOf, loudnessOf, moodsOf } from './tagLists';
import type { SubsonicSong } from './types';
import { internCover } from '@/domain/entities/internRef';

function externalIdsOf(dto: SubsonicSong): ExternalIds {
  const ids: ExternalIds = {};
  if (dto.musicBrainzId) ids.mbid = dto.musicBrainzId;
  // Subsonic reports ISRCs as a list; a recording usually has one, and the
  // first is the one matching compares against.
  if (dto.isrc && dto.isrc.length > 0) ids.isrc = dto.isrc[0];
  return ids;
}

interface MapSongContext {
  provenance: Provenance;
  /** The cover to use where the song carries none of its own — usually the album's. */
  cover?: CoverSource;
  /** Album title, when mapping from an album payload that knows it. */
  albumTitle?: string;
  /** Album id, when the song DTO omits it. */
  albumId?: string;
}

export function mapSong(dto: SubsonicSong, context: MapSongContext): Song {
  const { provenance } = context;
  const nativeId = dto.id ?? '';
  const cover: CoverSource = internCover(dto.coverArt
    ? { kind: 'navidrome', coverArtId: dto.coverArt }
    : context.cover ?? missingCover(albumCoverSubject(dto.album ?? context.albumTitle, dto.artist)));

  return {
    localId: makeLocalId('song', provenance, nativeId),
    nativeId,
    provenance,
    externalIds: externalIdsOf(dto),
    title: dto.title ?? 'Unknown',
    artist: artistRef(provenance, dto.artistId, dto.artist),
    album: albumRef(provenance, dto.albumId ?? context.albumId, dto.album ?? context.albumTitle, cover),
    cover,
    durationSeconds: dto.duration ?? 0,
    // Everything reachable through the library's song endpoints is a song;
    // radio and podcast entries are mapped by their own endpoints.
    contentKind: 'song',
    bpm: dto.bpm,
    discNumber: dto.discNumber,
    trackNumber: dto.track,
    year: dto.year,
    genres: genresOf(dto),
    moods: moodsOf(dto),
    addedAt: dto.created ? Date.parse(dto.created) || undefined : undefined,
    serverPlayCount: dto.playCount,
    serverLastPlayedAt: dto.played ? Date.parse(dto.played) || undefined : undefined,
    userRating: reportedRating(dto.userRating),
    loudness: loudnessOf(dto),
    audio: {
      bitrateKbps: dto.bitRate,
      sampleRateHz: dto.samplingRate,
      bitsPerSample: dto.bitDepth,
      mimeType: dto.contentType,
      path: dto.path,
    },
  };
}
