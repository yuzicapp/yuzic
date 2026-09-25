# Maestro E2E

Maestro is used for black-box E2E coverage of the installed mobile app.

## Setup

Install Maestro locally:

```sh
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
```

Start the app with your normal Expo/dev-client workflow and make sure a simulator or device is connected:

```sh
npx expo start
```

Then run:

```sh
npm run test:e2e:smoke
```

or all Maestro flows sequentially:

```sh
npm run test:e2e
```

Individual suites: `test:e2e:flows` (common user flows), `test:e2e:details`
(detail screens, options sheet, player), `test:e2e:ratings` (the five-star
rating row and its sheet), `test:e2e:onboarding` (first-run onboarding).

`ratings.yaml` is the one flow that **writes to the server**: it rates a track
one star and then clears it, so the track ends as it started. It is also the
only one whose subject may legitimately not be there — ratings are a Subsonic
capability, so on a Jellyfin, Emby or Plex server the row is deliberately
absent and the flow skips its body rather than failing.

## Getting an authenticated app state

`smoke.yaml`, `common-user-flows.yaml`, and `detail-flows.yaml` assume the app
is already connected to a server with library content. `onboarding-demo.yaml`
provides that from a fresh install without real credentials: it walks first-run
onboarding and taps "Use Navidrome demo", which connects to the public
`demo.navidrome.org` server.

It needs fresh app state (no server configured). On a release build,
uninstall/reinstall is enough. On an Expo dev build, don't use Maestro's
`clearState` — it also wipes the dev client's saved Metro URL and the next
launch lands on the dev-client launcher instead of the app. Clear only the
app's MMKV storage instead:

```sh
xcrun simctl terminate booted <bundle-id>
rm -rf "$(xcrun simctl get_app_container booted <bundle-id> data)/Documents/mmkv"
```

Note: the demo server rate-limits cover art (HTTP 429), so covers render as
placeholders there — that's the server, not the app.

## Current Coverage

- App launches without crashing.
- First-run onboarding connects via the Navidrome demo (`onboarding-demo.yaml`).
- Authenticated shell can move between Home, Library, and Search.
- The library index opens a screen per entity type (albums/artists/playlists/
  tracks); album, artist, and playlist detail screens open from there and
  navigate back through the collection screen to the index (the playlist step
  is skipped when the server has no playlists).
- Long-pressing a track opens the song options sheet.
- Tapping a track starts playback, the player bar appears, the full player
  opens from it, the queue view toggles in and out, and the close button
  dismisses the player.
- Search has its own tab, accepts input, and renders a no-results state.

The suite intentionally avoids assumptions about specific song titles or
server fixtures.

## In CI

`.github/workflows/e2e.yml` runs five of the flows — `launch`, `onboarding-demo`,
`smoke`, `common-user-flows`, `detail-flows` — on a macOS runner, on demand
from the Actions tab. There is deliberately no nightly: it was red for weeks
without anyone noticing, and each run is forty minutes of a macOS runner. `ratings.yaml` and `store-screenshots.yaml`
stay local. It builds the app for the simulator in
Release — Debug would expect Metro and the flows would end up driving a dev
client's launcher — installs it on whichever iPhone simulator the runner image
actually has, and runs the flows in the order below. `onboarding-demo` goes
first because it is the only one that starts from a fresh install, and it is
what leaves the app connected to a server for the three that follow.

It is deliberately **not** a PR gate. The flows depend on `demo.navidrome.org`,
which is someone else's server: it rate-limits, and it is sometimes down. A
red run there means "look at this", not "your change is rejected" — gating
merges on a third party's uptime is how a check gets ignored.

On failure the run uploads Maestro's screenshot and view hierarchy for the
failing step, the xcodebuild log, and a screenshot of the simulator.

`testIds.test.ts` runs with the unit tests and checks that every element the
flows reach for still exists in the source. It cannot tell whether a flow
passes — only that a renamed testID hasn't silently broken one, which is the
failure that actually happens between nightly runs. It reads untracked files
too, so a screen added but not yet committed still counts.

Gotcha for future sheet-based flows: @gorhom/bottom-sheet defaults
`accessible=true` on its container, which collapses everything inside into
one opaque iOS accessibility element — child testIDs become invisible to
Maestro (and unreachable for VoiceOver). The player sheet passes
`accessible={false}` to fix this; do the same on any new sheet whose inner
controls need testIDs.
