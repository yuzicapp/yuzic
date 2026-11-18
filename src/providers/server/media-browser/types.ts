/**
 * Raw shapes returned by the Jellyfin/Emby `/Items`-family endpoints. Only
 * the fields this adapter actually reads are modeled — both servers return
 * far more than this, and callers ask for extra fields via `Fields=...`
 * query params per-endpoint, so every field here is optional.
 */
interface MediaBrowserProviderIds {
  MusicBrainz?: string;
  MusicBrainzAlbum?: string;
  /**
   * The release-group id, distinct from `MusicBrainzAlbum` (a specific
   * release). Cover Art Archive and other MBID consumers need to know which
   * kind of id they were handed — domain `ExternalIds.mbidType` records it.
   */
  MusicBrainzReleaseGroup?: string;
  /** Recording MBID for an individual track; ID3-tagged libraries only. */
  MusicBrainzTrack?: string;
}

interface MediaBrowserImageTags {
  Primary?: string;
}

interface MediaBrowserUserData {
  PlayCount?: number;
  LastPlayedDate?: string;
  /** 100ns ticks — the resume position the "Continue Watching" surface reads. */
  PlaybackPositionTicks?: number;
}

interface MediaBrowserMediaStream {
  Type?: string;
  BitRate?: number;
  SampleRate?: number;
  BitDepth?: number;
}

interface MediaBrowserMediaSource {
  RunTimeTicks?: number;
  Bitrate?: number;
  Container?: string;
  MediaStreams?: MediaBrowserMediaStream[];
}

interface MediaBrowserArtistRef {
  Id?: string;
  Name?: string;
  ProviderIds?: MediaBrowserProviderIds;
}

export interface MediaBrowserItem {
  Id?: string;
  Name?: string;
  Type?: string;
  ArtistItems?: MediaBrowserArtistRef[];
  Artists?: string[];
  AlbumId?: string;
  AlbumArtist?: string;
  AlbumArtistId?: string;
  AlbumPrimaryImageTag?: string;
  RunTimeTicks?: number;
  MediaSources?: MediaBrowserMediaSource[];
  Genres?: string[];
  ProviderIds?: MediaBrowserProviderIds;
  ImageTags?: MediaBrowserImageTags;
  UserData?: MediaBrowserUserData;
  PremiereDate?: string;
  DateCreated?: string;
  DateLastMediaAdded?: string;
  ProductionYear?: number;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  PlaylistItemId?: string;
  CollectionType?: string;
  /** Tracks in a playlist, where the listing was asked for it. */
  ChildCount?: number;
  /**
   * The gain Jellyfin says this track needs to sit at reference loudness, in
   * dB — its own name for what ReplayGain calls track gain. Negative for a
   * loud master, which is nearly all of them.
   *
   * Returned on audio items without being asked for: verified against a
   * Jellyfin 12.4 server with a bare `/Items?IncludeItemTypes=Audio` and no
   * `Fields=` at all, which answered -6.6, -13.2 and -8.7 for three tracks.
   * So no song query here has to request it.
   *
   * Absent on Emby and on Jellyfin before 10.10, and absent per-track for a
   * library that has not been scanned for loudness — which is why `mapSong`
   * maps it to an *optional* figure rather than defaulting it to zero. See
   * {@link Loudness}: unmeasured and "measured at 0 dB" are different claims.
   */
  NormalizationGain?: number;
  /**
   * The same figure for the track's album, where the album has one. Jellyfin
   * returns it only sometimes — one of the three tracks above carried it —
   * so album mode still falls back to the track figure, as `loudnessFor`
   * already does.
   */
  AlbumNormalizationGain?: number;
  /**
   * Free-text artist bio. `getArtists.ts` already requests it via
   * `Fields=Overview` but nothing previously read it back off the DTO.
   */
  Overview?: string;
}

export interface MediaBrowserItemsResponse<T = MediaBrowserItem> {
  Items?: T[];
  /** How many items match in total, for paging. Absent on some responses and
   *  unreliable on others, so it is a hint rather than the stop condition. */
  TotalRecordCount?: number;
}
