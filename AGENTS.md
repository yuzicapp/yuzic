# Agent instructions for yuzic

## Docs map

Read the doc that covers what you're touching before you touch it — these are
kept current, and a change that contradicts one is a change that needs the doc
updated in the same commit.

| Doc | Read it before |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Adding a server provider, a player behaviour, a persisted playback field, or a synced library resource. Covers `ApiAdapter`, `playbackSlice`, `contentKind`, `useSync`, and where things live under `src/`. |
| [`docs/integrations.md`](docs/integrations.md) | Adding or changing a server, integration, or downloader, or calling a new endpoint on one. Carries the endpoint tables and the list of endpoints we deliberately don't call. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, the CI gates, E2E. |
| [`.maestro/README.md`](.maestro/README.md) | Adding or changing an E2E flow, or working out why one failed. |
| This file, below | Any UI work, and anything under `.github/workflows/` or `fastlane/`. |

**Keep them in sync.** A new integration, downloader, or outside endpoint
belongs in `docs/integrations.md`, and a new load-bearing pattern in
`docs/architecture.md` — in the same change, not afterwards. `README.md` is
the concise user-facing product overview and download entry point. Update it
when a headline product promise or supported-server set changes; keep detailed
support boundaries in `docs/`.

## Branch model

- `dev` is the long-running integration branch. Push work here (directly or via PR) — do not delete it after merging.
- `master` is the stable/release branch. Promote work from `dev` to `master` via a PR (e.g. #137), not by pushing directly.
- **A merge to `master` that changes `package.json`'s `version` ships.** `release-on-version-bump.yml` fires on the push and calls both build workflows, which upload to TestFlight and Play's alpha track. There is no separate "publish" step to forget or to hold back at — opening that PR *is* the release decision, so treat it as one.
- Both branches have GitHub branch protection requiring the `Lint, Typecheck & Test` check (from `.github/workflows/pr-checks.yml`) to pass before a PR can merge. Repo admins can bypass this for direct pushes — it does not block `git push` outright.

## CI

- `.github/workflows/pr-checks.yml`: lint (`npm run lint`), typed routes, typecheck (`npx tsc --noEmit`), tests (`npx jest --ci`) and the architecture gates (`npm run architecture:check`) on every push/PR to `master` and `dev`. Keep this green — it's what branch protection gates on.
- `.github/workflows/android-build.yml` / `ios-build.yml`: build and ship to Play's alpha track / App Store Connect (TestFlight only — `submit_for_review: false`, never public review). **`workflow_call` only** — there is no `workflow_dispatch` on either, so a release is the one thing that can ship. No manual version inputs — see below.
- `.github/workflows/e2e.yml`: the Maestro suites on an iOS simulator, on demand only — not a PR gate and not a nightly, because the flows sign in through a public demo server and each run is forty minutes of a macOS runner. See [`.maestro/README.md`](.maestro/README.md).
- `.github/workflows/release-on-version-bump.yml`: on push to `master`, if `package.json`'s `version` field changed from the previous commit, automatically calls both build workflows.

## Version numbers — the stores are asked, never told

Android versionCode and iOS build number are **queried from Play and App Store
Connect at build time** and must never be typed in per-run. Both stores require
a number greater than what they already hold, so they are the only things that
know the right answer; anything computed locally is a guess that is wrong the
moment a build is entered a different way.

The mechanism (see `fastlane/Fastfile`):
- `VERSION_LABEL` (e.g. `2.0.0`) is read directly from `package.json` at build time — single source of truth, never passed as a workflow input.
- **Android**: `google_play_track_version_codes` across *all four* tracks (internal, alpha, beta, production), highest + 1. All four, because a code live anywhere is a code Play will not accept again — and production has historically sat *below* alpha here.
- **iOS**: every build upload App Store Connect holds — `Spaceship::ConnectAPI.get_build_uploads`, the 200 most recent — highest + 1 across *all* versions. `latest_testflight_build_number` answers a narrower question and is deliberately not used: sorted by upload date with a limit of one, it returned 10 where the app already had 94, which is how 2.0.0 shipped underneath an existing build.
- There is deliberately **no override and no fallback**. If the store cannot be reached the build fails; it does not invent a number. The old code fell back to `Time.now.to_i`, which would have spent about 1.7 billion of a 2.1 billion version code ceiling in one upload, irreversibly.

**Do not reintroduce a locally-derived number.** The previous mechanism was
`GITHUB_RUN_NUMBER` plus a fixed offset, described here as a per-workflow-file
counter that "never resets or repeats". That is true of a `workflow_dispatch`
and **false of a `workflow_call`**: a reusable workflow sees the *caller's* run
number. So the same build had two counters — the dispatch path reached
versionCode 132 while the release path was still at 118 — and 2.0.0 was refused
by Play with `You cannot rollout this release because it does not allow any
existing users to upgrade to the newly added APKs`, after a fully green Gradle
build. On iOS the same skew was silent and worse: the release uploaded 2.0.0
build **10** underneath the dispatch path's 2.0.0 build **94**, which App Store
Connect *accepted*, leaving testers on the older-numbered build.

**What the stores held at the last release**, as a sanity check rather than a
source of truth — the next run should come out one above these:

- 2.11.0 (2026-09-25): TestFlight build **132**, Play version code **153**.
- 2.10.0 (2026-09-24): TestFlight build **131**, Play version code **152**.
- When the mechanism changed (2026-09-07): Play production **1.3.7 / 109**,
  alpha **1.4.0 / 132**; TestFlight **2.0.0 / 94**, plus the release run's
  stranded **2.0.0 / 10**. The rejected 2.0.0 Play attempt was code 118.

A number much below the latest line means something local answered instead of
the store. The release run now prints both on its summary — see the `verdict`
job — so this is a cross-check rather than the only record.

**Play release notes** come from
`fastlane/metadata/android/en-US/changelogs/`. There cannot be a
`<version code>.txt` any more — the code is only known once Play has been asked
— so notes live in `default.txt`, which supply falls back to, and
`skip_upload_changelogs: false` is set explicitly to keep it that way. Update
`default.txt` as part of a release; it is capped at **500 characters** by Play.

## Releasing — check both halves

A release is **two independent jobs**, and one can succeed while the other
fails. That has now happened twice. On 2026-09-04 the 1.4.0 release shipped iOS
to TestFlight and was rejected by Play in the same run. On 2026-09-07 the 2.0.0
release did it again for a different reason (the run-number skew above),
leaving the two platforms on different versions and the GitHub release stuck as
an empty draft both times. Nothing announced this — the workflow simply showed
as failed, and a failed release looks the same whether nothing shipped or half
of it did.

**A succeeded job is not a shipped release either.** 2.0.0's iOS half reported
success while uploading a build number below what TestFlight already had, so
testers never saw it. Check the number that actually landed, not the tick.

So after any release:

1. Open the `release-on-version-bump` run and check **both** `Ship iOS build`
   and `Ship Android build`, not just the run's overall conclusion.
2. Read the `Using Android version code:` / `Using iOS build number:` lines out
   of the logs and confirm each is higher than the last release's. They are
   queried from the stores now, so they should be — this is the check that
   proves the query happened rather than something local answering.
3. Fill in and publish the draft release the run created. It is generated with
   an empty body and stays a draft until someone writes it, which is why the
   public releases page can lag the actual shipped version by months.
4. If one platform failed, say so explicitly rather than re-running blind. The
   fix usually belongs on `dev` and has to be promoted before a re-run can
   possibly succeed — which is exactly what did not happen after 1.4.0.

**Play requires `targetSdkVersion` 36** (Android 16) for uploads to any track,
alpha included. Below that, `supply` fails with `Google Api Error: Invalid
request - Target SDK of artifact is too low`, *after* a full successful Gradle
build — so a green build says nothing about whether Play will take it. Set in
`android/gradle.properties` and `app.json`.

## Store listing images ship with the build, and can lose it

Screenshots are generated by `tools/store-screenshots/capture.sh` and copied
into fastlane's tree by its `publish.py`; both upload steps are enabled, so a
version bump replaces the live listings. Two traps cost the whole of **2.2.0**,
which failed on *both* platforms without a byte reaching either store — after a
24-minute Gradle build and a successful Xcode archive:

- **`skip_upload_images` is not the screenshot flag.** It covers the icon,
  feature graphic, promo graphic and TV banner. Setting it false made `supply`
  upload `images/icon.png` — 4167×4167 where Play demands exactly 512×512 — and
  a refused image **aborts the entire edit**, taking the AAB and the track
  update with it. Play had already answered `versionCode 137`; none of it was
  committed. Screenshots alone means `skip_upload_screenshots: false` **with**
  `skip_upload_images: true`.
- **`deliver` asks a question.** Uploading screenshots makes it render a
  `Preview.html` and prompt `Does the Preview ... look okay for you?`. On a
  runner nobody answers and it does **not** fall back to a default — it raises
  `FastlaneCrash: Could not retrieve response as fastlane runs in
  non-interactive mode` *before* uploading the binary. `force: true` is what
  makes screenshot upload survivable; without it, enabling screenshots loses
  the build as well as the screenshots.
- **Fastlane before 2.239.0 duplicates screenshots.** App Store Connect can
  leave a new image in `UPLOAD_COMPLETE` briefly without assigning its checksum.
  Older `deliver` versions treated that in-flight image as missing and uploaded
  it again, so the 2.2.2 Apple listing showed two copies of every screenshot
  while Play's listing was correct. Keep the Gemfile lower bound at 2.239.0 or
  newer; that release waits for the checksum/status and removes failed pending
  uploads before retrying (fastlane #30094/#30150).

**Screenshots upload on a release, and a release is now the only build.**
`ci_ios` reads `YUZIC_UPLOAD_SCREENSHOTS`, which `ios-build.yml` states as a
constant `true`. It is stated rather than deleted because the Fastfile compares
the string exactly, so an unset variable reads as false and skips the upload in
silence — and because the guard still earns its keep for a `fastlane ci_ios`
run from a laptop, which has no business touching the public listing.

The reason it exists is the one above restated: the upload carries the
screenshots *and* the binary, screenshots first, so anything the store refuses
there loses a fully archived build. On 2026-09-19 two dispatched builds off
`dev` died fifteen minutes in with `Failed verification of all screenshots
deleted... 10 screenshot(s) still exist`.

Those dispatches are why the hand-run path is gone (2026-09-19). It existed
mainly to test off `dev`, which is exactly what the store kept refusing, and a
build that reaches TestFlight without a version behind it is one nobody can
point at afterwards. Both platforms lost the trigger together so they cannot
drift into shipping by different routes.

**So a failed half is re-shipped by bumping the version, not by re-running.**
That re-ships the platform that already succeeded, which is the cost of having
one route; the release checklist above already says not to re-run blind, and
the fix belongs on `dev` and has to be promoted either way. Being selective happens
*after* the build: everything lands in TestFlight and Play's alpha, and
promoting to public review stays a deliberate, manual act in each console.

**The binary and the listing are two uploads now, in that order.** They were
one `upload_to_app_store` call doing both with the screenshots first, which is
the mechanism behind every one of the failures above: the store objects to
something about an image and a fully archived build is discarded. Each earlier
fix addressed the particular objection — the oversized icon, the interactive
prompt, the duplicate uploads — and the coupling survived every time and found
a new way to spend a build.

`upload_to_testflight` now ships the binary on its own, and the screenshot
upload runs after it inside a `rescue`: it logs loudly and does not fail the
lane. A listing one release out of date is a far smaller problem than a release
that did not ship.

**A submitted version's screenshots cannot be replaced, and `deliver` asks
anyway.** This is what actually killed those two builds, and the message names
it once you read past the summary line:

```
Failed to delete screenshot en-US APP_IPHONE_65
The request cannot be fulfilled because of the state of another resource.
  - Can't Delete Screenshot After Submit for review appScreenshots
```

`deliver` chooses its target with `get_edit_app_store_version`, and that
filter counts `WAITING_FOR_REVIEW` as editable. Apple does not: once a version
is submitted, its screenshots are frozen. Both builds carried version label
2.6.3 while 2.6.3 sat in review, so `overwrite_screenshots` tried to delete the
live set, got a `409` per set, and — because the delete happens *before* the
upload — took the rest of the step with it. Deliver retries five times, which
cannot help against a state lock; that is why all ten survived every attempt
and why the failure reproduced exactly.

`screenshots_replaceable?` in the `Fastfile` now asks for the version's state
first and skips the listing unless it is one of `PREPARE_FOR_SUBMISSION`,
`DEVELOPER_REJECTED`, `REJECTED`, `METADATA_REJECTED` or `INVALID_BINARY`. It
is an allowlist so an unfamiliar state leaves the listing alone rather than
gambling a release on it.

The practical consequence for a release: **upload screenshots before submitting
for review, not after.** If a listing change is needed for a version already
submitted, it has to go through the next version — no re-run will place it on
the current one.

Run `python3 tools/store-screenshots/publish.py --check` before a release. It
asserts the exact store sizes for the screenshots *and* for Play's icon and
feature graphic, because every one of these rejections lands **after** the
build rather than before it.

**Enabling a new upload path exposes assets nothing has ever validated.** The
oversized icon sat in the repo for the app's whole life and was harmless until
the flag that uploads it was turned on. When switching on a publish step, audit
every file it will now send — not only the ones being added.

## Native/player notes

- Audio playback goes through **`PlayerBackend`** (`src/features/player/backend.ts`), not through a player package directly. yuzic-engine implements it; `@rntp/player` was removed. One difference between the platforms is declared in the engine's `Tools/parity.py`: `configureCache` has no Android implementation (deliberately *absent* rather than stubbed, so it rejects by name at the bridge). Derive that from `parity.py` rather than trusting this sentence: it has been wrong before. `docs/architecture.md` explains the seam and the three non-obvious things about it; read that before changing playback.
- Adding a player call means adding it to `PlayerBackend` **and to both platforms of the engine**. A method implemented on iOS and not on Android is the failure this seam exists to surface — it has already happened. Ask `Tools/parity.py` in the engine repo how many are outstanding rather than reading a count here: this file has carried a stale one twice, and the tool compares signatures as well as names. They reject by name (`setSpeed() is not implemented on android`) rather than throwing `is not a function`, so the gap is legible from a log; that is not the same as being fixed.
- `@rntp/player` used to be the player and has been removed entirely. Do not reintroduce it, and do not read its source: it is the npm-scoped continuation of `react-native-track-player` and went to a commercial, non-compete licence at v5, which is a probable GPL-3 conflict for yuzic and a definite F-Droid blocker — and which is part of why the engine exists. react-native-track-player **v4** is Apache-2.0 and may be referenced with attribution.
- `src/features/playback/PlayingContext.tsx` is the central playback state/controls context — most player-related work touches this file.
- The engine lives in its own repo (github.com/yuzicapp/yuzic-engine) and is consumed from npm at an exact version (`yuzic-engine` in `package.json`). **The pin drifts.** Bumping it once and then making further engine commits leaves the app building an engine older than the one you are reading, and it has caused two wrong conclusions already. Check `package.json` against the engine's HEAD before trusting that a fix is in the build. An engine release is `npm publish` from a machine logged in to npm, *then* pushing the `vX.Y.Z` tag: the tag's workflow only confirms npm serves that version and creates the GitHub release, it does not publish.

## Native config that `app.json` cannot express

`expo-build-properties` covers most of it, but not everything, and the pieces
it does not cover live in `plugins/` as local config plugins registered in
`app.json`'s `plugins` array. There is one so far:

- **`withUserCaTrust.js`** writes `res/xml/network_security_config.xml` and
  points the manifest at it, so Android trusts the user's own CAs. Without it
  the platform ignores a user-installed root from API 24 up, and a server
  behind a private CA — Caddy's `tls internal`, typically — is unreachable on
  Android while iOS and every browser accept it.

Two traps here, both of which cost a real build if missed:

- **A network security config replaces `usesCleartextTraffic`, it does not add
  to it.** Omitting `cleartextTrafficPermitted` from the config turns `http://`
  servers off on API 28+, which is most of a LAN install.
- **The generated file is checked in, because nothing runs `expo prebuild` in
  CI.** The checked-in copy under `android/` is what ships; the plugin is what
  makes a prebuild reproduce it instead of dropping it. Change the plugin and
  regenerate, never the checked-in file alone — the same double-entry rule the
  orientation note under UI conventions describes.

## UI conventions

These were made consistent across the app in one pass; they drift back easily
because both halves of each pair look reasonable in isolation.

- **Loading**: skeletons (`components/Skeleton*`, or a screen's own
  `Loading.tsx`) when a list is loading, so the placeholder holds the shape the
  list is about to take. `components/SpinningLoaderCircle` everywhere else —
  inside a control at size 18, for a whole sheet or screen at 26. React
  Native's `ActivityIndicator` is deliberately unused: it renders differently
  per platform and doesn't match the lucide icon set the rest of the UI uses.
  A skeleton is only worth using when it predicts the real layout; an options
  sheet is a header and a stack of actions, so it keeps a spinner.
- **Scales**: sizes come from `typography`, corner radii from `radius`, padding
  and margin from `spacing`, all in `constants/design`, everywhere — `eslint.config.js` fails the build on a
  literal `fontSize` or `borderRadius` outside that file. A role carries a size
  and a line height; a weight may be overridden at the call site
  (`{ ...typography.rowSubtitle, fontWeight: '500' }`), since weight was never
  the thing that drifted. Adding a role is fine; adding one that differs from an
  existing role only in size is how the app got to thirteen font sizes and
  twelve corner radii in the first place. `0` stays a literal — it is the
  absence of spacing rather than an amount of it. Any scrolling list ends with
  `spacing.scrollClearance`, which is what keeps its last row clear of the
  playing bar; four different numbers were doing that job and the short ones
  didn't.
- **Spacing gaps**: `gap`, `rowGap`, and `columnGap` use the existing `spacing` scale; near-misses fold to adjacent steps, and ESLint rejects nonzero literals.
- **Motion and effects**: animation durations use `motion`; shadows/elevation use `shadow`; disabled and pressed opacity uses `stateLayer`. ESLint rejects raw values outside `constants/design`.
- **Tap targets**: a control may be drawn smaller than `controlSize.minimumTarget`
  — a 34pt toggle beside a 34pt pill is the right drawing — but what the finger
  has to hit never is. `hitSlopFor(size)` makes up the difference; it returns
  undefined when none is needed, so it can be spread unconditionally. Seven
  controls were between 32 and 40pt with nothing padding them out.
- **Naming controls**: a pressable that draws no text carries an
  `accessibilityLabel`, from the `a11y.*` namespace in `locales` like any other
  string — `eslint-rules/touchable-needs-label` fails the build otherwise. One
  that *does* draw text does not: a screen reader reads the text already, and a
  label repeating it is a second copy to keep in sync. So the rule looks for
  readable content in the subtree and only asks where it finds none. 32 controls
  were silent, including every transport control on the player, and the labels
  that did exist were hardcoded English — a French UI read aloud in English.
  A role says what a thing is, never which one, so it is never a substitute for
  a label: add both. A control with two states says the second through
  `accessibilityState`, one with more than two through `accessibilityValue` —
  shuffle cycles through three, and a label that changed with the mode would
  read as a different button each time.
- **Text size**: `typography` scales its own leading by the system text size
  (`withScaledLeading`), because React Native scales `fontSize` and leaves
  `lineHeight` where it was written — at the accessibility sizes a 20pt role
  renders at 60pt in a 25pt box and every title in the app is sliced in half.
  Text inside a control whose height is structural — the playing bar, an avatar
  disc — takes a `maxFontSizeMultiplier` from `fontScaleCap` **and** its role
  from the matching `cappedTypography` set. One without the other is the
  mismatch that turns the bar into half a screen: the cap holds the glyphs but
  not the line box they sit in. `allowFontScaling={false}` is not the answer to
  either — it ignores the user's setting outright.
- **Pressing**: `components/Touchable`, never `TouchableOpacity` — the whole app
  was swapped over in one pass and there is no reason for a second answer to a
  press to exist. Android gets a ripple bounded to the component, every other
  platform an opacity dip, from one file so they can't drift apart per screen.
  `feedback="control"` for a bare icon whose target is bigger than the glyph,
  `"none"` for a wrapper handling a press on something else's behalf. There is
  deliberately no `activeOpacity`: seven different values were in use, which is
  seven answers to a question nobody was asking.
- **Cover colour**: `features/theme` extracts one accent from a piece of cover
  art and darkens it. `useCoverAccent` is the hook; `pickAccent` and `darken`
  are pure and tested, because the extraction library returns a different shape
  per platform and that choice is the part worth checking. The accent is null
  until it arrives, so a screen fades it in rather than flashing a placeholder.
  Do not re-extract colours locally — the cache is shared and bounded. Null is
  also what the hook returns when the user has turned cover tinting off, so no
  call site needs a branch for the setting.
- **Appearance settings**: the scales a user can move — corner radius
  (`useRadius`) and list density (`useListDensity`) — are read through a hook,
  never imported statically, or the surface silently opts out of the setting
  and the preset reads as half-applied. Those hooks, `useTheme` and cover
  tinting all read one object, the theme (`features/theme/theme.ts`, read
  through `useActiveTheme`): palettes for both schemes, accent, shape, surface
  and component choices. There is one theme, stored in `settingsAppearance`
  and edited in place by every appearance setting; there are no presets to
  pick between. Its colours come from three picks per scheme through
  `derivePalette` (`features/theme/presets.ts`, the only file allowed to spell
  a theme colour out), which also pushes text until it reads. Home can be
  drawn over a photo or the playing cover (`features/theme/ScreenBackground`):
  a screen that draws it makes its own containers transparent, and the veil
  over the image is the theme's background colour, so text keeps reading.
  Nothing reads
  the settings that make up the theme except `useActiveTheme` and the
  appearance editors; `theme.test.ts` fails on a component that does.
  A round control is the trap here:
  `radius.pill` is for the things whose roundness is what they *are* (an
  avatar, a status dot, a radio fill, a progress track, an artist's photo) and
  stays round at every preset, while a **control** merely drawn as a pill or a
  circle — a play button, a button on a detail bar — uses `rad.pillFor(height)`
  and squares off with the cards under `sharp`. `size / 2` written out as a
  literal is the same mistake in a second spelling. Every one of them falls back in its
  selector rather than reading straight off the persisted settings blob: a user
  upgrading has one written before the key existed, and `undefined` reaches the
  style as a broken layout rather than as a default. Under the `default` option
  each hook returns exactly the number the app used before the setting existed,
  so adding one moves nothing until the user asks it to.
- **Landscape is a tablet shape, not a phone one.** A phone is portrait-locked:
  `app.json`'s `orientation` is `portrait`, which governs the iPhone array in
  `Info.plist`, while `supportsTablet` writes all four into
  `UISupportedInterfaceOrientations~ipad` whatever it says — so the two halves
  differ by design rather than by oversight. On Android the manifest says
  `screenOrientation="portrait"` and **Android 16 ignores that above 600dp**,
  which is not a bug working against us here: it is what leaves tablets and
  unfolded foldables free to rotate while phones stay put. Both native files are
  checked in and nothing runs `expo prebuild` in CI, so `app.json` alone changes
  nothing — edit all three or the change is cosmetic.

  None of this retires the layout work below. Split View, a half-open foldable
  and an Android window over 600dp are all still windows the app does not
  choose, and a phone still has a keyboard that takes half the screen.
- **The window, not the device**: every size that used to come from
  `useWindowDimensions` now comes from `features/layout` —
  `useWindowLayout` for the window itself, `useGridColumns` for a grid,
  `shelfItemWidth` for a horizontal shelf of covers (Home's and the album
  screen's alike; `getSectionItemWidth` is the same function under the name
  Home's shelves already called it), `useContentInset` for a list of rows,
  `libraryGutter` for the library-shaped lists that spell the same cap as
  padding, `playerLayout` for the player. None of
  them asks what device it is on: a phone on its side, an iPad in Split View
  at a third of the screen and a half-open foldable are each a *window*, and
  `Platform.isPad` answers none of them. Two rules keep the results honest.
  **A cap, not a stretch** — a row is the one shape that gets worse as it gets
  wider, so a column of them stops at `contentWidth.readable` and the leftover
  room becomes the padding that centres it (`centringInset`; a `FlashList`
  takes padding in `contentContainerStyle` and rejects everything else, which
  is why the cap is spelled that way). Anything full-bleed above or below the
  rows — a hero and its colour wash, a shelf of covers — gives the padding
  back with a negative margin, exactly as the library gutter already did.
  **More artwork, not bigger** — a grid or a shelf answers a wider window with
  more tiles, sized by `artworkScaleFor`, which grows with the square root of
  the window and stops at half again. Every one of these returns *exactly* the
  number the app drew before it existed at or below `REFERENCE_WIDTH`, which
  is the widest phone rather than the typical one, so no phone moved. A square
  is bounded by the window's height as well as its width (`squareArtSize`):
  sizing artwork off width alone is correct in portrait and asks for an 800pt
  cover in a 390pt-tall window the moment the phone is turned, which is what
  pushed the player's transport off the screen. The player has two shapes
  rather than one that stretches — see `playerLayout`, where landscape decides
  it, not the size class.
- **Home vs Library**: Home is what changes, Library is what's complete. A view
  that moves on its own — recently added, most played, what you were listening
  to — is a Home shelf; the stable, exhaustive, sortable list is a Library
  collection. The same data may appear in both, but never as the same thing
  twice: Home shows the first handful and its heading leads to Library's full
  version (`SectionShelfHeader`'s `onSeeAll`), landing on the entity list with
  the matching sort already applied.
- **Library entry vs sort order**: an entry row is one of the two things —
  a kind of thing the library holds (playlists, albums, artists, tracks) or a
  cross-cutting cut over them that a sort order can't express (genres, which
  is a hierarchy; downloaded, which is a filter). A time-ordered or play-ordered
  view of albums is not a row: it is the Albums row with a sort. "Recently
  added" would have been a row for the same reason "Most played" would be —
  neither is; both live in the sort sheet, and the changing view of each is
  the Home shelf.
- **Library navigation**: the library tab is an index, each row opening its own
  screen (`features/library/LibraryCollectionScreen`) — nothing else lives on it.
  It used to be a row of filter pills, which could only ever show the types it
  had room for — that is why genres had no way in for so long. Adding a way to
  browse means adding an entry row, not a pill and not a section. Deep pushes
  from a library row (a genre, a collection screen, an album from one of them)
  keep the Library tab lit — `_layout.tsx` remembers the last tab root you
  visited and holds it until you visit another, so the icon does not jump to
  Home the moment you leave `/library`.
- **Library gutter**: horizontal insets in the library come from
  `features/library/layout`, never from a literal. A list row and a grid cell
  each carry an inset of their own, so the list's padding is the difference
  that lands artwork exactly `spacing.page` from the screen edge in both modes.
  Anything drawn above the items — a header, the sort row — cancels that
  padding with a negative margin and keeps `spacing.page`, so all of it lines
  up on one edge.
- **A row is one accessibility element, so nothing tappable goes inside one**:
  `OptionSheetRow` wraps its whole contents — the `trailing` slot included —
  in a single `Touchable`, and React Native's `Pressable` is an accessibility
  element unless told otherwise. Five stars in a row's trailing slot would be
  five controls a screen reader can see and never reach, which is why the only
  other `trailing` in the app is inert text. Rating therefore has the sleep
  timer's shape: an ordinary registry row showing the current value
  (`RatingValue`, deliberately not pressable) that opens `RatingSheet`, where
  the stars are direct children of the sheet and are five radios again. It
  sits next to Favourite, which is the pair those two rows are meant to be —
  a favourite says "keep this where I can find it" (it builds the Favourites
  playlist and the CarPlay category, and it survives being offline), a rating
  says how much you like it. Everything about ratings is presence-gated on the
  adapter's `ratings` surface rather than on a provider name — row, player
  stars, Appearance switch and the "Rating" sort order all disappear together
  on a server without them; `docs/integrations.md` says which servers those
  are and why Plex is one of them.
- **Options live behind a `⋯`**: every detail-style screen — album, artist
  (browsed as well as owned), playlist, genre, radio, podcasts, shares, wants —
  puts its actions in an options sheet opened from a `⋯` on the right of
  `DetailHeader`/`DetailHeaderBar`, and every row or tile puts its own behind a
  `⋯` (a tile, having no room for one, answers a long press —
  `features/home/OptionsTile`). Sheets are built on `EntityOptionsSheet` and
  `OptionSheetPrimitives`; an entity kind's rows come from
  `features/entity-actions/registry`, and a screen-level list (radio stations,
  podcasts) builds `ResolvedAction`s directly, since a station is not a domain
  entity. Bare icon buttons on a row are how this drifts back: radio drew a
  pencil and a bin, shares three icons, podcasts a bin — one stray tap from the
  row you press to play, and each screen answering "what can I do with this"
  differently. A primary action may stay on the row (play an episode, download
  one); everything else, and anything destructive, goes in the sheet.
- **Sheets are one sheet**: anything that comes up from the bottom is a
  `BottomSheetModal` wearing the shared scaffold — `useOptionSheetBackground`
  for the surface (which is what makes its corners follow the user's radius
  preset), `renderBackdrop` (which is also what gives it Android's back
  button), a handle, `stackBehavior="push"`, and `useOptionSheetContentStyle`
  for padding that clears the home indicator. Height comes from the content:
  `enableDynamicSizing` for a fixed stack of rows, snap points only for a list
  whose length the sheet cannot know (an options sheet over a long info
  section, lyrics, the output picker while it scans). A percentage like `'40%'`
  on a sheet of five rows is the caller guessing at a height it does not lay
  out, and `sheetConventions.test.ts` fails on any sheet that skips the
  scaffold. Three are deliberately their own design and named in that test:
  `PlaylistList`, `SelectionBottomSheet`, and onboarding's scheme sheet, which
  is dark because the flow around it is.
- **Collection actions**: a screen led by artwork uses `DetailHeader`'s centred
  circle-and-pill pair. A screen without artwork uses
  `features/library/CollectionActions` — two square-shouldered halves of the
  content width, which have to carry the top of the screen on their own.
- **Translations**: every key added to `locales/en.json` is added to all four
  locales in the same change; `locales/locales.test.ts` fails otherwise. A
  missing key falls back to English mid-sentence, so it reads as a bug rather
  than as an untranslated string. The same test checks the other direction —
  every literal key the code passes to `t()` exists in `en.json` — because a
  string can also go missing by never arriving: seven surfaces (the tab bar,
  the Downloads screen, the display sheet, both Home banners) shipped their
  English inline as a `defaultValue` and were never translated into anything,
  in any locale, which the one-directional check could not see. Put the English
  in `en.json`, not in a `defaultValue`; keep the latter only for a key built at
  runtime, where there is nothing static to check.
- **Home**: sections are grouped into tiers by `features/home/homeLayout` —
  resume first and unlabelled, then your own library, then external discovery
  behind its source header. A new section belongs to exactly one tier, and the
  library tier stays short: it carries what changes on its own, not everything
  that could be shown. Discovery is off by default (each source's `homeShelves` use in `settingsSources`)
  and absent offline, so the local tiers are all a fresh install has — Home
  cannot be emptied out on the assumption that discovery will fill it.
