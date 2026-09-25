/**
 * Raw shapes returned by Navidrome's Subsonic-compatible REST API. Only the
 * fields this adapter actually reads are modeled; everything is optional
 * since Subsonic servers omit absent fields rather than nulling them.
 */
interface SubsonicGenreRef {
  name?: string;
}

export interface SubsonicSong {
  id?: string;
  title?: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  path?: string;
  bitRate?: number;
  samplingRate?: number;
  bitDepth?: number;
  contentType?: string;
  year?: number;
  discNumber?: number;
  track?: number;
  created?: string;
  played?: string;
  playCount?: number;
  bpm?: number;
  genre?: string;
  genres?: (SubsonicGenreRef | string)[];
  /** OpenSubsonic extension; the track's mood tags, as the file carries them. */
  moods?: string[];
  /** 1-5 where the user has rated it, absent or 0 where they have not. */
  userRating?: number;
  /** OpenSubsonic extensions; used for matching, absent on older servers. */
  musicBrainzId?: string;
  isrc?: string[];
}

export interface SubsonicAlbum {
  id?: string;
  name?: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  year?: number;
  genre?: string;
  /** OpenSubsonic extension; the full list, where the legacy field holds one. */
  genres?: (SubsonicGenreRef | string)[];
  /** OpenSubsonic extension; the album's mood tags, as the files carry them. */
  moods?: string[];
  /** OpenSubsonic extension; MusicBrainz release-group types ("Album", "EP"). */
  releaseTypes?: string[];
  /** OpenSubsonic extension; the one secondary type reported as a flag. */
  isCompilation?: boolean;
  created?: string;
  /** Reported on the ID3 object too, not only in a list. */
  playCount?: number;
  /** OpenSubsonic extension; when the origin last recorded a play. */
  played?: string;
  song?: SubsonicSong[];
  /** 1-5 where the user has rated it, absent or 0 where they have not. */
  userRating?: number;
  /** OpenSubsonic extension; a release-group id where the server reports one. */
  musicBrainzId?: string;
}

/** Shape returned by the non-ID3 getAlbumList/getStarred `album` entries (titled "title", not "name"). */
export interface SubsonicAlbumListEntry {
  id?: string;
  title?: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  year?: number;
  genre?: string;
  /** OpenSubsonic extensions, as on the ID3 album object. */
  genres?: (SubsonicGenreRef | string)[];
  moods?: string[];
  releaseTypes?: string[];
  isCompilation?: boolean;
  created?: string;
  songCount?: number;
  playCount?: number;
  played?: string;
  userRating?: number;
}

/** Shape returned by search3's ID3-based `album` entries (uses "name", not "title"). */
interface SubsonicSearchAlbumEntry {
  id?: string;
  name?: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  year?: number;
  genre?: string;
  created?: string;
}

export interface SubsonicArtist {
  id?: string;
  name?: string;
  coverArt?: string;
  /** OpenSubsonic extension; present on the ID3 endpoints, absent elsewhere. */
  musicBrainzId?: string;
}

interface SubsonicArtistIndex {
  artist?: SubsonicArtist[];
}

interface SubsonicGenreEntry {
  value?: string;
}

export interface SubsonicPlaylist {
  id?: string;
  name?: string;
  coverArt?: string;
  changed?: string;
  created?: string;
  /** The account that owns it. Public playlists of other accounts are listed too. */
  owner?: string;
  /** The playlist's description, which the API calls a comment. */
  comment?: string;
  /**
   * OpenSubsonic extension; whether the caller may NOT change it.
   *
   * The server's own answer to a question this adapter used to guess at by
   * comparing usernames — see `ownedBy`.
   */
  readonly?: boolean;
  entry?: SubsonicSong[];
  /**
   * How many tracks it holds. Reported by `getPlaylists`, which returns no
   * `entry` at all — so this is the only thing a listing can say about the
   * tracks, and dropping it is what made every playlist read "0 songs".
   */
  songCount?: number;
}

interface SubsonicMusicFolder {
  id?: string | number;
  name?: string;
  title?: string;
}

interface SubsonicError {
  code?: number;
  message?: string;
}

interface SubsonicResponseBody {
  status?: string;
  error?: SubsonicError;
  song?: SubsonicSong;
  album?: SubsonicAlbum;
  artist?: SubsonicArtist;
  artists?: { index?: SubsonicArtistIndex[] };
  albumList?: { album?: SubsonicAlbumListEntry[] };
  genres?: { genre?: SubsonicGenreEntry[] };
  musicFolders?: { musicFolder?: SubsonicMusicFolder | SubsonicMusicFolder[] };
  playlists?: { playlist?: SubsonicPlaylist[] };
  playlist?: SubsonicPlaylist & { id?: string; playlistId?: string };
  playlistId?: string;
  starred?: { album?: SubsonicAlbumListEntry[]; song?: SubsonicSong[] };
  albumInfo?: {
    notes?: string;
    musicBrainzId?: string;
    lastFmUrl?: string;
  };
  similarSongs?: { song?: SubsonicSong[] };
  topSongs?: { song?: SubsonicSong[] };
  internetRadioStations?: {
    internetRadioStation?: {
      id?: string;
      name?: string;
      streamUrl?: string;
      /** What a server actually answers with — see `getInternetRadioStations`. */
      homePageUrl?: string;
      /** The parameter's spelling, tolerated from servers that echo it back. */
      homepageUrl?: string;
    }[];
  };
  shares?: {
    share?: {
      id?: string;
      url?: string;
      description?: string;
      created?: string;
      expires?: string;
      visitCount?: number;
    }[];
  };
  bookmarks?: {
    bookmark?: {
      position?: number;
      comment?: string;
      changed?: string;
      entry?: { id?: string };
    }[];
  };
  playQueue?: {
    current?: string;
    position?: number;
    changed?: string;
    changedBy?: string;
    entry?: { id?: string }[];
  };
  randomSongs?: { song?: SubsonicSong[] };
  podcasts?: {
    channel?: {
      id?: string;
      url?: string;
      title?: string;
      description?: string;
      coverArt?: string;
      originalImageUrl?: string;
      status?: string;
      errorMessage?: string;
      episode?: {
        id?: string;
        streamId?: string;
        channelId?: string;
        title?: string;
        description?: string;
        publishDate?: string;
        status?: string;
        duration?: number;
        coverArt?: string;
        contentType?: string;
        bitRate?: number;
        path?: string;
      }[];
    }[];
  };
  newestPodcasts?: {
    episode?: {
      id?: string;
      streamId?: string;
      channelId?: string;
      title?: string;
      description?: string;
      publishDate?: string;
      status?: string;
      duration?: number;
      coverArt?: string;
    }[];
  };
  nowPlaying?: {
    entry?: (SubsonicSong & { username?: string; minutesAgo?: number })[];
  };
  artistInfo2?: {
    biography?: string;
    musicBrainzId?: string;
    lastFmUrl?: string;
    similarArtist?: {
      id?: string;
      name?: string;
      coverArt?: string;
      albumCount?: number;
    }[];
  };
  searchResult3?: {
    album?: SubsonicSearchAlbumEntry[];
    artist?: SubsonicArtist[];
    song?: SubsonicSong[];
  };
  scanStatus?: { scanning?: string };
}

export interface SubsonicResponse {
  "subsonic-response"?: SubsonicResponseBody;
}
