import React from 'react';
import { Text } from '@/components/Text';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';

import { useAlbums } from '@/features/album/useAlbums';
import { QueryKeys } from '@/state/query/queryKeys';
import { _rootReducer } from '@/state/redux/store';
import serversReducer, { addServer, setActiveServer } from '@/state/redux/slices/serversSlice';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';
import type { Server } from '@/providers/contracts/Server';
import type { Album } from '@/domain/entities/Album';

// This device never reaches the network in this test — offline for the
// whole run, and `useServerUnreachable` (a separate, module-scope signal —
// see `serverReachability.ts`) defaults to false, which is what "device
// offline" rather than "server unreachable while online" looks like.
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: false, isInternetReachable: false }),
}));

// `useApi()` would normally build a real adapter from the active server's
// type; the album list function below must never be called — offline means
// `useOfflineFirstQuery` disables the query before it would run, and this
// assertion-via-rejection catches a regression that fetches anyway.
const mockListAlbums = jest.fn(() => Promise.reject(new Error('offline: must not fetch')));
jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({
    albums: { list: mockListAlbums, get: jest.fn() },
    tracks: { list: jest.fn(), get: jest.fn() },
  }),
}));

const SERVER_ID = 'server-1';
const PROVENANCE = serverProvenance(SERVER_ID);

function testServer(): Server {
  return {
    id: SERVER_ID,
    type: 'jellyfin',
    serverUrl: 'https://example.com',
    username: 'u',
    isAuthenticated: true,
  };
}

function persistedAlbum(nativeId: string, title: string): Album {
  return {
    localId: makeLocalId('album', PROVENANCE, nativeId),
    nativeId,
    provenance: PROVENANCE,
    externalIds: {},
    title,
    cover: { kind: 'none' },
    artist: {
      localId: makeLocalId('artist', PROVENANCE, 'artist-1'),
      nativeId: 'artist-1',
      externalIds: {},
      name: 'Some Artist',
      cover: { kind: 'none' },
    },
    year: 2020,
    releaseType: 'album',
    genres: [],
    songIds: [],
  };
}

/**
 * In-memory stand-in for the MMKV-backed `queryCacheStorage` in
 * `mmkvStorage.ts` — same async-storage shape (`setItem`/`getItem`/
 * `removeItem`), so `persistQueryClientSave`/`PersistQueryClientProvider`
 * exercise the exact same persistence contract the app uses, without this
 * test depending on the (out-of-scope) MMKV module or native code. The
 * package exports no type for this shape, so it's spelled out here.
 */
interface PersistedDisk {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

function makeDisk(): PersistedDisk {
  const disk = new Map<string, string>();
  return {
    setItem: (key: string, value: string) => { disk.set(key, value); return Promise.resolve(); },
    getItem: (key: string) => Promise.resolve(disk.get(key) ?? null),
    removeItem: (key: string) => { disk.delete(key); return Promise.resolve(); },
  };
}

function AlbumsProbe() {
  const { albums, degraded, isLoading } = useAlbums();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="degraded">{String(degraded)}</Text>
      {albums.map(a => <Text key={a.nativeId}>{a.title}</Text>)}
    </>
  );
}

describe('offline cold start reads the persisted query cache', () => {
  it('renders the synced catalog offline from a freshly-restored QueryClient, with no Redux catalog copy', async () => {
    // Nothing in the real app's store shape carries a catalog slice any
    // more — this is the assertion that stops a second store growing back.
    // Checked against the actual `_rootReducer` from `state/redux/store.ts`,
    // not a hand-rolled test store, so a reintroduced `libraryAlbums` (or
    // sibling) slice fails this test directly.
    const realStoreShape = _rootReducer(undefined, { type: '@@INIT' });
    expect(Object.keys(realStoreShape)).not.toEqual(
      expect.arrayContaining([
        'libraryAlbums', 'libraryArtists', 'libraryPlaylists', 'libraryTracks', 'libraryStarred',
      ])
    );

    // --- Session 1: online, the album list gets fetched and cached, then
    // persisted to "disk" — standing in for what a prior app session did.
    const disk = makeDisk();
    const persister = createAsyncStoragePersister({ storage: disk });

    const albums = [persistedAlbum('a1', 'Album One'), persistedAlbum('a2', 'Album Two')];
    const firstSessionClient = new QueryClient();
    firstSessionClient.setQueryData([QueryKeys.Albums, SERVER_ID], albums);
    await persistQueryClientSave({ queryClient: firstSessionClient, persister });

    // --- Session 2: a cold start. A brand new QueryClient, offline, hydrated
    // only from what session 1 wrote to disk — nothing carried over in memory.
    const secondSessionClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Restored explicitly rather than through PersistQueryClientProvider: the
    // property under test is "session 2 sees what session 1 wrote to disk",
    // and the provider's live save-subscription would outlive the test.
    await persistQueryClientRestore({ queryClient: secondSessionClient, persister });

    const store = configureStore({ reducer: { servers: serversReducer } });
    store.dispatch(addServer(testServer()));
    store.dispatch(setActiveServer(SERVER_ID));

    // `render` is async in this testing-library version — it wraps the
    // initial render in `act`, so it must be awaited before querying.
    const { getByTestId, findByText, queryAllByText, unmount } = await render(
      <QueryClientProvider client={secondSessionClient}>
        <Provider store={store}>
          <AlbumsProbe />
        </Provider>
      </QueryClientProvider>
    );

    // The persisted catalog shows up without ever going out to the network.
    await findByText('Album One');
    expect(queryAllByText('Album Two')).toHaveLength(1);
    expect(mockListAlbums).not.toHaveBeenCalled();

    // Offline with cached data to show is exactly what `degraded` means now.
    expect(getByTestId('degraded').props.children).toBe('true');
    expect(getByTestId('loading').props.children).toBe('false');

    await unmount();
    // Clearing drops the cached data; unmounting stops the gc timers that
    // would otherwise hold the jest process open past the run.
    firstSessionClient.clear();
    firstSessionClient.unmount();
    secondSessionClient.clear();
    secondSessionClient.unmount();
  });
});
