/**
 * An enum of all the keys of query functions.
 */
export enum QueryKeys {
	Album = 'album',
	Albums = 'albums',
	Artist = 'artist',
	Artists = 'artists',
	Playlist = 'playlist',
	Playlists = 'playlists',
	Song = 'song',
	Tracks = 'tracks',
	Starred = 'starred',
	RecentSongs = 'recent-songs',
	Genres = 'genres',
	ExternalAlbum = 'external-album',
	ExternalArtist = 'external-artist-v2',
	ExploreSimilarArtists = 'explore-similar-artists',
	ExploreSimilarArtistAlbums = 'explore-similar-artist-albums',
	ExploreSimilarContent = 'explore-similar-content',
	SimilarArtists = 'server-similar-artists',
	SimilarAlbums = 'server-similar-albums',
	Bookmarks = 'server-bookmarks',
	/** v2: the entry became { songs, themed } — the persisted cache outlives an
	 * app upgrade, and a v1 array read through the new shape is an empty shelf. */
	ServerRandom = 'server-random-shelf-v2',
	/** v2: entries carry a resolved `cover` where they used to carry a raw
	 * `coverArt` id. Same reason as above — persisted v1 rows have no cover. */
	ServerNowPlaying = 'server-now-playing-v2',
	LbSimilarForYou = 'lb-similar-for-you',
	LbCreatedForPlaylists = 'lb-created-for-playlists',
	ArtistMbid = 'artist-mbid-lookup',
	Podcasts = 'server-podcasts',
	Radio = 'server-radio-stations',
	Shares = 'server-shares',
	/** Whether the active server really offers a declared surface (podcasts, shares). */
	ServerSurface = 'server-surface',
	/** Whether the active server really returns a loudness figure to level towards. */
	ServerLoudness = 'server-loudness',
	ExploreGenreRow = 'explore-genre-row',
	ExternalAlbumPreviews = 'external-album-previews',
	RecommendedLocalSongs = 'recommended-local-songs',
	RecommendedExternalSongs = 'recommended-external-songs',
	ExploreBecauseYouListened = 'explore-because-you-listened',
	ExploreCharts = 'explore-charts',
	ExploreTopArtists = 'explore-top-artists',
	ServerArtistTopSongs = 'server-artist-top-songs',
	ServerSimilarAlbums = 'server-similar-albums',
	LocalArtistTopTracks = 'local-artist-top-tracks',
	LocalArtistExternalDiscography = 'local-artist-external-discography',
	/** `resolveArtistDetails`/`resolveAlbumDetails` — the screen-model resolution keys. */
	ArtistDetailsResolution = 'artist-details-resolution',
	AlbumDetailsResolution = 'album-details-resolution',
	/** Local-first daily mix: play-stats seed + server-native similarity, zero
	 * external calls (see LocalMixSection). */
	LocalMix = 'local-mix',
}
