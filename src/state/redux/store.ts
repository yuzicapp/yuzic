import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';
import { reduxStorage as storage } from '@/state/mmkvStorage';

import serversReducer from './slices/serversSlice';
import downloadersReducer from './slices/downloadersSlice';
import audiomuseReducer from './slices/audiomuseSlice';
import settingsAppearanceReducer from '@/features/settings/appearance/state';
import { migrateAppearance } from '@/features/settings/appearance/themeStore';
import settingsHomeReducer from '@/features/settings/home/state';
import settingsSearchReducer from '@/features/settings/search/state';
import settingsSourcesReducer from '@/features/settings/sources/state';
import { importLegacySourceSettings } from '@/providers/registry/legacySourceSettings';
import settingsScrobblingReducer from '@/features/settings/scrobbling/state';
import settingsPlaybackReducer from '@/features/settings/playback/state';
import settingsDownloadsReducer from '@/features/settings/downloads/state';
import settingsSyncReducer from '@/features/settings/sync/state';
import settingsOnboardingReducer from '@/features/settings/onboarding/state';
import listenbrainzReducer from './slices/listenbrainzSlice';
import playbackReducer from './slices/playbackSlice';
import statsReducer from './slices/statsSlice';
import listeningReducer from './slices/listeningSlice';
import offlineMutationsReducer from './slices/offlineMutationsSlice';
import searchHistoryReducer, { normalizeSearchHistoryEntries } from './slices/searchHistorySlice';
import wantsReducer from './slices/wantsSlice';
import ratingsReducer from './slices/ratingsSlice';

// Returns undefined (→ initialState) only on version bump; otherwise passes state through.
const resetMigrate = (state: any, currentVersion: number): Promise<any> => {
  if (state?._persist?.version === currentVersion) return Promise.resolve(state);
  return Promise.resolve(undefined);
};

// v1 gave history entries a shape (query vs. opened entity); before that each
// entry was a bare query string. Lift the old strings instead of dropping them.
const searchHistoryMigrate = (state: any, currentVersion: number): Promise<any> => {
  if (state?._persist?.version === currentVersion) return Promise.resolve(state);
  const byServer = state?.byServer;
  if (!byServer) return Promise.resolve(state);
  const migrated: Record<string, unknown> = {};
  for (const [serverId, entries] of Object.entries(byServer)) {
    migrated[serverId] = normalizeSearchHistoryEntries(entries);
  }
  return Promise.resolve({ ...state, byServer: migrated });
};

// `credentialsHydrated` is a per-session clock tick (see serversSlice), not a
// fact about the user's servers — persisting it would let a stale `true` from
// the last session survive into a cold start, before this session's keystore
// read has actually happened, and nothing would ever flip it back on once
// hydration really does land.
const serversPersistConfig = { key: 'servers', storage, blacklist: ['credentialsHydrated'] };
const downloadersPersistConfig = { key: 'downloaders', storage };
const audiomusePersistConfig = { key: 'audiomuse', storage };
// The settings junk drawer (one `settings` key, 57 unrelated
// fields) is gone — each feature owns its own slice and its own storage key.
// These are new keys under the rewrite's storage namespace: there is no
// legacy `settings` blob to migrate from, so no `migrate` function and no
// version bump for that — a fresh install and an upgrading one look the same.
// Appearance has since had a change of its own: v1 moved the accent, corners, density, cover tint and dock into a stored
// theme. `migrateAppearance` carries the old choices across as a custom theme.
const settingsAppearancePersistConfig = {
  key: 'settingsAppearance',
  storage,
  version: 1,
  migrate: (state: any): Promise<any> => Promise.resolve(migrateAppearance(state)),
};
const settingsHomePersistConfig = { key: 'settingsHome', storage };
const settingsSearchPersistConfig = { key: 'settingsSearch', storage, version: 1 };
// Every outside-source switch, by use. The first read, with nothing stored
// yet, imports the switches that used to live in Home, Search, Metadata and
// Lyrics. Those records are only read, never rewritten here: stripping the
// old fields in their own migrations would race this read at startup, and a
// stale field nothing reads costs nothing. The Metadata and Lyrics slices are
// gone entirely.
const settingsSourcesPersistConfig = {
  key: 'settingsSources',
  storage,
  version: 1,
  migrate: async (state: any): Promise<any> => {
    if (state) return state;
    const uses = await importLegacySourceSettings(storage);
    return { uses, _persist: { version: 1, rehydrated: false } };
  },
};
const settingsScrobblingPersistConfig = { key: 'settingsScrobbling', storage };
const settingsPlaybackPersistConfig = { key: 'settingsPlayback', storage };
const settingsDownloadsPersistConfig = { key: 'settingsDownloads', storage };
const settingsSyncPersistConfig = { key: 'settingsSync', storage };
const settingsOnboardingPersistConfig = { key: 'settingsOnboarding', storage };
// Strips the per-server nowPlayingEnabled key the consolidation pass
// retired — same reasoning as the settings v3 migration.
const listenbrainzMigrate = (state: any, currentVersion: number): Promise<any> => {
  if (state?._persist?.version === currentVersion) return Promise.resolve(state);
  const byServer = state?.byServer;
  if (!byServer) return Promise.resolve(state);
  const cleaned: Record<string, any> = {};
  for (const [serverId, entry] of Object.entries(byServer)) {
    const { nowPlayingEnabled: _np, ...rest } = (entry as Record<string, unknown>) ?? {};
    cleaned[serverId] = rest;
  }
  return Promise.resolve({ ...state, byServer: cleaned });
};

const listenbrainzPersistConfig = {
  key: 'listenbrainz',
  storage,
  version: 1,
  migrate: listenbrainzMigrate,
};
// Playback is written on every track change and (throttled) every few seconds
// during play; a wipe on version bump is fine — the loss is at most whatever
// was mid-play when the app got the update.
const playbackPersistConfig = { key: 'playback', storage, throttle: 3000 };
const offlineMutationsPersistConfig = { key: 'offlineMutations', storage };
const searchHistoryPersistConfig = {
  key: 'searchHistory',
  storage,
  version: 1,
  migrate: searchHistoryMigrate,
};
// Save-only intent store; a saved want is cheap and rare (user taps) so no
// throttle is needed — matches downloaders/servers, which also write as-is.
const wantsPersistConfig = { key: 'wants', storage };
// Ratings the user gave since the last sync. Persisted for the same reason it
// exists at all: the catalog on disk still holds the pre-rating value, so an
// overlay that died with the process would show the rating vanishing on the
// next launch. Written on a tap and cleared by the next sync, so it stays
// small and needs no throttle.
const ratingsPersistConfig = { key: 'ratings', storage };

// Persist throttling. redux-persist writes on every dispatched action that
// mutates the slice; for slices that carry thousands of entries (library) or
// change on every second (playback), that's a JSON.stringify + MMKV write per
// action — measurable on cold-boot and playback. Throttling batches writes
// without changing any consumer's behavior.
//
//   playback: 3s — the position tick is throttled inside
//     usePlaybackPersistence to ~5s, but the queue slice also gets rewrites
//     from track advances; 3s catches both without piling up.
//   stats: 1s — an incrementPlay dispatch happens once per track change.
const statsPersistConfig = {
  key: 'stats',
  storage,
  version: 3,
  migrate: resetMigrate,
  throttle: 1000,
};
// listening: 1s, for the same reason as stats — one `recordListen` per track
// change. Deliberately *not* on `resetMigrate` like its neighbour: a wipe on
// version bump is fine for counters the server can re-supply, and this is the
// one slice nothing else can rebuild. Losing it is losing the user's own
// listening history, so a future shape change has to be migrated rather than
// reset. The event array is bounded by `MAX_EVENTS` precisely so this write
// stays small enough to belong on the same throttle.
const listeningPersistConfig = { key: 'listening', storage, throttle: 1000 };
// Genres used to live in a `library` slice; they are now a catalog
// query like the rest (`useGenres`), so the slice and its persist key are gone.
// The old on-disk payload is simply never read again.

/**
 * The slice tree without redux-persist. Tests only — the app runs the
 * persisted tree below. `store.test` holds the two to the same slice list.
 */
export const _rootReducer = combineReducers({
    servers: serversReducer,
    downloaders: downloadersReducer,
    audiomuse: audiomuseReducer,
    settingsAppearance: settingsAppearanceReducer,
    settingsHome: settingsHomeReducer,
    settingsSearch: settingsSearchReducer,
    settingsSources: settingsSourcesReducer,
    settingsScrobbling: settingsScrobblingReducer,
    settingsPlayback: settingsPlaybackReducer,
    settingsDownloads: settingsDownloadsReducer,
    settingsSync: settingsSyncReducer,
    settingsOnboarding: settingsOnboardingReducer,
    listenbrainz: listenbrainzReducer,
    playback: playbackReducer,
    stats: statsReducer,
    listening: listeningReducer,
    offlineMutations: offlineMutationsReducer,
    searchHistory: searchHistoryReducer,
    wants: wantsReducer,
    ratings: ratingsReducer,
});

const persistedReducer = combineReducers({
    servers: persistReducer(serversPersistConfig, serversReducer),
    downloaders: persistReducer(downloadersPersistConfig, downloadersReducer),
    audiomuse: persistReducer(audiomusePersistConfig, audiomuseReducer),
    settingsAppearance: persistReducer(settingsAppearancePersistConfig, settingsAppearanceReducer),
    settingsHome: persistReducer(settingsHomePersistConfig, settingsHomeReducer),
    settingsSearch: persistReducer(settingsSearchPersistConfig, settingsSearchReducer),
    settingsSources: persistReducer(settingsSourcesPersistConfig, settingsSourcesReducer),
    settingsScrobbling: persistReducer(settingsScrobblingPersistConfig, settingsScrobblingReducer),
    settingsPlayback: persistReducer(settingsPlaybackPersistConfig, settingsPlaybackReducer),
    settingsDownloads: persistReducer(settingsDownloadsPersistConfig, settingsDownloadsReducer),
    settingsSync: persistReducer(settingsSyncPersistConfig, settingsSyncReducer),
    settingsOnboarding: persistReducer(settingsOnboardingPersistConfig, settingsOnboardingReducer),
    listenbrainz: persistReducer(listenbrainzPersistConfig, listenbrainzReducer),
    playback: persistReducer(playbackPersistConfig, playbackReducer),
    stats: persistReducer(statsPersistConfig, statsReducer),
    listening: persistReducer(listeningPersistConfig, listeningReducer),
    offlineMutations: persistReducer(offlineMutationsPersistConfig, offlineMutationsReducer),
    searchHistory: persistReducer(searchHistoryPersistConfig, searchHistoryReducer),
    wants: persistReducer(wantsPersistConfig, wantsReducer),
    ratings: persistReducer(ratingsPersistConfig, ratingsReducer),
});

const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            immutableCheck: false,
            serializableCheck: false,
        }),
});


export type RootState = ReturnType<typeof store.getState>;

export default store;
