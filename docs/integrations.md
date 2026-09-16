# Servers, integrations, and downloaders

Everything yuzic can talk to, what it needs from you, and where it's
configured in the app. Three separate things live here and they're easy to
confuse:

- A **server** is where your music actually is. You need exactly one to use
  the app (you may add several and switch between them).
- An **integration** is an outside service that adds metadata, discovery, or
  scrobbling on top of that library. All optional, all off until switched on.
- A **downloader** fetches music you don't own yet into your server's library.
  Optional, and self-hosted by you.

For how a provider is wired in internally — the `ApiAdapter` contract and the
presence-gating rule — see [architecture.md](architecture.md).

---

## Servers

| Server | Type id | Auth | Public demo |
| --- | --- | --- | --- |
| Navidrome (any Subsonic-compatible server) | `navidrome` | username + password (Subsonic token auth) | Yes — `demo.navidrome.org` |
| Jellyfin | `jellyfin` | username + password → access token | No |
| Emby | `emby` | username + password → access token | No |
| Plex | `plex` | Plex PIN code sign-in → account token | No |
| Local files | `local` | no account; select files from this device | — |

Configured during onboarding, and afterwards in **Settings → Server**. Each
server also carries optional **fallback URLs** (tried in order when the primary
is unreachable — e.g. a Tailscale address away from home) and optional HTTP
basic auth in front of the server.

Provider registry: `src/providers/registry/serverConnections.ts` — which also holds the
per-provider facts that aren't API calls (demo credentials, cover URLs, and
which `auth` key stores the chosen libraries). Adapters: `src/providers/server/navidrome/`
for Subsonic, and `src/providers/server/media-browser/adapter.ts` for both Jellyfin and Emby,
which speak the same API and differ only by brand — `src/providers/server/media-browser/jellyfin/` and
`src/providers/server/media-browser/emby/` are thin bindings over it. Plex is a separate JSON API in
`src/providers/server/plex/`; it direct-plays the selected media part and reports its own
timeline events. Local files live in `src/providers/server/local/`: Yuzic copies files chosen
through the document picker into private app storage and indexes supported MP3,
FLAC, M4A, and MP4 tags. It does not scan the device or ask for broad media
permissions.

### What each server can back

The base surface — auth, albums, artists, genres, playlists, starred, songs,
tracks, similar, lyrics, search — works everywhere. These are optional, and the
UI shows them only when the active server's adapter provides them:

| Capability | `ApiAdapter` field | Navidrome | Jellyfin / Emby | Plex | Local files |
| --- | --- | --- | --- | --- | --- |
| Internet radio stations | `radio` | ✅ | — | — | — |
| Jukebox (play on the server) | `jukebox` | ✅ (off by default server-side) | — | — | — |
| Public share links | `shares` | ✅ | — | — | — |
| Resume positions / bookmarks | `bookmarks` | ✅ (native endpoint) | ✅ (from `PlaybackPositionTicks`) | — | — |
| Server-side play queue sync | `queue` | ✅ | — | — | — |
| Random songs + who else is listening | `discovery` | ✅ | ✅ (`SortBy=Random`; listeners from `/Sessions`) | — | — |
| Podcasts | `podcasts` | ✅ | — | — | — |
| Account avatar | `user` | ✅ (`getAvatar`) | ✅ (`/Users/{id}/Images/Primary`) | — | — |

A Jellyfin user never sees a Radio row rather than seeing one that goes
nowhere — the Library index builds its rows from what the adapter offers
(`src/features/library/LibraryEntryRows.tsx`).

**A radio station's homepage is spelled two ways, and both are correct.**
`createInternetRadioStation`/`updateInternetRadioStation` take the parameter
`homepageUrl`, while the station a server returns from
`getInternetRadioStations` carries `homePageUrl` — capital P, in the XML
attribute and the JSON field alike (Navidrome's `responses.Radio`). Reading the
parameter's spelling back is why every saved homepage came back empty, and why
the next save wrote that emptiness to the server. The mapper accepts either;
the update always sends the parameter, empty string included, because the
server replaces the whole record and an omitted parameter is indistinguishable
from a cleared one.

**Artist info and pictures come from the server first.** Servers already fetch
a lot of this themselves, so the app reads it before any Metadata backup:
Navidrome's artist page asks `getArtistInfo2.view` (`count=0`) alongside
`getArtist.view` for the biography its agents found; Jellyfin/Emby give
`Overview` and `Genres`; Plex gives `summary` and `Genre`. For pictures, a
mapper reports a real gap rather than a URL that 404s — Navidrome 0.64+ omits
`coverArt`, Jellyfin/Emby report no `ImageTags.Primary` — and names the item,
so cover resolution can try the library's copy and then the Artwork backups.

### Client certificates (mTLS)

For a server behind a reverse proxy that asks the *client* to prove who it is.
The user imports a PKCS#12 bundle (`.p12`/`.pfx`) plus its password under
**Settings → Server**; `src/features/mtls/` holds it and applies it.

- **Stored in the OS keystore**, not in Redux and not in the persisted settings
  blob — `clientCertificateStore.ts` wraps `expo-secure-store`. A certificate's
  private key must not land in a redux-persist snapshot, so the store is the
  only path to it and nothing else keeps a copy.
- **It reaches both transports on both native platforms.** `applyClientCertificate`
  calls `YuzicEngine.setClientCertificate`, which points the engine's audio and
  plain-request transports at the same identity (these native paths are in the
  yuzic-engine repository): on iOS, the audio
  `URLSession` (`ios/Core/HTTPTrackReaderFactory.swift`) and
  `ClientCertificateHTTP` (`ios/Core/ClientCertificateHTTP.swift`); on Android,
  Media3's `OkHttpDataSource` and `ClientCertificateTransport`. The app's server
  calls go through `src/features/mtls/serverFetch.ts`, which routes to the
  engine's `clientCertificateRequest` while a certificate is set and to the
  global `fetch` otherwise. Both halves are required: a certificate on only the
  audio transport is unreachable, because the login that precedes every track
  is the request an mTLS server refuses first. That was the state this shipped
  in once — it typechecked, tested and ran while being unusable.
- **Only the music server's requests take that path.** `fetchWithTimeout`, and
  through it Deezer, Last.fm, MusicBrainz and the rest, keep using the plain
  `fetch` on purpose: those are third parties, and presenting the person's
  client certificate to them would hand an identity issued for their own server
  to someone else.
- **Available on iOS and Android.** Both engines implement the pair of bridge
  methods together; `Tools/parity.py` in the engine verifies their matching
  signatures and retains only Android cache resizing as the declared gap.
- **`useClientCertificate` is mounted in `src/app/_layout.tsx`**, at the root.
  It has to be: the certificate is applied at startup and re-applied whenever
  the active server changes, both of which happen with Settings closed. Mounted
  only by the settings card — as it was — a server switch left the previous
  server's identity in place.

---

## Integrations

Every one of these is off until you turn it on. Nothing here is required for
the app to work.

Where they are set up depends on whether there is anything to sign in to:

- **Accounts and self-hosted services** — ListenBrainz and AudioMuse-AI — are
  under **Settings → Connections**, with the downloaders.
- **Keyless sources** have no screen of their own. Settings are organised by
  what the data is for, so each *use* of a source is one switch on that
  purpose's screen: **Metadata** (artist info, artwork, lyrics), **Pages**
  (similar artists, popular tracks, previews, recommendations), **Search**, and
  **Home** (discovery shelves). `src/providers/registry/sources.ts` declares
  every use, and the order they are tried in.

| Integration | Account needed | What it adds |
| --- | --- | --- |
| [Deezer](#deezer) | No | Artwork backup, similar artists, popular tracks, 30s previews, recommendations, Home shelves, search, external artist/album pages |
| [MusicBrainz](#musicbrainz) | No | Search results and canonical artist/album pages for things not in your library; MBIDs for downloaders |
| [Cover Art Archive](#cover-art-archive) | No | Album covers matched by MBID, as an artwork backup |
| [Last.fm](#lastfm) | No | Artist biography and tags, similar artists, playlist-recommendation seeds |
| [LRCLIB](#lrclib) | No | Synced or plain lyrics when the server has none |
| [ListenBrainz](#listenbrainz) | Token, for scrobbling and mixes | Scrobbling + now-playing, made-for-you mixes on Home; and, keyless, the public similar-artist graph |
| [AudioMuse-AI](#audiomuse-ai) | Self-hosted instance | Acoustic-similarity autoplay ("Smart Shuffle") and playlist generation |

**Scrobbling** is chosen per destination, per server, under **Settings →
Scrobbling**: off, through the server (Navidrome forwards scrobbles to Last.fm
or ListenBrainz itself), or direct from Yuzic (ListenBrainz only). One route per
destination, so a listen is never sent twice.

### Deezer

`src/providers/integration/deezer/` · **Metadata**, **Pages**, **Search**, **Home**

Read-only, unauthenticated public API. One switch per use, each on the screen
for what it is for:

- **Metadata › Artwork** — an artist photo or album cover the server lacks,
  used only on a same-name match (after Cover Art Archive for albums).
- **Pages** — similar artists, popular tracks, 30-second previews, and
  recommendations on artist, album and playlist screens.
- **Search** — Deezer results under Other sources.
- **Home** — charts and genre shelves. Off by default, and absent when offline.

This replaced a single "discovery" switch that turned on things nobody had
asked about. Existing installs keep whatever they had on:
`src/providers/registry/legacySourceSettings.ts` turns each old switch into the
uses it covered, once.

Deezer is also one of the two external **sources** (with MusicBrainz) behind
artist/album resolution — see `src/features/sources/registry.ts`.

### MusicBrainz

`src/providers/integration/musicbrainz/` · **Search**

Read-only, no account. Fills in artist and album pages with canonical metadata
when the entity isn't in your library, and supplies MBIDs that the downloaders
use to resolve a release precisely instead of by fuzzy name match.

### Last.fm

`src/providers/integration/lastfm/` · **Metadata › Artist info**, **Pages**

Read-only with a bundled API key — no account, no signing, no session. Used for
similar artists, to seed playlist recommendations, and — under Metadata › Artist
info — for a biography and tags when the server has none. Artist names are sent
to Last.fm to look them up, which is why each use is a switch rather than always-on.

### ListenBrainz

`src/providers/integration/listenbrainz/` · **Settings → Connections → ListenBrainz**; keyless uses on **Pages** and **Home**

Two independent things:

- **Discovery** reads the public similar-artist graph and takes no account —
  similar artists on Pages and a Home shelf, each off until switched on.
- **The account** — your ListenBrainz username and user token, entered in the
  app — enables direct scrobbling and now-playing (routed under Settings →
  Scrobbling), and the made-for-you mixes (daily jams, weekly jams, weekly
  exploration) as their own Home shelves.

### Cover Art Archive

`src/providers/registry/coverBackups.ts` · **Metadata › Artwork**

No account. The first artwork backup for an album the server has no cover
for: matched exactly by the MBID the server's tags carry, never by name.

### LRCLIB

`src/providers/integration/lrclib/` · **Metadata › Lyrics**

No account. Lyrics for a track whose server has none, looked up by artist,
title, album and duration. One source that prefers synced lyrics and falls back
to plain ones, rather than two switches.

### AudioMuse-AI

`src/providers/integration/audiomuse/`, `src/providers/registry/similarityService.ts` · **Settings → Connections → AudioMuse-AI**

A self-hosted service you point at the same music server. Needs a server URL
and API token. When connected and enabled, it becomes the queue-fill provider
for autoplay — extending the queue with sonically similar tracks ranked by
acoustic analysis, instead of the server's own similar-songs endpoint
(`src/features/playback/queueProviders.ts`). It also backs playlist generation from a
seed track (`src/features/playlist/generateSimilarPlaylist.ts`).

---

## Downloaders

**Settings → Connections**, under Downloaders. Each takes a server URL and an API key, is
per-server, and shows its own live transfer queue in the app. When a transfer
finishes, the app nudges your music server to rescan so the new music appears
without a manual pull (`src/features/downloaders/DownloadersQueueContext.tsx`).

| Downloader | Label in app | Albums | Individual tracks | Settings |
| --- | --- | --- | --- | --- |
| [Lidarr](https://lidarr.audio) | Lidarr | ✅ | — (Lidarr is album-oriented) | Server URL + API key (Lidarr → Settings → General) |
| [slskd](https://github.com/slskd/slskd) (Soulseek) | Soulseek | ✅ | ✅ | Server URL + API key, plus its own search preferences |
| [SoulSync](https://github.com/Nezreka/SoulSync) | SoulSync | ✅ as its tracks (no album endpoint) | ✅ | Server URL + API key |

Registry and the shared `DownloaderDefinition` shape:
`src/features/downloaders/registry.ts`. A downloader is offered on an external
album page only when it's configured for the active server.

> **Downloaders are not the same thing as offline downloads.** A downloader
> adds music to your *server*. Offline downloads copy music already in your
> library onto *this device* — those live in the app's private storage and are
> managed under **Settings → Library → Downloads**.

---

## Endpoints we call

Every outside service the app talks to, endpoint by endpoint. Nothing here
fires unless the matching switch is on, so a default install with one server
configured makes **no** requests to any of these hosts.

### How a request is handled

- **Timeout.** Every integration request goes through `fetchWithTimeout`
  (`src/providers/http/fetchWithTimeout.ts`) with a 30s ceiling, and a timeout is raised
  as `RequestTimeoutError` so a caller can tell it apart from an abort. The
  integrations had no ceiling at all once, which left a spinner up forever on a
  black-holed connection.
- **Caching.** Deezer keeps its own in-memory TTL cache with per-endpoint
  lifetimes and a 500-entry cap, and coalesces identical in-flight requests
  (`src/providers/integration/deezer/catalog.ts`). Everything else caches at the react-query
  layer in the hook that calls it. slskd searches are coalesced through
  `src/providers/http/coalesceRequest.ts` — a double tap otherwise starts a second
  45-second Soulseek search and queues the files twice.
- **Failure.** A metadata read that fails degrades to nothing — an empty list,
  a section that doesn't render — rather than an error state, because none of
  it is load-bearing. Downloader and scrobble calls surface a real error,
  because the user asked for those directly.
- **Auth.** Bearer/token headers where the service needs one (see the tables);
  Deezer and MusicBrainz are unauthenticated; Last.fm uses a bundled read-only
  `api_key` with no signing or session.

### Plex — your server and `https://plex.tv`

Plex is connected with a browser-approved PIN rather than its server's
username/password form. Yuzic sends its persistent per-install
`X-Plex-Client-Identifier` with every Plex request, asks `plex.tv` for a PIN,
polls it until Plex returns the account token, then verifies that token against
the selected server. Tokens are stored in the server credential record; they
are never put in URLs except where Plex requires the token on a direct media or
artwork URL.

| Endpoint | Used for |
| --- | --- |
| `POST https://plex.tv/api/v2/pins?strong=true` | Starting browser PIN sign-in |
| `GET https://plex.tv/api/v2/pins/{id}` | Polling PIN approval |
| `GET https://plex.tv/api/v2/user` | Account display name after approval |
| `GET /identity` | Server reachability/token check; its `machineIdentifier` roots the item URIs playlist writes send |
| `GET /library/sections`, `/library/sections/{id}/all`, `/library/metadata/{id}` | Music catalog and item children |
| `GET /hubs/search?query=` | Library search |
| `GET /playlists?playlistType=audio`, `/playlists/{id}/items` | Reading audio playlists |
| `POST /playlists?type=audio&smart=0&title=&uri=server://{machine}/com.plexapp.plugins.library` | Creating a playlist |
| `PUT /playlists/{id}?title=`, `DELETE /playlists/{id}` | Renaming and deleting a playlist |
| `PUT /playlists/{id}/items?uri=…/library/metadata/{ratingKey}` | Adding a track |
| `DELETE /playlists/{id}/items/{playlistItemID}` | Removing one entry |
| `PUT /playlists/{id}/items/{playlistItemID}/move?after={playlistItemID}` | Moving an entry (no `after` moves it first) |
| `PUT /:/rate`, `GET /:/scrobble`, `GET /:/timeline` | Favourites and playback events |
| `GET /library/streams/{id}` | A track's lyrics: the media part's stream with `streamType` 4, read as LRC when timed and plain lines otherwise |
| `GET /library/metadata/{id}/nearest?limit=&maxDistance=` | Sonically similar tracks; a 404 (library without sonic analysis) is no similar tracks, not a failure |

Plex answers writes with an empty body, which the client reads as success
rather than failing to parse. Neither lyrics streams nor `nearest` have been
checked against a live Plex server yet.

**Playlist entries on every server** are addressed by position, not song id,
because a playlist can hold a song twice (`providers/server/playlistEntries.ts`).
Navidrome removes by `songIndexToRemove`; it has no move, so a move rewrites the
playlist from the first changed position with one `updatePlaylist` call.
That call repeats a song id per track, so on a server that declares the
OpenSubsonic `formPost` extension (`getOpenSubsonicExtensions`, asked once per
client) every POST sends its parameters form-encoded in the body instead of the
URL, where a long playlist would outgrow a reverse proxy's URL limit. Servers
without it get the plain Subsonic query string.
Jellyfin and Emby move with `POST /Playlists/{id}/Items/{PlaylistItemId}/Move/{index}`.

**Who may change a playlist.** Navidrome names each playlist's `owner`; only the
owner's playlists offer Edit songs, Rename, Delete, or a place in Add to
Playlist. Jellyfin 10.9+ shares playlists with edit rights, which its item
listing does not say, so a playlist's detail also reads `GET /Playlists/{id}`
(its `Shares`) and `GET /Playlists/{id}/Users/{userId}` (`CanEdit`, answered
for the owner too; a 404 means neither owner nor shared). An account shared
with edit rights may edit and rename but not delete. Emby and older Jellyfin
cannot say, and keep every playlist editable. Plex reports no owner.

### Local files

The local provider has no network endpoint. Import is explicit, during onboarding
or later under **Settings → Library → Local files**: selected files are copied
into private app storage, metadata is read once, then the compact index
(catalog, local playlists, favourites, and `file://` paths) persists in
MMKV. Re-importing a file creates a distinct private copy; deleting files from
the system picker source cannot break the imported copy.

### Deezer — `https://api.deezer.com`

No auth. `src/providers/integration/deezer/`.

| Endpoint | Used for | Cache |
| --- | --- | --- |
| `GET /search/artist` | Resolving an artist by name; Deezer results in search; Metadata › Artwork backup for an artist photo (used only when the lead artist's name matches — "A feat. B" looks up A) | 12h |
| `GET /search/album` | Resolving an album; Deezer results in search; preview lookup; Metadata › Artwork backup for an album cover (same title and lead artist only) | 12h |
| `GET /artist/{id}` | External artist page | 7d |
| `GET /artist/{id}/albums` | Discography on an external artist page | 1d |
| `GET /artist/{id}/related` | Similar artists | 7d |
| `GET /artist/{id}/top` | Top tracks on an artist page | 1d |
| `GET /album/{id}` | External album page | 1d |
| `GET /album/{id}/tracks` | 30-second preview samples | — |
| `GET /genre` | Home genre shelf | 30d |
| `GET /genre/{id}/artists` | Home genre shelf | 30d |
| `GET /chart/0/artists` | Home "top artists" shelf | 6h |
| `GET /chart/0/albums` | Home Deezer charts shelf | 6h |

### MusicBrainz — `https://musicbrainz.org/ws/2`

No auth, `User-Agent` identifies the app. `src/providers/integration/musicbrainz/index.ts`.

| Endpoint | Used for |
| --- | --- |
| `GET /artist?query=` | Resolving an artist by name |
| `GET /artist/{mbid}?inc=release-groups` | External artist page + discography |
| `GET /release-group?query=` | Resolving an album by artist + title (never to find a cover) |
| `GET /release-group/{mbid}?inc=artist-credits` | External album page |
| `GET /release?release-group={mbid}&inc=recordings+artist-credits` | Track list for an album |

Cover art comes from `https://coverartarchive.org/release-group/{mbid}/front-500`,
built as a URL rather than requested by us — for a MusicBrainz album that is
its own cover.

As a Metadata › Artwork backup (`src/providers/registry/coverBackups.ts`), for an
album whose own source has no cover but carries an MBID, the listing is asked
first: `GET https://coverartarchive.org/{release-group|release}/{mbid}` — the
kind the server stated, then the other — and the cover is used only when the
listing has a front image. A 404/400 is a remembered "none" (re-asked after a
week); any other failure is not remembered. No name search is ever made for a
cover.

### Last.fm — `https://ws.audioscrobbler.com/2.0/`

Bundled `api_key`, no signing, no session. `src/providers/integration/lastfm/`.

| Endpoint | Used for |
| --- | --- |
| `POST artist.getsimilar` | Similar artists on an artist page; seeding playlist recommendations |
| `POST artist.getinfo` | Metadata › Artist info backup: biography and tags for an artist whose server has none |

Nothing else on the Last.fm API is called — see
[what we deliberately don't call](#what-we-dont-call).

### ListenBrainz — `https://api.listenbrainz.org/1`

`Authorization: Token <user token>`, except where noted. `src/providers/integration/listenbrainz/`.

| Endpoint | Used for |
| --- | --- |
| `GET /validate-token` | Testing the token when you connect, and on reconnect |
| `POST /submit-listens` (`listen_type: single`) | Scrobbling a completed track |
| `POST /submit-listens` (`listen_type: playing_now`) | Now-playing |
| `GET /user/{user}/playlists/createdfor` | Finding the account's made-for-you mixes for their Home shelves |
| `GET /playlist/{mbid}` | Reading one mix's tracks |
| `GET https://labs.api.listenbrainz.org/similar-artists/json` | The Home "similar to what you play" shelf and similar artists on Pages. No auth — this is the public graph, and it's the Discovery switch rather than the account |

### LRCLIB — `https://lrclib.net/api`

No auth, `User-Agent` identifies the app. `src/providers/integration/lrclib/`.

| Endpoint | Used for |
| --- | --- |
| `GET /get?artist_name=&track_name=&album_name=&duration=` | Metadata › Lyrics backup for a track whose server has none |

### AudioMuse-AI — your instance

`Authorization: Bearer <api token>`. `src/providers/integration/audiomuse/`.

| Endpoint | Used for |
| --- | --- |
| `GET /api/health` | Connection test in Settings |
| `GET /api/similar_tracks` | Autoplay queue extension and playlist generation. One seed track per request, so the queue filler walks seeds newest-first and stops once it has enough unique results |

### Lidarr — your instance, `/api/v1`

`X-Api-Key`. `src/providers/integration/lidarr/`.

| Endpoint | Used for |
| --- | --- |
| `GET /system/status` | Connection test |
| `GET /artist` · `GET /artist/lookup?term=` · `POST /artist` | Finding the artist a requested album belongs to, adding them if Lidarr doesn't track them yet |
| `GET /rootfolder` | Picking a path when adding an artist |
| `GET /album?artistId=` | Locating the requested album on that artist |
| `PUT /album/{id}` | Marking the album monitored |
| `GET /command` · `POST /command` (`AlbumSearch`) | Kicking off the search — the `GET` first, so a search already queued or running isn't started twice |
| `GET /queue?includeAlbum=true&includeArtist=true&pageSize=100` | The in-app transfer queue, and spotting finished items |
| `DELETE /queue/{id}` | Cancelling a download |

### slskd — your instance, `/api/v0`

`X-API-Key`. `src/providers/integration/slskd/`.

| Endpoint | Used for |
| --- | --- |
| `GET /application` | Connection test |
| `POST /searches` | Starting a Soulseek search for an album or track |
| `GET /searches/{id}` | Polling until `isComplete` |
| `GET /searches/{id}/responses` | Reading the results to pick a directory or file |
| `DELETE /searches/{id}` | Cleaning up the search — runs on the timeout and error paths too |
| `POST /transfers/downloads/{username}` | Enqueueing the chosen files |
| `GET /transfers/downloads/` | The in-app transfer queue, and spotting finished items |
| `DELETE /transfers/downloads/{username}/{fileId}?remove=false` then `?remove=true` | Cancelling — the first call is allowed to fail, since a file that already finished can't be cancelled |

slskd downloads also reach MusicBrainz (`src/providers/integration/slskd/mb/canonicalize.ts`) to
turn an MBID into a canonical artist/album/track list before matching filenames
against it.

### SoulSync — your instance, `/api/v1`

`Authorization: Bearer`. `src/providers/integration/soulsync/`. The query-param form (`?api_key=`)
is also accepted, but a key in a URL ends up in logs and history, so the header
is the one used.

Every reply is wrapped in the same `{ success, data, error }` envelope whatever
the HTTP status says; the client unwraps it so callers see `data` or an Error.

| Endpoint | Used for |
| --- | --- |
| `GET /downloads?limit=1` | Connection test — SoulSync has no dedicated status endpoint, so the queue read doubles as one |
| `POST /request` | Requesting a track. One free-text query; SoulSync runs its own search-match-download pipeline behind it |
| `GET /downloads?limit=100` | The in-app transfer queue, and spotting finished items |
| `POST /downloads/{id}/cancel` | Cancelling — takes the peer username in the body, since a transfer is addressed by id *and* peer |

SoulSync has no album endpoint — its API's only way in is `POST /request` with a
free-text query, and its wishlist takes one track at a time too — which is why
`downloadAlbum` is optional on `DownloaderDefinition`. An album Get to it is
the album's tracks, each its own `POST /request`, one after another
(`features/downloaders/albumByTracks.ts`); the tracks come from the album's
catalogue source or the server (`albumTracks.ts`), so any album sheet can offer
it.

## What we don't call

| Service | Not used | Why |
| --- | --- | --- |
| Last.fm | Scrobbling (`track.scrobble`, `track.updateNowPlaying`, `auth.getSession`) | Would need an api_secret, MD5 signing, and a per-user session. On Navidrome the server already forwards scrobbles to Last.fm; the app doesn't duplicate that. |
| Deezer | Everything behind OAuth — user playlists, favourites, full-length streams | Deezer's public read API needs no account, and adding OAuth would mean shipping an app secret and asking users to log into a service that isn't hosting their music. Samples are the 30-second previews the public API returns. |
| ListenBrainz | `GET /cf/recommendation/user/{user}/recording` and `GET /user/{user}/playlists/recommendations` | Raw collaborative-filtering output. The made-for-you mixes (`playlists/createdfor`) are the finished form of it — ListenBrainz built the mix, the app renders it — so the raw endpoints are not built. |
| Deezer | Album previews by album id | `getAlbumEmbeddedPreviews` was the same story and went the same way. `searchAlbumPreviews` is the path samples actually take. |
| MusicBrainz | Submitting anything (tags, ratings, edits) | The app is a read-only consumer of MusicBrainz. |
| Lidarr | Everything outside the add-artist → monitor-album → search flow: quality profiles, indexers, history, calendar, import lists | The app is a request button, not a Lidarr client. Configure Lidarr in Lidarr. |
| slskd | User browsing, chat, rooms, shares, uploads | Same reason. The app searches, enqueues, watches, and cancels. |

## Playing somewhere else

All of these are picked from the same **Connect** sheet on the player, which is
a single-select list of outputs — the cast button opens it.

| Output | What it is | Setup |
| --- | --- | --- |
| This device | The phone. The default. | — |
| AirPlay | Routed by iOS. iOS only. | — |
| DLNA / UPnP | Renderers discovered on the local network over SSDP, or added by IP. | — |
| Play on *your server* | The server plays through its own speakers (Subsonic jukebox). Nothing streams to the phone. | Enable `Jukebox.Enabled` on Navidrome and grant the user the jukebox role |

The jukebox row is **absent unless the server says yes**: Navidrome ships the
feature off, and grants it per user once on, so the app probes it rather than
offering a row that would error when tapped. A server with it disabled answers
with prose rather than a Subsonic error, which is a second reason not to guess.

Code: `src/features/player/PlaybackSinkContext.tsx` routes transport to whichever
output is selected; `src/features/player/playbackSink.ts` holds the types;
`src/features/player/DlnaContext.tsx` and `src/features/player/useDlnaDiscovery.ts`
are the DLNA half; `src/providers/server/navidrome/jukebox/` is the Subsonic
jukebox client.
