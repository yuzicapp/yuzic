# Architecture

How the app is built. For *what* it supports — the servers, integrations, and
downloaders, and every outside endpoint the app calls — see
[integrations.md](integrations.md).

Four load-bearing patterns hold the app together. Everything else is a leaf on
one of these trunks.

## Why, and the principles behind it

**The niche.** The recurring "tried for months to replace Spotify, crawled
back" thread on r/selfhosted names the same three failures: discovery dies (no
"similar to this", no rotating shelves), music you don't own is a multi-tool
chore away instead of a tap, and the glue between an 8–10 service stack
(server, Lidarr, slskd, AudioMuse, …) breaks silently. Yuzic's aim is to be
that whole stack's front end — your server plays it, your tools fetch it, yuzic
makes it feel like one service. It works alone; every integration adds a
capability; none is required.

These principles are why the sections below look the way they do:

- **P1 — Local-first, stable identity.** An entity's identity is a local id
  assigned on device from where it came from, never a network call and never
  normalised metadata. Matching (are these the same work?) is a separate
  concern. External ids (MBID, Deezer id) are attributes that arrive, never
  lookups made so an entity can exist. See §6.
- **P2 — Outside services are intentional.** A use nobody switched on makes no
  request, and the feature above it hides or degrades. Discovery is off by
  default: people self-host because they want to know where their data goes.
  Holding a credential authenticates a connection; it never switches a feature
  on. Read requests count as disclosures too.
- **P3 — Ask, don't guess.** An ambiguous match is surfaced, never silently
  accepted — a wrong file in the library is worse than a tap. Nothing starts a
  download from a hidden default (§8).
- **P4 — Features own composition.** Each feature decides whether its sources
  are selected, blended, a fallback, or gap-fill only. For metadata the server's
  own value goes first and outside sources fill gaps, display-only (§9).
- **P5 — Integrations are leaf modules.** A new source or downloader is one
  module plus one registry entry; screens and the router do not change (§7).
- **Clean code is an acceptance criterion.** One owner per concern, and a
  superseded path is removed after migration rather than left beside its
  replacement. Build the abstraction the real providers need, not one for
  providers that do not exist.

**Non-goals.** Deliberately out, so they are not re-proposed by accident:

- **Playlist import** — no local playlist framework, pending-import workflow or
  placeholder UI. If a connection ever offers real playlist transfer, it is
  designed then.
- **Chasing every downloader.** Adding one is a leaf module; demand pulls them in.
- **Cross-server library merging.** Wants, library and downloader setup stay
  scoped to the active server.
- **Deferred:** smart-playlist/filter engines, any new mix-generating
  algorithm (Home mixes reuse play stats, a daily seed and server similarity),
  playlist following, and artist-subscription wants.

## 1. `ApiAdapter` — optional feature capabilities

Every server yuzic supports (Navidrome, Jellyfin, Emby, Plex, and local files)
implements one `ApiAdapter` from `src/providers/contracts/ServerAdapter.ts`. The base surface (auth,
albums, artists, genres, playlists, starred, songs, tracks, similar, lyrics,
search) is required.
Anything a provider-specific feature reaches for is an **optional** field:

```ts
export interface ApiAdapter {
  auth: AuthApi;
  albums: AlbumsApi;
  // …required base…

  radio?: RadioApi;         // Subsonic (Navidrome) only today
  shares?: SharesApi;       // Subsonic only today
  ratings?: RatingsApi;     // Subsonic only — integrations.md says why
  bookmarks?: BookmarksApi; // Subsonic + mediaBrowser via PlaybackPositionTicks
  queue?: QueueApi;         // Subsonic only
  discovery?: DiscoveryApi; // getRandomSongs + getNowPlaying (Subsonic)
  podcasts?: PodcastsApi;   // Subsonic only
  jukebox?: JukeboxApi;     // Subsonic only — see the note on probing below
  user?: UserApi;           // the account's own avatar, where the server has one
}
```

**Presence is not always permission.** `jukebox` is the case that shows the
limit of presence-gating: every Navidrome adapter has it, but Navidrome ships
the feature off (`Jukebox.Enabled`) and, once on, grants it per user. A server
with it disabled doesn't even answer in Subsonic's error shape —
demo.navidrome.org replies with prose. So the output picker asks
(`useJukeboxAvailability` → one `status()` call) and treats any failure as a
no. Presence decides whether the app *can* ask; the server decides the answer.

A capability that isn't a whole surface is declared as a field on the surface
that owns it, and read the same way:

- `songs.streamableCodecs` — the Opus switch on Playback appears where the
  adapter says Opus is streamable, not where the server is a Jellyfin.
- `songs.scrobbleKind` — `'scrobble'` where the call is a listen the server may
  forward onward, `'markPlayed'` where it only moves a play count. The Server
  screen words its one switch from this instead of asking who the server is.

**A capability that would have to share a field with another is not one.**
`ratings` is the case: Plex has a `userRating` and an endpoint that writes it,
which looks like everything the surface needs — except that a Plex favourite
*is* `userRating = 10`, so the app is already spending that field on
`starred`. Declaring `ratings` there would give the user two controls over one
number, each silently undoing the other. Presence means the server can back the
feature *independently*, not that it has an endpoint with the right name.

**A rating the server cannot keep is not offered.** The other half of the same
rule: MediaBrowser has `Likes` and no star count, and the tempting answer is to
store stars on the device. A rating that never reaches the server the user
chose to self-host is one they lose on the next install, and the app would be
the only thing that knew about it — so `ratings` is absent for Jellyfin and
Emby and every surface above it disappears with it.

**What a rating is, once it has been written.** It is a field on the entity —
`Song.userRating`, `Album.userRating` — arriving with the catalog like
`serverPlayCount` does, and every screen reads it there. The gap that needs
filling is only the one between the tap and the next sync: that entity is
already sitting in a dozen caches, and rewriting all of them is not a thing a
rating should have to do. So `state/redux/slices/ratingsSlice` holds an overlay
of what *this device* wrote, `features/ratings/effectiveRating` says the overlay
wins, and `commitSyncResult` drops it the moment a sync has brought the
catalog back carrying the server's own answer. Absent and zero are kept apart
throughout: a server without ratings is not a server where nothing is rated.

`src/providers/server/adapterCapabilities.test.ts` pins what each adapter declares, because these are
read by screens that no longer have any other way to find out.

**Callers check for existence, not provider name.** The Library tab does
`if (api.radio) show Radio row`. If Plex adopts an equivalent tomorrow, its
adapter fills in `radio`, and the row appears for Plex users without any
code change downstream.

Same rule for methods on required surfaces that some providers can't back:
`similar.getSimilarArtists?`, `artists.getTopSongs?`, `songs.reportPlaybackStart?`,
etc.

**Never gate on `activeServer.type`.** That couples UI to provider identity and
grows a `if/else` ladder every time another server joins. Presence-gating stays
open-ended.

### One adapter per protocol, not per product

`src/providers/server/media-browser/adapter.ts` backs both Jellyfin and Emby: they speak the same
MediaBrowser-derived API and differ only in what `MediaBrowserBrand` captures —
the stream token param, whether `/System/Ping` returns JSON, and how a cover is
addressed. `src/providers/server/media-browser/jellyfin/index.ts` and `src/providers/server/media-browser/emby/index.ts` are three-line brand
bindings over it.

They were two full adapter files, identical but for the brand constant, and had
already started to drift; `adapter.test.ts` now asserts the two surfaces match
so a change can't reach only one. A server whose API is genuinely different —
Plex — gets its own adapter rather than a third brand.

### Building a new provider adapter

Implement the base surface first. Add optional surfaces only when the server
exposes the shape natively — don't approximate. If a server has a partial
version of a feature (e.g. Jellyfin's `PlaybackPositionTicks` is a per-item
resume position, not a dedicated bookmarks table), the adapter is where the
translation lives. See `src/providers/server/media-browser/bookmarks/bookmarks.ts` for how the
Jellyfin/Emby bookmarks are dressed up as Subsonic-style `Bookmark[]`.

### Local files are a provider, not an offline special case

`local` is a normal `ServerType` and `src/providers/server/local/` returns a normal adapter.
Onboarding creates one local server record with the display-only URL
`local://device`, then the import screen uses the platform document picker and
copies approved files into Yuzic's private documents directory. The index keeps
only compact tag-derived catalog data and the private file URI in MMKV; it does
not request broad media-library permission or expose a device-wide scan.

This keeps every catalog, search, playlists, starred, and player consumer on
the same adapter path. `file://` is returned by `songs.buildStreamUrl`; no
active-server exception is allowed elsewhere. A local library is intentionally
device-local: it is not a server sync or a replacement for offline downloads
from another server.

### Provider code authorization and installation identity

Provider configuration may expose an optional `codeAuth` lifecycle
(`begin → display code → poll → complete`). The credentials screen only asks
whether that capability exists; Jellyfin Quick Connect and Plex PIN sign-in are
provider implementations, not `ServerType` branches in the UI.

A thrown `poll` is retried on purpose — the provider call is allowed to blink
and the code is still good a moment later. The exception is the step *after*
approval, where the app checks the account against the chosen server: once a
token exists the approval is settled, so a failure there is the server, not the
code. A provider marks that with `codeAuthServerError`, and `useCodeAuth` ends
the flow with `reason: 'serverRefused'` or `'serverUnreachable'`. Without the
mark it retried until the timeout and told the user their code had expired,
about a code they had just approved. The two outcomes are kept apart because
they need opposite advice: a 401/403 means the address was right and the
*account* was not authorised, so pointing at the address is the same mistake in
a new place.

`ServerProviderConfig.addressHintKey` is the address screen's per-provider
hint. It exists because one shared example names one port, and the port is the
thing that differs — the shared string named Navidrome's `4533` on the Plex
screen, where the answer is `32400`.

`providers/server/installationId.ts` persists one random ID under
`app.installationId.v1`. It is used for MediaBrowser's client identity and
Plex's `X-Plex-Client-Identifier`; it must remain stable across launches and
must never be the old shared literal `yuzic-device`.

## 2. `playbackSlice` — the source of truth for playback state

`src/state/redux/slices/playbackSlice.ts` is what makes "the app remembers what
I was doing" true on every provider, not just Navidrome. It carries:

- `queueSongIds[]`, `currentIndex`, `positionMs`
- `queueContexts[]` — aligned with `queueSongIds`: the album or playlist each
  song was queued from, by `nativeId`. Restoring the queue rebuilds its
  segments from these, so a playlist heard after a relaunch still counts as
  played. State saved without them restores ad hoc.
- `repeatMode`, `shuffleMode`
- `activeServerId` — the server whose id namespace the queue belongs to;
  changing servers invalidates the slice
- `bookmarks: Record<songId, { positionMs, updatedAt }>` — per-track resume
  positions for long-form content and podcasts

`usePlaybackPersistence` (in `features/playback/`) writes to this slice from PlayingContext
on every meaningful change. `useQueueSync` and `useBookmarkManager` are
**mirror layers** on top: they push local state to the server when the adapter
supports it (`api.queue`, `api.bookmarks`) and seed the local state on connect.
They never own state.

`ResumeQueueBanner` (Home) is the fallback for fresh installs — appears only
when local is empty AND the server has a queue to offer.

**Why this shape**: server-first would have meant Jellyfin/Emby users lose the
queue on every kill, since neither exposes a Subsonic-style play-queue API.
Bookmarks are the mirror of the same story: Navidrome has an explicit endpoint,
Jellyfin has the same information as `PlaybackPositionTicks` on items. Both
back the same local map.

### Adding a new persisted playback dimension

Add the field to `PlaybackState`, an action + reducer, a selector in
`playbackSelectors.ts`, and (if you want it in the "write on state change"
loop) a call in `PlayingContext` at the site the value changes. The persister
already covers the throttling for hot-path fields — model position, not add
another one.

### Sinks — where the audio comes out

`features/player/playbackSink.ts` names the three outputs, and one distinction
runs through all of them: **does the local player still run?**

- `local` — the local player plays and keeps the clock.
- `dlna` — the local player *still* plays, muted (`setVolume(0)`), because a
  DLNA renderer reports no position back; it keeps the clock and drives the
  queue while the same stream URL goes to the renderer. Transport is
  **mirrored**.
- `jukebox` — the server holds the audio and reports its own position. Nothing
  streams to the phone. Transport is **replaced**, and the progress bar reads
  the server's polled position instead of the player's.

`ownsPlayback(sink)` is that question, and every transport call in
`PlayingContext` asks it before touching the player. Getting it wrong for the
jukebox means the phone plays the track a second time, out loud, next to the
server already playing it.

## The player, and the seam it sits behind

`features/player/backend.ts` defines `PlayerBackend` — the surface the app
actually uses, derived from its own call sites rather than from anyone's idea
of a complete player. `createEngineBackend` (yuzic-engine) implements it,
`activeBackend.ts` hands it out, and `PlayingContext` never imports a player
directly.

The seam was built while `@rntp/player` was still here, so both could run on
one device and be compared. That is what turned the removal from a rewrite of
~40 call sites into a swap of one factory function, and it is worth keeping
now that one implementation is left: it is what every test in that directory
fakes, and the engine does not run on web.

Three things about it are not obvious:

- **The engine's answers cross a bridge, and the call sites are synchronous.**
  Call sites read `Math.floor(getProgress().position)` inline, so
  `createEngineBackend` keeps a shadow of what the engine last reported and
  answers from it. A `getProgress` straight after a `seekTo` returns the
  pre-seek position until the next event.
- **Playing-ness is an event, not a getter.** The engine reports it on the
  `playing` field of its state event, which is optional — absent means "cannot
  say", and `usePlayerState.ts` guards rather than coerces, because treating
  absent as false would stop the button ever showing as playing.
- **Commands return void.** They are fire-and-forget: `play()` on a button
  press, `seekTo()` on a scrub. Failures arrive as an error event, and
  `fire()` warns as well as emitting, because in a release build nothing
  subscribes to that event.

**A track change has to stay cheap on the JS thread.** It lands at the end of
every song, and a stall there is heard as the app freezing between tracks. What
belongs in it is the player catching up — `PlayingProvider`, the playing bar,
the player host. What does not:

- **Recording the outgoing listen.** It bumps play stats, and Home's shelves
  are drawn from them; dispatched inside the change it joined the player's
  commit. `playbackCoordinator` still reads it before the pointer moves, and
  `outgoingScrobble.ts` sends it a second later.
- **Anything reading `useIsFetching` above a large tree.** It re-renders on
  every fetch in the app, and a track change starts several. Home's refresh
  spinner reads it in `RefreshSettler`, mounted only while refreshing.
- **Derived lists that change identity without changing contents.** A shelf
  built from stats is rebuilt when the stats move; `useStableList` keeps the
  previous array when the entries are the same, `useDailyLayout` keeps its
  seeds by value, and the local mix keeps the day's seeds (`chooseDailySeeds`)
  rather than re-picking — which had re-fetched the mix behind a skeleton at
  every song.

Measured on the simulator with a Metro inspector probe: the worst JS-thread
gap around an automatic advance went from 226–541ms to 149–195ms.

`@rntp/player` was removed in full — package, lockfile, patch and all. It was
proprietary from v5 (non-commercial, with a non-compete clause), which is a
probable GPL-3 conflict for yuzic and a definite F-Droid blocker.

The engine implements the same surface on both platforms. `Tools/parity.py` in
the engine repo compares the two native modules by signature — not by name —
and fails on any difference not declared in it with a reason. Read that rather
than this paragraph: the count here was wrong for months, claiming nine
missing Android methods and a stubbed `setCrossfade` long after both had been
implemented.

One difference is declared there today: `configureCache` is absent on
Android, deliberately absent rather than stubbed, so it rejects by name at the
bridge. Media3 takes the cache limit as a constructor argument to its evictor,
so changing it needs a second `SimpleCache` over one directory (documented as
corrupting the index) or releasing the live one mid-track.

**The car's library is built in two halves.** `useCarPlayBrowseTree` gathers
it and turns each song into a row through the phone queue's own
`resolvePlayableSong`, so a download plays from the device and the user's
quality applies. `carBrowseTree` decides the shape, and is pure so it is
tested: at most four tabs (Recent, Favorites, Playlists, Albums, with
Downloads when there is room), Shuffle first in every folder, and offline only
what is downloaded, with Downloads first. Two rules in the conversion
(`toBrowseNode`, `createEngineBackend.setBrowseTree`) matter:

- A node's id is its path (`albums/album-1/<song>`), never the song's id. The
  engine keeps the first of a repeated id, and the same song sits under
  Favorites and its album, so with bare ids it vanished from the album.
- An unchanged tree is not sent again. Each send redraws the car and, on
  Android, rewrites the encrypted copy on disk.

**On iOS a car can start the app with no phone window.** `AppDelegate` starts
the one React root when a CarPlay scene connects, and `PhoneSceneDelegate`
puts that same root in its window. Before this, React Native only started
from the phone scene, so a car launch ran no JavaScript and showed an empty
library.

Starting it was not enough on its own. expo-router's `SafeAreaProvider`
renders nothing until native insets arrive, and a root view outside any
window never gets them, so JavaScript ran and the app tree never mounted:
no setup, no library. `patches/expo-router+55.0.13.patch` gives it the key
window's metrics when there is one and zero when there is not. Re-check it
whenever expo-router moves.

This launch cannot be tested on a dev client build. expo-dev-launcher takes
over the root and waits for a server to be picked on a phone screen that is
not there. Test it on a Release build, in the Simulator's CarPlay window,
with the app killed first.

**A car can be playing before the app is.** On Android a car starts the
engine's media service without the app's JavaScript, and the engine plays the
selection natively (yuzic-engine 1.1.0). When the app then starts, three
things keep it from trampling that queue:

- `createEngineBackend` asks the engine what it holds once setup finishes
  (`adoptEngineQueue`) and takes it into an empty shadow, followed by the track
  change that started it, which went to no listener. Without the second half
  the app showed the car's queue with nothing playing until the next track.
- It then reports `engineQueueKnown`, and the persisted-queue restore waits for
  it (`decideRestore`). Library hydration and engine setup finish within a
  second of each other on a cold start, and a restore that got in first loaded
  last session's queue over the car's music.
- Sign-out calls `clearBrowseTree`, because the engine keeps the last browse
  tree, encrypted, for a car that connects with the app closed.

`PlaybackSinkContext` owns which sink is selected and routes transport to it.
This replaced four copies of `if (activeDevice) castX()` in the player and a
three-term negation in the output sheet that decided whether "This device" was
the selected row — every new output had been adding another term to both.

## 3. `contentKind` — routing the player around non-song content

Every `Song` carries a required `contentKind: 'song' | 'liveStream' |
'podcastEpisode' | 'preview'`. One behaviour table in
`domain/playback/ContentKind.ts` says what each kind supports, and the player
reads it through these rather than comparing the kind itself:

- `isScrobbleable(kind)` — false for `liveStream` (a radio session isn't a listen)
- `isSeekable(kind)` — false for `liveStream` (infinite feed, no position)
- `isAutoplaySeed(kind)` — true only for `'song'` (radio and podcasts don't
  spawn autoplay recommendations)
- `hasDuration(kind)` — false for `liveStream`, so the progress bar hides and
  the timestamps go with it
- `hasReissuableUrl(kind)`, `isContinuous(kind)` — for a URL that can be
  fetched again, and for audio that never ends

Live streams are `Song`-shaped fabrications built by `buildStationSong`; the
title and streamUrl carry meaning, everything else is a placeholder that the
gates above hide.

A live stream also reaches the engine marked `continuous` (`isContinuous`,
set in `buildTrackItem`). That one is not a UI gate: yuzic-engine reads a
continuous track with a stream parser, and without the flag it treats a
station like a file and waits for the end of a broadcast, so no station starts.

Podcasts use `buildPodcastSong`. The bookmark manager treats podcastEpisode as
always-bookmarkable, so resume across sessions works for free.

**Why this shape**: radio and podcasts flow through the same player, the same
queue, the same lock-screen notification as songs. A wholesale queue-type
refactor was possible but touched every consumer of the current track. This
router shim gives the same effect with one field and a handful of intent-named
gates.

### Adding a new content kind

Widen the `ContentKind` union in `domain/playback/ContentKind.ts` and give the
new kind a row in its behaviour table — duration, scrobbleable, seekable,
autoplay seed, reissuable URL. The player reads those through `hasDuration`,
`isScrobbleable`, `isSeekable`, `isAutoplaySeed` and `hasReissuableUrl`, so a
kind declared there needs no branch anywhere else: callsites read
`isScrobbleable(song.contentKind)`, never `song.contentKind === 'song'`. A rule
that belongs to one control rather than to the kind (the 15-second jump buttons
hide on a preview, which is still seekable) lives beside that control.

## 4. `useSync` — the catalog pipeline

`src/features/library/useSync.ts` is the single library-sync path. It fetches lists
(albums, artists, playlists, tracks, starred, genres) from the active server,
writes them to the same query-cache keys the screens read, and stamps
`lastSyncedAt` when successful. Every "the library is out of date" path routes
through here:

- App foreground (`HomeLayout` fires `sync()` on `AppState.change → active`)
- Server switch (`HomeLayout` fires `sync()`)
- Post-download completion (`DownloadersQueueContext` fires `sync(true)` twice
  after a rescan nudge)
- Manual refresh (Settings → Library → last-synced row, `sync(true)`)
- **Pull-to-refresh on the library** (`useLibraryRefresh`, on the library index
  and every collection list, `sync(true)`)

That last one exists because the screens never refetch on their own. They read
at `staleTime: Infinity`, so between syncs the app cannot notice anything — a
playlist made on the server while the app was open did not appear, and the only
way to ask was to background the app for half an hour or dig into Settings. A
pull is the way to say *now*; the throttle stays where it is, because it is what
keeps the app off a server's back the rest of the time.

Two adjacent things that look like refreshes and are not:

- **Home's pull-to-refresh** bumps a `refreshKey` that reshuffles Home's own
  shelves and never touches the catalog.
- **"Scan library"** in the account sheet calls `api.auth.startScan()`, which
  asks the *server* to rescan its files. It does not refresh the app, and the
  results only arrive on a later sync.

A playlist's own screen is the one detail screen that refetches on focus
(`usePlaylistScreenModel`), because its tracks are not in the catalog's playlist
record: without it, a song added from another client stayed invisible until the
next sync.

`sync(force?: boolean)` throttles at 30 minutes by default; `force=true`
bypasses that throttle, and bypasses nothing else — every run that gets past it
refetches all six resources. `syncPlaylists()` refreshes only the playlist list
— cheaper for "user added a song, list needs to reflect it" cases.

**Server-scoped state**. Everything the sync writes is keyed by `activeServerId`
somewhere — album ids, playlist ids, stats. A server switch clears the slices
so ids from server A don't confuse a query against server B.

### Where the catalog is stored

At runtime the catalog is one array per resource in the query cache, read
through the keys in `CATALOG_RESOURCES`. That has not changed. What changed is
its shape **on disk**.

The catalog used to ride in the query persister's single blob, which is what
`createAsyncStoragePersister` does by default: the whole cache,
`JSON.stringify`'d to one key, rewritten on a one-second throttle whenever
anything in the cache changes, and parsed whole before first paint. The cost of
that is the size of the *library*, paid for *any* change — measured against the
real entity shapes, 98 MB and 0.7 s to parse at 80,000 tracks, 367 MB and 3.3 s
at 300,000, on desktop V8 before Hermes and a phone's heap are accounted for.
Users reported 10 s cold starts and a UI that stopped taking taps.

So the catalog has its own MMKV namespace and its own two halves:

- **`catalogPersistence.ts`** — one record per resource per server.
  `runCatalogSync` writes each resource it successfully fetched, and only
  those: a rejected fetch leaves the stored copy alone, because one flaky
  endpoint must not empty someone's offline library.
- **`useCatalogHydration.ts`** — reads them back at start, once the thread is
  idle, one resource at a time, **tracks last**. A sync that already filled a
  key wins; hydration never overwrites.

`app/_layout.tsx`'s `dehydrateOptions` is what keeps the two apart — it is the
one place that decides the catalog is not the persister's business, via
`isCatalogQuery`. Everything else still rides the blob, which is now small.

Two consequences worth knowing:

- **`queryClient.clear()` no longer clears the catalog.** Sign-out calls
  `clearCatalog()` alongside it (`AccountBottomSheet`). Anywhere else that
  means to forget a library has to do the same.
- **A resource that has not hydrated yet reads as `undefined`**, exactly as it
  does before a first sync, which every catalog hook already renders as
  loading. `undefined` means "ask the server" and an empty array means "the
  server has none" — under `staleTime: Infinity` the difference is whether the
  list is ever fetched again.

This deliberately does not change how much of the library is in memory. A
library too large to hold at all needs paged reads out of a real database,
which is a much larger change; this one makes the common case fast without
touching a call site.

### What it costs now, measured on the device

The figures above are desktop V8. Measured in Hermes on an iOS 26.5 simulator
against a real 4,826-track Jellyfin library, the catalog serializes to 5.9 MB:
tracks 5.31 MB (1,100 B each, 42 ms to parse), albums 533 KB (832 B each),
artists 39 KB (357 B each). Linear in tracks, that is about 88 MB and 0.7 s at
80,000, and 330 MB and 2.6 s at 300,000 — close enough to the estimates above
to treat them as confirmed rather than theoretical.

Where those bytes go is the part worth knowing. Averaged over 400 real tracks,
`artist` costs 254 B and `album` 252 B — **46% of every track is a whole artist
and a whole album denormalized into it**, and both are already held once each
in the `artists` and `albums` arrays synced beside it. In that library the same
album is serialized about 7.5 times over and the same artist about 44 times.

So the ceiling is a schema problem before it is a storage-engine one: tracks
holding references rather than copies would roughly halve the catalog before
any paged-reads work begins. Issue #284 carries the numbers and the order to do
it in.

### Adding a new library-shaped resource

Add it to `CATALOG_RESOURCES` in `catalogQueries.ts` — a cache key and a fetch,
nothing else — and read the result out of `runCatalogSync` by name. If it's
per-server, key by `activeServerId`.

That table is also what persistence is derived from, so a resource added to it
is stored, hydrated and kept out of the persister's blob without anything else
being written. A resource that skips the table and fetches into a catalog-shaped
key of its own gets none of that, and lands back in the blob — which for a
library-sized list is the 98 MB problem above, reintroduced one resource at a
time.

**Do not give it a `staleTime`.** The sync fetches with `staleTime: 0`
deliberately, and the temptation to reuse the screens' value is the bug this
section used to recommend: those are `Infinity`, the query cache is persisted
across restarts, and under them `fetchQuery` resolves from disk without ever
asking the server. The catalog then froze at whatever the last forced sync
found — new albums on the server never appeared. The 30-minute throttle in
`useSync` is what keeps re-syncs cheap; that is the only rate limit this
pipeline gets.

## 5. Reachability — offline, and the server being gone

Two different signals, and using the wrong one is the recurring bug:

- **`useIsOffline`** — the device has no network (NetInfo).
- **`useServerUnreachable`** — the device is online but the *music server* is
  not: Tailscale down, server rebooting, DNS moved. NetInfo reports online, so
  nothing offline-related engages on its own and every request instead hangs to
  its own timeout. `ServerReachabilityWatcher` pings while the flag is set and
  clears it on the first success.

`useServerReachable()` in `features/connectivity` is the two of them together,
and is what a surface should ask when the question is "can I call the server".

Three shapes of consumer:

1. **Has a synced fallback** (albums, artists, playlists, tracks, starred) —
   `useOfflineFirstQuery`. It folds both signals in, serves library data when
   the server can't be asked, and returns `degraded` so the screen can say the
   data is local rather than fresh.
2. **Has a local equivalent but isn't a query** — search. See
   `features/search/searchLegs.ts`: the legs are decided before any fetch, and a
   *server* scope falls back to the local index rather than to nothing.
3. **Has no local equivalent** (radio, podcasts, shares, the server-backed Home
   shelves) — gate `enabled` on `useServerReachable()` and render an offline
   empty state. These have nothing to degrade *to*, so the honest answer is to
   say so rather than spin into a load failure.

**A skipped leg is not a failed leg.** Anything that reports both needs two
flags: attempting a request that cannot land, catching the timeout, and calling
it an error is how offline search came to show a red banner over results that
had actually succeeded.

## 6. Entity model — `EntityCore`, `LocalId`, and one row per kind

Every artist/album/track is *one* entity shape carrying a resolution state,
not a `local` type shadowed by a parallel `External` type. This replaced four
duplicated pairs (Album/Song rows, Album/Song options) and two album-screen
bodies' worth of divergence.

- **`EntityCore`** (`domain/entities/EntityCore.ts`) — the four fields every
  entity has: `localId`, `nativeId`, `provenance`, `externalIds`. All four are
  **required**; they were optional while the model was being migrated, and
  every consumer then had to decide what an absent one meant, which they did
  not all decide the same way. Where a record came from is data on the record
  (`provenance`), not a second type — the same `AlbumRow`/`SongRow` renders a
  library album and an external one, and only the badge and primary action
  differ.

  There was a `LibraryState` enum here — `'in-library' | 'wanted' |
  'acquirable' | 'external'` — resolved by `resolveLibraryState` and read
  through `useLibraryState`. It was deleted in September 2026 because nothing
  read it: the rows ask the questions they actually need (`provenance.origin`,
  `selectIsWanted`, download progress) rather than collapsing them into one
  state first.
- **`LocalId`** (`domain/identity/LocalId.ts`) — a stable, on-device identity built by
  `makeLocalId()` from *origin* ids (server+item, or externalSource+nativeId),
  **never** from display metadata. Identity is deliberately separate from
  *matching* (`features/library/matchToLibrary.ts`, which is mbid-first then normalized
  title/artist): a server-originated and an external-originated record for the
  same album have **different** `LocalId`s and are related by matching, not by
  identity. Server adapters stamp `localId` from `client.serverId` (guarded — a
  missing server id yields no id rather than a wrong one).
- **Wanted is read where it is needed.** `selectIsWanted(localId)`
  (`state/redux/selectors/wantsSelectors.ts`), used by
  `features/entity-actions/shared/wantActions.ts` — the Wants system is its own
  feature (`features/wants/`), and `want` is its own action in the
  entity-action registry, distinct from `get`.
- **`useExternalAlbumStatus` still exists on purpose.** It reports in-flight
  **download progress %**, which the state enum does not carry. It reads the
  shared `DownloadersQueueContext` rather than polling — there is exactly one
  poll per downloader in the app, and this is one of its readers. The shared rows call it only for external-origin entities
  (it no-ops on a null album), so a plain library row makes no queue calls.
  This is a deliberate split of concerns, not leftover duplication.
- **Two album bodies remain** (`LocalAlbumBody` vs `ExternalAlbumBody`) even
  though the screen is one state-driven screen: external tracks resolve only to
  30s previews with different playback capability, a real behavioural
  difference the row layer already encodes but the list bodies keep explicit.
  Converging them is a deferred, higher-risk option, not an accident.

## 7. Providers and capabilities

A feature asks *what can do this*, never *which product it is*. Two mechanisms
answer that, and which one a job uses depends on how many providers can do it.

- **Typed capabilities, served by a broker**, for jobs more than one provider
  can do. `providers/contracts/Capabilities.ts` is a map of capability name to
  the function a provider supplies — `artist.enrich` (biography and tags),
  `catalogue.album`, `catalogue.search`. A provider
  (`providers/contracts/Provider.ts`) declares `Partial<CapabilityMap>` plus
  its presentation, auth tier and `testConnection`. `providers/registry/capabilityBroker.ts`
  answers "who can serve this, in what order": a provider must declare the
  capability, be reachable, and be allowed by the user's policy for that
  feature, and enumeration never invokes one. The declared providers today are
  the keyless integrations in `providers/registry/keyless.ts` (Deezer,
  MusicBrainz, Last.fm, LRCLIB); `enrichmentBroker.ts` serves Last.fm for artist
  biography and tags.
- **Pictures are one rule, not a capability.** Every artist and album image,
  wherever it is drawn (tile, row, hero, player, CarPlay), goes through
  `features/artwork/coverResolution.ts`: (1) the item's own source — mappers
  put it on the cover, or write a gap as `{ kind: 'none', subject }` naming who
  the image is of (`coverOrMissing`/`missingCover` in `domain/entities/Cover.ts`);
  (2) the library's copy of the same item, matched by MBID then name; (3) the
  Metadata › Artwork backups declared in `providers/registry/coverBackups.ts`,
  in `sources.ts` order (Cover Art Archive by MBID, then Deezer by name);
  (4) the placeholder. A subject names a credit's lead artist
  (`leadArtistName`: "A feat. B" is A, "Simon & Garfunkel" stays whole), so a
  featured credit from any service or server matches its library copy and the
  catalogue alike. `buildCover` applies steps 1–2 and remembered answers
  synchronously; `MediaImage` (via `useResolvedCover`) asks the backups and
  re-renders when an answer lands. `CoverResolutionHost` feeds it the library,
  the enabled backups and online state. Answers are remembered per source and
  subject in MMKV (misses for a week, hits for a month, failures not at all) —
  never written onto the entity, so switching a backup off restores the
  placeholder at once. A mapper must say "no image" honestly: Jellyfin/Emby
  check `ImageTags` (`itemCover`), Deezer's empty-hash silhouette is no picture
  (`imageCover`), Navidrome 0.64+ omits `coverArt`. No list, fetcher or screen
  looks pictures up itself.
- **Feature-owned registries**, for jobs with one provider each and behaviour
  no shared contract carries. Downloads are `features/downloaders/registry.ts`
  (`DownloaderDefinition`: `downloadAlbum`/`downloadTrack` with per-call
  options and error codes, plus `fetchQueue` normalised to
  `DownloaderQueueItem[]` so nothing downstream branches on which downloader a
  transfer came from, and `cancelQueueItem`). Autoplay and Smart Shuffle fill
  come from `features/playback/queueProviders.ts` (the similarity service —
  AudioMuse, declared in `providers/registry/similarityService.ts` — first, the
  server's own similar songs next, then the seed artist's top songs and random
  library tracks). Each tier is asked in turn until one answers, because
  similar songs comes back empty for any track its source does not know, and an
  empty fill on the last track ends the queue. Play Similar stops at the
  similarity tiers. Scrobbling routes through
  `state/redux/selectors/scrobbleRoutingSelectors.ts` and the offline mutation
  queue. Playlist generation is `features/playlist/generateSimilarPlaylist.ts`.
  External-source name resolution is `features/sources/registry.ts`.
- **Why the second kind is not a capability.** Similarity, discovery,
  playlist generation, scrobbling and acquisition were declared as
  capabilities once, beside the features above, and nothing ever asked the
  broker for them. The declarations were thinner copies — no queue
  over-sampling, no downloader options or error codes, no offline replay — so
  they were removed rather than wired in. A capability is added when its
  first consumer exists; when a job gains a second provider, it becomes one,
  shaped by both.
- **Server adapters stay their own concern.** The active server's `ApiAdapter`
  (`providers/contracts/ServerAdapter.ts`) is required core, not an optional
  integration, and features call it through `useApi`. How each server connects,
  signs in, lists libraries and builds cover URLs is declared in
  `providers/registry/serverConnections.ts`.
- **One Connections screen** (`features/settings/connections/`) is generated from
  the provider list and replaced the two separate Integrations/Downloaders hubs.
  Per-provider detail screens and their deep-link routes are unchanged.

## 8. Wants and Get — intent is not acquisition

A **want** is a save-only declaration of intent; **Get** is the separate act of
acquiring. The two are deliberately different code paths.

- **`wantsSlice`** (`state/redux/slices/wantsSlice.ts`) is per-server, persisted,
  and **pure/save-only** — no reducer performs or triggers acquisition, so a
  wishlist works with zero providers connected. A want carries `localId`,
  `title`/`artist` (so it renders with no lookup), `externalIds`, `unit`,
  `origin`, and an optional `jobRef` it only *references*.
- **Whether something is wanted** is read straight from
  `selectIsWanted(localId)` wherever it is needed — `wantActions.ts` for the
  action, the rows for their badge. There is no intermediate state model; see
  §6 for the one that was deleted and why.
- **Get** is `GetReviewSheet` (replaced the old fire-and-forget `DownloadSheet`):
  it always opens a compact review (target server, unit-compatible provider
  selection, a "Requesting…" line) and the confirm button is **disabled until a
  provider is chosen**, so a job never starts from a hidden default. A per-unit
  default provider (and, for Lidarr albums, a quality profile) persists **only**
  when the user ticks "save as default"; a per-request override is request-only.
- **Arrival is presence-based, not queue-based.** `findArrivedWants`
  (`features/wants/arrival.ts`) matches wants against the *synced library index*
  (reusing `features/library/matchToLibrary.ts`), and `useWantArrivalWatcher` removes a fulfilled want
  + toasts once when its entity appears **by any route** (a Get, a manual copy, a
  Bandcamp purchase). It is not gated on `jobRef`. The
  `DownloadersQueueContext` poll still runs untouched — it *causes* the rescan
  that makes arrival observable; only the completion *signal* moved off
  queue-disappearance. There is no "Arrived" collection; Recently Added serves it.
- **One Downloads screen** (`features/downloads/`) shows on-device **Offline** and
  server-side **Downloaders** as distinct sections (never conflated), the latter
  surfacing all activity a provider reports including jobs started outside yuzic,
  reading the single shared `useDownloadersQueue` poll.

## 9. Feature-oriented settings — configure the goal, not the provider

Settings pages are organized by what the user wants yuzic to *do*, not by which
integration supplies it. `features/settings/home/` set the precedent (pulling
Home-affecting toggles out of the per-integration screens); Scrobbling, Lyrics,
Metadata, and Search follow it. Each reuses the `SettingsScreen` shell and is a
route leaf registered in `settings/_layout.tsx` with a row on the settings root.

- **Scrobbling** (`features/settings/scrobbling/`) — exactly one route *per
  destination, per server*: `disabled | through-server | direct`, stored in
  `settingsSlice.scrobbleRoutes[serverId]`. The single enum per destination makes
  "at most one route" structural (no double-scrobble). Defaults are *derived at
  read time* from the pre-existing booleans (`deriveScrobbleRoute`), so no
  migration runs. **Last.fm offers only disabled/through-server** this cut
  (direct needs a signed session — sequenced out). `useScrobbling` routes by the
  enum; a duplicate-risk note shows on `through-server` (yuzic can't verify
  server forwarding).
- **Lyrics** (a list on the Metadata screen, `features/lyrics/resolveLyrics.ts`) —
  server-embedded first, then the enabled external sources in the fixed order
  `providers/registry/sources.ts` declares; `resolveLyrics`
  returns the first non-empty result. **LRCLIB** (`providers/integration/lrclib/`) is the launch
  external source: `none`-tier, no key, *one* source that prefers synced and
  falls back to plain internally. Off by default → server-only behaviour is
  unchanged until a user enables it.
- **Metadata** (`features/settings/metadata/`) — backups the user switches on
  for what the server lacks: **Artist info** (Last.fm `artist.getInfo` bio and
  tags, through `enrichmentBroker.ts`/`resolveArtistDetails`), **Artwork**
  (Cover Art Archive, Deezer — the cover resolution rule in §7, for every
  picture including outside artists') and **Lyrics** (LRCLIB). The server's own
  value always goes first (Navidrome's `getArtistInfo2` bio, Jellyfin's
  Overview and Genres, Plex's summary and Genre). **Display-only and
  gaps-only**: nothing is written to any server or onto an entity, so disabling
  instantly restores the server view. A small "via X" line, never per-item badges.
- **Search** (`features/settings/search/`, `features/search/searchLegs.ts`) — a segmented
  **Your Library** (default, no external calls) / **Other sources** scope with a
  Filters sheet for search-enabled sources and entity types. `planSearchLegs`
  picks library **XOR** external by scope, so results are never mixed by default;
  provenance is preserved and editions/ambiguous matches stay separate.
  `searchSourcesEnabled` is independent of Home enablement (legacy
  `deezerSearchEnabled` reconciled at read time, no migration).

## 10. Discovery — local-first, provider mixes, and generated playlists

Home discovery is off by default and layered so the local tier always works
with zero external calls.

Home shelf personalization is additive and tier-safe: `settingsSlice` stores
per-shelf visibility and per-tier ordering, while selectors fall back to the
original visible/order values when a key is absent. `customizeHomeSections`
filters and orders only the sections supplied for one tier, preserving the
resume → library → source-group hierarchy. `homeShelfLength` uses bounded
compact/standard/generous choices, surfaced in Home settings and read through
defaults.

- **Local-first mix** (`features/home/components/LocalMixSection`) seeds from
  on-device play-stats/genres (a deterministic daily seed via the existing
  `getDailySeed`/`seededShuffle` — **no new recommendation algorithm**) and
  expands through the server adapter's `api.similar.getSimilarSongs` (server-
  native, includes the user's server plugins). It makes **zero external-service
  calls** and is *not* gated behind the external-discovery toggles — it lives in
  the local/server tier, presence-checked on play history + server similarity.
- **ListenBrainz `createdfor` shelves**
  (`providers/integration/listenbrainz/recommendations/getCreatedForPlaylists`,
  `LBCreatedForSection`) fetch the user's daily-jams / weekly-jams /
  weekly-exploration mixes (public endpoint) and render **one standalone shelf
  each** under the compact ListenBrainz `SourceGroup` header — LB built the mix,
  yuzic fetches and renders it (no mix-generator; the raw CF endpoint is
  deliberately not built). Off by default; unowned tracks get Want/Get for free
  through the shared `SongRow`.
- **Make a playlist from this** (`features/playlist/generateSimilarPlaylist`)
  derives a seed from a track, album, or artist and asks AudioMuse for similar
  tracks; **AudioMuse's results become a playlist on the server** (no
  yuzic-local playlist store). The gesture is gated on `useCanGeneratePlaylist`,
  which asks whether AudioMuse is configured — it is the only generator, so
  there is no capability for it (§7). Track/entity-seeded only (mood-centroid
  deferred).
- **Onboarding asks once** (`features/onboarding/discovery`): a single transparent
  opt-in for external discovery (Deezer/ListenBrainz, no accounts, exactly what
  gets sent), guarded by `onboardingDiscoveryPrompted` so it shows once and only
  inside the onboarding flow — existing users never see it.

## 11. Listening — one record, one model, one question

Playback used to write a counter: `songPlays[key] += 1`, once a listen passed
the scrobble threshold. Everything else about the listen was discarded at the
moment it was known, and the worst of it was structural — a track abandoned at
twenty seconds never reached the threshold, so **the strongest negative signal
the app receives left no trace at all**.

There is a log now, in `state/redux/slices/listeningSlice`, written *before*
any threshold from the same departure that triggers a scrobble. It is not
scrobbling and must not be confused with it: scrobbling reports a listen
outward under somebody else's rules, this records what happened locally under
none. They share a trigger and nothing else.

**Shape.** A ring of the last `MAX_EVENTS` events, plus per-entity rollups for
tracks, albums, artists and playlists that are *never* evicted — so a lifetime
play count cannot fall as the ring wraps, and album ranking does not depend on
how recently the events happened to be written.

**One model in front of it.** `features/listening/listenerModel` is the single
surface every feature asks. The policies underneath stay pure and separately
tested; the model composes them. Callers state a **purpose** rather than
choosing a formula:

| purpose | used by | policy |
| --- | --- | --- |
| `continue` | autoplay fill | habits forward, skips back, volume ignored |
| `shuffle` | Smart Shuffle | every track kept, odds tilted from what is abandoned |
| `favourite` | ranked shelves | recency-weighted affection |
| `rediscover` | `SetAsideAlbums` | its inverse — loved and dropped |

Adding a shelf means adding a purpose, not inventing a ranking, and the fact
that `continue` avoids what `favourite` seeks is legible in one file.

**Three rules that are not obvious.**

- **Volume is never a reason to play something again.** Neither `continue` nor
  `shuffle` has a familiarity term. Ranking by what is already played most is
  the narrowing that turns a large library into a small one — Spotify's own
  research has organic listening more diverse than programmed listening — and
  an app whose entire corpus is the user's own collection has no business
  importing it. A *habit* ("you play B after A") is a fact about sequence and
  is used; volume is a fact about totals and is not.
- **Influence ramps.** Below `ENOUGH_TO_KNOW` events the model says nothing;
  from there to `CONFIDENT_AT` its effect scales. A threshold alone is a cliff
  — nineteen events and nothing is personalised, twenty and every queue
  reorders at once.
- **An interruption is not a rejection.** A lost stream and a deliberate skip
  look identical from a playhead position, so the error path says which it was.
  Without that, every dropped connection reads as dislike, and the app
  mislearns hardest about the listeners with the worst connections.

**Keys.** `serverId:nativeId`, built only through `listenerKey`'s `entityKey` /
`relatedKey`. A mismatch between the code that writes the log and the code that
reads it is completely silent — the model looks up keys that are not there,
finds nothing about anybody, and leaves every list in the order it arrived.
That has already happened once, and lint, typecheck, the architecture gates and
the whole suite passed while it was true. Never hand-build one of these keys.

**Reconciling with the server.** `statsSelectors` merges the log with what the
server reports, by `Math.max` rather than by addition. The counter this
replaced was an optimistic overlay that was *deleted* once the server's own
count arrived including it; a log is the listener's history and is never
deleted, so summing would double-count every listen both sides know about,
permanently. Artists and playlists have no server half at all — no Subsonic or
Jellyfin server reports one — so for them the log is simply the truth, which is
why `useLegacyStatsMigration` exists and is not optional.

### The numbers in here are reasoned, not measured

Every constant below was argued for and none has been checked against real
listening. They are collected here so that stays visible:

| constant | value | what it decides |
| --- | --- | --- |
| `isRejection` floor | 8s | how much scrubbing is not a dislike |
| `isRejection` share | 50% | how early a skip has to be to count |
| `AFFINITY_HALF_LIFE_DAYS` | 180 | how fast affection decays |
| `MAX_EVENTS` | 4000 | how far back sequence questions can see |
| `ENOUGH_TO_KNOW` / `CONFIDENT_AT` | 20 / 200 | when the model starts and fully applies |
| `MAX_SEQUENCE_BOOST` | 3 | how far a habit may lift a candidate |
| `MAX_REJECTION_PENALTY` | 4 | how far a skipped track may fall |
| `SESSION_GAP_MS` | 30min | where one sitting ends and the next begins |

The app now measures all of this — **Settings → Listening** shows skip rate,
average completion and the hour histogram. Tune these *against a week of real
data*, not against argument. The ordering matters: a constant defended before
it is measured is one that gets defended afterwards because it already shipped.

## 12. The theme — one object, derived palettes

The app's look is data: a single `Theme` in the appearance slice, edited by
`editTheme` and read through `useActiveTheme()`. It holds the accent, a light
and a dark palette, shape (corner radius, list density, text size), surface
(background source, blur, dim, cover tint) and components (dock shape,
tab labels, player layout).

Three rules keep it honest.

**A palette is derived, not typed in.** `derivePalette` takes the three
colours a person actually picks — background, card, text — and works out the
rest: borders, muted fills, placeholders, overlays. `ensureContrast` then
pushes text until it reads against both the page and a card, falling back to
whichever of black and white reads best when nothing clears the bar. That is
why picking one colour changes several: the other values are functions of it.

**"Dark" is the background's shade, not the mode.** `drawsDark(colors)` reads
the resolved background's luminance, because a person may give the *light*
palette a black background. The status bar, the dock's blur tint, ripples and
skeletons all follow that rather than `useColorScheme()` — getting this wrong
is invisible in tests and obvious on a phone: a dark status bar on a black
page has no pixels at all.

**What sits on the accent is decided against the accent.** `colorsFor`
derives `onThemeColor` rather than storing it, because a stored white failed
on five of the six shipped accents (yellow at 1.44:1) and an accent taken
from a cover can be any colour.

Read a theme value through `useActiveTheme()`/`useTheme()`, never at module
import time: a static read cannot change when the theme does, and the whole
point of this is that it changes.

## Where things live

```
src/app/                — Expo route files only; each renders a feature's screen
src/domain/             — entities, identity, library state, playback kinds

src/providers/
  contracts/            — ServerAdapter.ts (the adapter every server
                          implements, and every optional shape), Capabilities,
                          Provider
  registry/             — provider declarations, the capability and
                          enrichment brokers, useApi (the active server's
                          adapter)
  http/                 — fetchWithTimeout, coalesceRequest
  server/
    navidrome/          — Subsonic client + endpoints, jukebox client
    media-browser/      — the Jellyfin/Emby protocol and the adapter both
                          brands share; jellyfin/ and emby/ are the brand
                          bindings over it
    plex/               — Plex JSON adapter, PIN sign-in, direct-part streaming
    local/              — private-file importer, MMKV index, local adapter
  integration/
    deezer/             — external catalog client (discovery, samples)
    musicbrainz/        — canonical metadata client
    lastfm/             — bundled-key read-only client (similar-artists)
    listenbrainz/       — scrobbling and read-only recommendations
    lrclib/             — synced lyrics
    audiomuse/          — the acoustic-similarity service client
    lidarr/, slskd/, soulsync/, downtify/ — downloader clients

src/features/           — one directory per feature: its screen, components,
                          hooks and logic together
  playback/
    PlayingContext.tsx  — the player. Consumes the server adapter,
                          dispatches into playbackSlice, checks contentKind
                          before every player-shape decision. Talks to
                          PlayerBackend, never to a player package directly.
    useScrobbling.ts    — scrobble + now-playing (server-forwarded to
                          Last.fm/LB on Navidrome, session events on
                          Jellyfin/Emby)
    useBookmarkManager.ts — local bookmark map + server mirror
    useQueueSync.ts     — server-mirror for the playback queue
    usePlaybackPersistence.ts — the bridge between PlayingContext and
                          playbackSlice
    queueProviders.ts   — autoplay queue fill (server similar songs, AudioMuse)
  player/
    backend.ts          — PlayerBackend: the surface the app uses (§ above)
    createEngineBackend.ts — yuzic-engine behind it, plus the shadow that lets
                          a bridged engine answer synchronous getters
    activeBackend.ts    — builds it, hands it out, one per launch
    mediaItem.ts        — the app's own playable-item type, formerly the
                          player package's
    audioSettings.ts    — crossfade and equalizer shapes, bands and presets
    usePlayerState.ts   — the reactive half: progress, playing, active item
    playbackSink.ts     — where the audio comes out (§ above), a separate
                          question from which player produces it
    PlaybackSinkContext.tsx — which output is selected, and where transport
                          commands go
    DlnaContext.tsx, useDlnaDiscovery.ts — the DLNA output
    PlayingScreen.tsx, playingBar/ — the player UI
  library/
    useSync.ts          — the catalog pipeline (§4)
  album/, artist/, song/, playlist/, genre/ — entity screens, repositories
                          and query hooks
  home/, search/, library/, downloads/, wants/, onboarding/, settings/,
  podcasts/, radio/, shares/ — the remaining screens with what they own
  downloaders/          — Lidarr + slskd + SoulSync + Downtify registry and queue
  offline/              — downloads: policies, filesystem, the job queue,
                          DownloadContext, and the offline mutation queue that
                          replays scrobbles and edits made without a connection
  sources/              — external catalog registry (Deezer, MB)
  theme/                — the theme (one editable object), derived palettes,
                          useTheme/useActiveTheme, cover accent, backgrounds
  connectivity/         — offline and server-reachability state
  artwork/              — cover URLs for every provider, and the image cache

src/state/              — app state
  credentials.ts        — keystore-backed secrets, never in Redux
  redux/                — slices + selectors + store setup
  query/                — queryKeys, staleTime, useOfflineFirstQuery, usePollWhile
  mmkvStorage.ts        — the non-Redux key-value store
src/components/         — shared visual primitives, and the interaction helpers
                          they share (haptics, useSheetRef, formatDuration)
src/constants/          — app-wide values only: design tokens, public keys, the
                          app version, the favorites playlist id
src/types/              — ambient declarations for packages without types
```

Redux lives under `src/state/` rather than inside the features that read
it, and that is deliberate rather than unfinished. Most of these slices are
not feature-local: `serversSlice` is imported from roughly forty
directories, `statsSlice` from eleven. Moving a slice into a feature would
make every one of those directories reach through that feature's internals
to read state it co-owns. The two that genuinely are feature-shaped
(`searchHistorySlice`, `playbackSlice`) are not worth splitting out to
leave the rest behind — one whole state layer is easier to follow than a
half-moved one. What was wrong was the old address, `src/utils/redux`,
which filed the app's state under miscellany.

## The four small unforced rules

- **Optional method + presence check, not provider switch.** Every time a
  feature landed as `if (activeServer.type === 'navidrome')` in a review,
  it got rewritten as `if (api.<feature>)` before merging. What the adapter
  can't express, `providers/registry/serverConnections.ts` does: it holds the per-provider
  facts that aren't API calls — the demo, cover URLs, and `libraryScope`, the
  `auth` key each provider stores its chosen libraries under. `activeServer.type`
  is for naming a server to the user and tagging data with its origin; it is not
  how you decide what the app can do.
- **Local first, server as sink.** State the app can produce locally lives
  locally; server sync is a mirror. Playback state is the canonical example.
- **Toggles for privacy and bandwidth, not for "we couldn't pick a default".**
  Every switch is a decision the user has to make. Undecidable-by-design
  gets a switch; sub-flavors of the same integration don't.
- **The `contentKind` router beats a queue-type refactor.** Radio and podcasts
  flow through one player. Anything that goes wrong on non-song content is a
  gate that hasn't been added yet, not a wholesale rewrite waiting.
