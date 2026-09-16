import React, { type ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import wantsReducer, { addWant } from '@/state/redux/slices/wantsSlice';
import serversReducer, { addServer, setActiveServer } from '@/state/redux/slices/serversSlice';
import { makeLocalId , makeLocalId as makeDomainLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance , serverProvenance } from '@/domain/identity/Provenance';
import type { Server } from '@/providers/contracts/Server';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import { useWantArrivalWatcher } from '../useWantArrivalWatcher';

const WANT_1_LOCAL_ID = makeLocalId('album', integrationProvenance('deezer'), 'w-1');
const WANT_2_LOCAL_ID = makeLocalId('album', integrationProvenance('deezer'), 'w-2');
const WANT_3_LOCAL_ID = makeLocalId('artist', integrationProvenance('deezer'), 'w-3');

const mockToastSuccess = jest.fn();
jest.mock('@/components/toast', () => ({
  notify: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

// Library membership is driven directly through this mock so tests can move
// an album "into" the library between renders without a real synced-query
// cache. jest.mock calls are hoisted above all imports by Babel, so this
// takes effect for `useWantArrivalWatcher`'s own imports of these hooks
// above — the persisted TanStack Query cache is the real source now (see
// `useAlbums`/`useTracks`), but this unit test only needs their shape.
let mockAlbums: Album[] = [];
let mockTracks: Song[] = [];
let mockArtists: Artist[] = [];
jest.mock('@/features/album/useAlbums', () => ({ useAlbums: () => ({ albums: mockAlbums }) }));
jest.mock('@/features/song/useTracks', () => ({ useTracks: () => ({ tracks: mockTracks }) }));
jest.mock('@/features/artist/useArtists', () => ({ useArtists: () => ({ artists: mockArtists }) }));

const SERVER_ID = 'server-1';

function testServer(): Server {
  return {
    id: SERVER_ID,
    type: 'jellyfin',
    serverUrl: 'https://example.com',
    username: 'u',
    isAuthenticated: true,
  };
}

const PROVENANCE = serverProvenance(SERVER_ID);

function libraryAlbum(): Album {
  return {
    localId: makeDomainLocalId('album', PROVENANCE, 'lib-album-1'),
    nativeId: 'lib-album-1',
    provenance: PROVENANCE,
    externalIds: {},
    libraryState: 'in-library',
    title: 'Some Album',
    cover: { kind: 'none' },
    artist: {
      localId: makeDomainLocalId('artist', PROVENANCE, 'artist-1'),
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

function libraryArtist(): Artist {
  return {
    localId: makeDomainLocalId('artist', PROVENANCE, 'lib-artist-1'),
    nativeId: 'lib-artist-1',
    provenance: PROVENANCE,
    externalIds: {},
    libraryState: 'in-library',
    name: 'Some Artist',
    cover: { kind: 'none' },
    tags: [],
    albumIds: [],
  };
}

function makeStore() {
  return configureStore({
    reducer: {
      wants: wantsReducer,
      servers: serversReducer,
    },
  });
}

function wrapper(store: ReturnType<typeof makeStore>) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestStoreWrapper';
  return Wrapper;
}

beforeEach(() => {
  mockAlbums = [];
  mockTracks = [];
  mockArtists = [];
  mockToastSuccess.mockReset();
  mockPush.mockReset();
});

describe('useWantArrivalWatcher', () => {
  it('removes a want and toasts once when its album appears in the library', async () => {
    const store = makeStore();
    store.dispatch(addServer(testServer()));
    store.dispatch(setActiveServer(SERVER_ID));
    store.dispatch(
      addWant({
        serverId: SERVER_ID,
        want: { localId: WANT_1_LOCAL_ID, unit: 'album', title: 'Some Album', artist: 'Some Artist', origin: 'search' },
      })
    );

    const { rerender } = await renderHook(() => useWantArrivalWatcher(), { wrapper: wrapper(store) });

    expect(store.getState().wants.byServer[SERVER_ID]).toHaveLength(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();

    // The entity arrives in the synced library (any route — a Get, a manual
    // copy, Bandcamp — arrival detection doesn't care which).
    mockAlbums = [libraryAlbum()];
    await rerender({});

    expect(store.getState().wants.byServer[SERVER_ID]).toEqual([]);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);

    // A further re-render with the same library state must not re-fire —
    // the want is already gone, and the resolved-guard prevents any replay
    // even if the selector briefly still returned it.
    await rerender({});
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  it('offers a way into the copy that arrived, since the row has just gone', async () => {
    const store = makeStore();
    store.dispatch(addServer(testServer()));
    store.dispatch(setActiveServer(SERVER_ID));
    store.dispatch(
      addWant({
        serverId: SERVER_ID,
        want: { localId: WANT_1_LOCAL_ID, unit: 'album', title: 'Some Album', artist: 'Some Artist', origin: 'search' },
      })
    );

    const { rerender } = await renderHook(() => useWantArrivalWatcher(), { wrapper: wrapper(store) });
    mockAlbums = [libraryAlbum()];
    await rerender({});

    const [, options] = mockToastSuccess.mock.calls[0];
    options.action.onPress();

    // The server adapter's own id, which is what the detail route resolves by.
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/albumView', params: { id: 'lib-album-1' } });
  });

  it('resolves an artist want when the artist turns up, and links to their page', async () => {
    const store = makeStore();
    store.dispatch(addServer(testServer()));
    store.dispatch(setActiveServer(SERVER_ID));
    store.dispatch(
      addWant({
        serverId: SERVER_ID,
        want: { localId: WANT_3_LOCAL_ID, unit: 'artist', title: 'Some Artist', artist: 'Some Artist', origin: 'artist-page' },
      })
    );

    const { rerender } = await renderHook(() => useWantArrivalWatcher(), { wrapper: wrapper(store) });
    expect(store.getState().wants.byServer[SERVER_ID]).toHaveLength(1);

    mockArtists = [libraryArtist()];
    await rerender({});

    expect(store.getState().wants.byServer[SERVER_ID]).toEqual([]);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);

    const [, options] = mockToastSuccess.mock.calls[0];
    options.action.onPress();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/artistView', params: { id: 'lib-artist-1' } });
  });

  it('does not remove or toast for a want whose entity never appears', async () => {
    const store = makeStore();
    store.dispatch(addServer(testServer()));
    store.dispatch(setActiveServer(SERVER_ID));
    store.dispatch(
      addWant({
        serverId: SERVER_ID,
        want: { localId: WANT_2_LOCAL_ID, unit: 'album', title: 'Missing Album', artist: 'Nobody', origin: 'search' },
      })
    );

    await renderHook(() => useWantArrivalWatcher(), { wrapper: wrapper(store) });

    expect(store.getState().wants.byServer[SERVER_ID]).toHaveLength(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
