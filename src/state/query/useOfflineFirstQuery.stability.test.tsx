import React, { useEffect, useRef, useState } from 'react';
import { Text } from '@/components/Text';
import { act, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { usePlaylists } from '@/features/playlist/usePlaylists';
import { useArtist } from '@/features/artist/useArtist';
import { QueryKeys } from '@/state/query/queryKeys';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';
import type { Artist } from '@/domain/entities/Artist';
import serversReducer, { addServer, setActiveServer } from '@/state/redux/slices/serversSlice';
import type { Server } from '@/providers/contracts/Server';

// Offline, so the list query never runs: the catalog stays empty for the
// whole test, which is the state the bug needs.
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: false, isInternetReachable: false }),
}));

jest.mock('@/providers/registry/useApi', () => {
  const offline = () => jest.fn(() => Promise.reject(new Error('offline: must not fetch')));
  return {
    useApi: () => ({
      playlists: { list: offline() },
      artists: { list: offline(), get: offline() },
      // The catalog store reads all four list queries, so every one has to
      // exist even though none of them may run while offline.
      albums: { list: offline() },
      tracks: { list: offline() },
    }),
  };
});

const SERVER_ID = 'server-1';

function testServer(): Server {
  return {
    id: SERVER_ID,
    type: 'navidrome',
    serverUrl: 'https://example.com',
    username: 'u',
    isAuthenticated: true,
  };
}

async function renderWithCatalog(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = configureStore({ reducer: { servers: serversReducer } });
  store.dispatch(addServer(testServer()));
  store.dispatch(setActiveServer(SERVER_ID));
  // `render` is async in this testing-library version — it wraps the initial
  // render in `act` and has to be awaited before anything is read from it.
  const utils = await render(
    <QueryClientProvider client={client}>
      <Provider store={store}>{ui}</Provider>
    </QueryClientProvider>
  );
  return { client, ...utils };
}

describe('useOfflineFirstQuery with nothing cached', () => {
  it('hands back the same empty value on every render', async () => {
    const seen: unknown[] = [];
    let rerender: () => void = () => {};

    function Probe() {
      const { playlists } = usePlaylists();
      const [, setTick] = useState(0);
      rerender = () => setTick(t => t + 1);
      seen.push(playlists);
      return <Text>{playlists.length}</Text>;
    }

    const { client, unmount } = await renderWithCatalog(<Probe />);
    await act(async () => { rerender(); });
    await act(async () => { rerender(); });

    expect(seen.length).toBeGreaterThanOrEqual(3);
    // A fresh `[]` each render reads as "the playlists changed" to every memo
    // and effect keyed on it.
    for (const value of seen) expect(value).toBe(seen[0]);

    await unmount();
    client.clear();
    client.unmount();
  });

  // The fallback is derived by the caller now, from the catalog store, rather
  // than by this hook reaching into other cache entries. The guarantee is
  // unchanged and still worth pinning: opening artist B after artist A, with
  // the list unchanged between them, must show B.
  it('re-derives a fallback when the entity changes but its list does not', async () => {
    // `useArtist(id)` falls back to the artists *list*, whose key has no id in
    // it. A memo keyed only on the list's data would keep answering with the
    // first artist after the id changed — the screen showing the wrong one.
    const provenance = serverProvenance(SERVER_ID);
    const artist = (nativeId: string, name: string): Artist => ({
      localId: makeLocalId('artist', provenance, nativeId),
      nativeId,
      provenance,
      externalIds: {},
      name,
      cover: { kind: 'none' },
      tags: [],
      albumIds: [],
    });

    let setId: (id: string) => void = () => {};
    const names: (string | undefined)[] = [];

    function ArtistProbe() {
      const [id, setIdState] = useState('a1');
      setId = setIdState;
      const { artist: found } = useArtist(id);
      names.push(found?.name);
      return <Text>{found?.name ?? 'none'}</Text>;
    }

    const { client, unmount } = await renderWithCatalog(<></>);
    client.setQueryData([QueryKeys.Artists, SERVER_ID], [artist('a1', 'First'), artist('a2', 'Second')]);
    await unmount();

    const store = configureStore({ reducer: { servers: serversReducer } });
    store.dispatch(addServer(testServer()));
    store.dispatch(setActiveServer(SERVER_ID));
    const screen = await render(
      <QueryClientProvider client={client}>
        <Provider store={store}><ArtistProbe /></Provider>
      </QueryClientProvider>
    );

    expect(names.at(-1)).toBe('First');
    await act(async () => { setId('a2'); });
    expect(names.at(-1)).toBe('Second');

    await screen.unmount();
    client.clear();
    client.unmount();
  });

  it('does not send a consumer that syncs state from it into a render loop', async () => {
    // The shape `PlaylistList` has: derive something from the list in a memo,
    // then copy it into state in an effect. With an unstable empty list this
    // re-ran every render — "Maximum update depth exceeded", 120 times on the
    // simulator, from the playing bar, whenever the catalog was empty.
    const renders = { count: 0 };

    function Consumer() {
      const { playlists } = usePlaylists();
      const ids = React.useMemo(() => new Set(playlists.map(p => p.nativeId)), [playlists]);
      const [, setSelected] = useState<Set<string>>(new Set());
      const count = useRef(0);
      count.current += 1;
      renders.count = count.current;
      useEffect(() => { setSelected(new Set(ids)); }, [ids]);
      return <Text>{ids.size}</Text>;
    }

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { client, unmount } = await renderWithCatalog(<Consumer />);

    expect(errors).not.toHaveBeenCalledWith(expect.stringContaining('Maximum update depth'));
    expect(renders.count).toBeLessThan(10);

    errors.mockRestore();
    await unmount();
    client.clear();
    client.unmount();
  });
});
