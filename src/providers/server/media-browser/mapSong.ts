/**
 * MediaBrowser (Jellyfin/Emby) song DTO -> domain Song.
 *
 * No stream URL is produced here. A credentialled URL is not safe to persist
 * and goes stale with the session; the entity carries the id a stream can be
 * built from, and building one is the player boundary's job.
 */
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import type { Provenance } from '@/domain/identity/Provenance';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import { albumCoverSubject, coverOrMissing, missingCover, type CoverSource } from '@/domain/entities/Cover';
import { buildSongCover, type MediaBrowserBrand } from './brand';
import { normalizeGenres } from './utils/normalizeGenres';
import { albumRef, artistRef } from './mapRefs';
import type { MediaBrowserItem } from './types';
import type { Loudness } from '@/domain/entities/Loudness';
import { internCover } from '@/domain/entities/internRef';

/** MediaBrowser reports duration in 100ns ticks, not seconds. */
const TICKS_PER_SECOND = 10_000_000;

function externalIdsOf(dto: MediaBrowserItem): ExternalIds {
  const trackMbid = dto.ProviderIds?.MusicBrainzTrack;
  return trackMbid ? { mbid: trackMbid } : {};
}

/**
 * A song's own art, or a gap naming its album. Only a payload that says the
 * song has no image and its album has none either counts as a gap — Jellyfin
 * serves a song's art by its own id, which is not proof of anything alone.
 */
function songCover(
  dto: MediaBrowserItem,
  brand: MediaBrowserBrand,
  albumId: string | undefined,
  artistName: string | undefined,
  albumTitle: string | undefined
): CoverSource {
  const subject = albumCoverSubject(albumTitle, artistName);
  if (dto.ImageTags && !dto.ImageTags.Primary && !dto.AlbumPrimaryImageTag) return missingCover(subject);
  return coverOrMissing(buildSongCover(brand, dto.Id, albumId, dto.AlbumPrimaryImageTag), subject);
}

/**
 * What Jellyfin measured about this track's loudness (#314).
 *
 * `NormalizationGain` is Jellyfin's name for track gain in dB, and it arrives
 * on audio items unrequested — see {@link MediaBrowserItem}. Mapping it is
 * what makes loudness levelling and its preamp do anything here: the preamp
 * is added to a *measured* figure, so with nothing measured the slider moved
 * and the sound did not.
 *
 * Undefined rather than zero when the server says nothing, because the engine
 * reads an absent figure as "leave this track alone" and a zero as "this track
 * is already at reference loudness". No peak accompanies either figure, so the
 * engine's clipping guard has nothing to clamp against on Jellyfin; it handles
 * that by leaving the gain as asked.
 */
function loudnessOf(dto: MediaBrowserItem): Loudness | undefined {
  const loudness: Loudness = {};
  if (typeof dto.NormalizationGain === 'number') loudness.trackGainDb = dto.NormalizationGain;
  if (typeof dto.AlbumNormalizationGain === 'number') loudness.albumGainDb = dto.AlbumNormalizationGain;
  return Object.keys(loudness).length > 0 ? loudness : undefined;
}

interface MapSongContext {
  provenance: Provenance;
  brand: MediaBrowserBrand;
  /** The cover to use where the song carries none of its own — usually the album's. */
  cover?: CoverSource;
  /** Album title, when mapping from an album payload that knows it. */
  albumTitle?: string;
  /** Album id, when the song DTO omits it. */
  albumId?: string;
}

export function mapSong(dto: MediaBrowserItem, context: MapSongContext): Song {
  const { provenance, brand } = context;
  const nativeId = dto.Id ?? '';
  const albumId = dto.AlbumId ?? context.albumId;
  const artistItem = dto.ArtistItems?.[0];
  const cover = internCover(context.cover ?? songCover(dto, brand, albumId, artistItem?.Name ?? dto.AlbumArtist, context.albumTitle));
  const mediaSource = dto.MediaSources?.[0];
  const audioStream = mediaSource?.MediaStreams?.find(stream => stream.Type === 'Audio');
  const ticks = dto.RunTimeTicks ?? mediaSource?.RunTimeTicks ?? 0;

  return {
    localId: makeLocalId('song', provenance, nativeId),
    nativeId,
    provenance,
    externalIds: externalIdsOf(dto),
    title: dto.Name ?? 'Unknown',
    artist: artistRef(provenance, artistItem?.Id, artistItem?.Name ?? dto.AlbumArtist),
    album: albumRef(provenance, albumId, context.albumTitle, cover),
    cover,
    durationSeconds: Math.round(ticks / TICKS_PER_SECOND),
    // Everything reachable through the library's song endpoints is a song;
    // radio and podcast entries are mapped by their own endpoints.
    contentKind: 'song',
    discNumber: dto.ParentIndexNumber,
    trackNumber: dto.IndexNumber,
    year: dto.ProductionYear,
    releaseDate: dto.PremiereDate,
    genres: normalizeGenres(dto.Genres) ?? [],
    addedAt: dto.DateCreated ? Date.parse(dto.DateCreated) || undefined : undefined,
    serverPlayCount: dto.UserData?.PlayCount,
    serverLastPlayedAt: dto.UserData?.LastPlayedDate
      ? Date.parse(dto.UserData.LastPlayedDate) || undefined
      : undefined,
    loudness: loudnessOf(dto),
    audio: {
      bitrateKbps: audioStream?.BitRate ?? mediaSource?.Bitrate,
      sampleRateHz: audioStream?.SampleRate,
      bitsPerSample: audioStream?.BitDepth,
      mimeType: mediaSource?.Container ? `audio/${mediaSource.Container}` : undefined,
    },
  };
}
