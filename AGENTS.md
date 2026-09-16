# Agent instructions for yuzic

## Docs map

Read the doc that covers what you're touching before you touch it — these are
kept current, and a change that contradicts one is a change that needs the doc
updated in the same commit.

| Doc | Read it before |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Adding a server provider, a player behaviour, a persisted playback field, or a synced library resource. Covers `ApiAdapter`, `playbackSlice`, `contentKind`, `useSync`, and where things live under `src/`. |
| [`docs/integrations.md`](docs/integrations.md) | Adding or changing a server, integration, or downloader, or calling a new endpoint on one. Carries the endpoint tables and the list of endpoints we deliberately don't call. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, the three CI gates, E2E. |
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

- `.github/workflows/pr-checks.yml`: lint (`npm run lint`), typecheck (`npx tsc --noEmit`), and tests (`npx jest --ci`) on every push/PR to `master` and `dev`. Keep this green — it's what branch protection gates on.
- `.github/workflows/android-build.yml` / `ios-build.yml`: build and ship to Play's alpha track / App Store Connect (TestFlight only — `submit_for_review: false`, never public review). Runnable manually (`workflow_dispatch`) or called by the release workflow (`workflow_call`). No manual version inputs — see below.
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
- **iOS**: `latest_testflight_build_number` twice — for the current version train and for the app overall — highest + 1. App Store Connect only enforces uniqueness *within* a version, so the second question is what stops a new build landing underneath an existing one.
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

**What the stores held when this changed (2026-09-07)**, as a sanity check
rather than a source of truth — the next run should come out one above these:
- Play: production **1.3.7 / 109**, alpha **1.4.0 / 132** (a `workflow_dispatch` upload on 2026-09-05). The rejected 2.0.0 attempt was code 118.
- TestFlight: **2.0.0 / 94**, plus the release run's stranded **2.0.0 / 10**.

So the first run on the new mechanism should say `Using Android version code:
133` and `Using iOS build number: 95`. Anything much lower means something
local answered instead of the store.

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

Run `python3 tools/store-screenshots/publish.py --check` before a release. It
asserts the exact store sizes for the screenshots *and* for Play's icon and
feature graphic, because every one of these rejections lands **after** the
build rather than before it.

**Enabling a new upload path exposes assets nothing has ever validated.** The
oversized icon sat in the repo for the app's whole life and was harmless until
the flag that uploads it was turned on. When switching on a publish step, audit
every file it will now send — not only the ones being added.

## Native/player notes

- Audio playback goes through **`PlayerBackend`** (`src/features/player/backend.ts`), not through a player package directly. yuzic-engine implements it; `@rntp/player` was removed. Two differences between the platforms are declared in the engine's `Tools/parity.py`: `configureCache` has no Android implementation (deliberately *absent* rather than stubbed, so it rejects by name at the bridge), and `BrowseNode.artworkHeaders` is carried on the bridge but unusable on Android, where Media3 fetches a browse row's cover itself with no hook for a request header. Derive those from `parity.py` rather than trusting this sentence: it has been wrong before. `docs/architecture.md` explains the seam and the three non-obvious things about it; read that before changing playback.
- Adding a player call means adding it to `PlayerBackend` **and to both platforms of the engine**. A method implemented on iOS and not on Android is the failure this seam exists to surface — it has already happened. Ask `Tools/parity.py` in the engine repo how many are outstanding rather than reading a count here: this file has carried a stale one twice, and the tool compares signatures as well as names. They reject by name (`setSpeed() is not implemented on android`) rather than throwing `is not a function`, so the gap is legible from a log; that is not the same as being fixed.
- `@rntp/player` used to be the player and has been removed entirely. Do not reintroduce it, and do not read its source: it is the npm-scoped continuation of `react-native-track-player` and went to a commercial, non-compete licence at v5, which is a probable GPL-3 conflict for yuzic and a definite F-Droid blocker — and which is part of why the engine exists. react-native-track-player **v4** is Apache-2.0 and may be referenced with attribution.
- `src/features/playback/PlayingContext.tsx` is the central playback state/controls context — most player-related work touches this file.
- The engine lives in its own repo (github.com/yuzicapp/yuzic-engine) and is consumed as a pinned git dependency. **The pin drifts.** Bumping it once and then making further engine commits leaves the app building an engine older than the one you are reading, and it has caused two wrong conclusions already. Check `package.json` against the engine's HEAD before trusting that a fix is in the build.

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
  and the preset reads as half-applied. A round control is the trap here:
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
