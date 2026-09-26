/**
 * The identity index is built once for the whole app, and only when asked.
 *
 * `SongRow` calls `useLocalFirst`, so "once" is the difference between one
 * index build and one per visible row. It regressed silently once because
 * `useMemo` reads as shared and is per component instance: fifteen rows meant
 * fifteen scans of the whole library, which at 90,000 tracks is seconds.
 *
 * "Only when asked" matters because most screens never ask. The index only
 * decides whether a browsed record is one the library already holds.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '@/components/Text';

let mockSongs: unknown[] = Array.from({ length: 2000 }, (_, i) => ({
  localId: `s${i}`, nativeId: `${i}`, externalIds: {}, title: `T${i}`,
  provenance: { origin: 'server', serverId: 'srv' },
  artist: { localId: `a${i % 50}`, nativeId: `${i % 50}`, externalIds: {}, name: `A${i % 50}`, cover: { kind: 'none' } },
  album: { localId: `al${i % 100}`, nativeId: `${i % 100}`, externalIds: {}, title: `Al${i % 100}`, cover: { kind: 'none' } },
}));

// Stable identities, as the real hooks give: `useOfflineFirstQuery` holds an
// `emptyRef` for exactly this reason. A fresh `[]` per call would miss the
// store's cache every time and the test would be measuring its own mock.
const mockEmpty: unknown[] = [];
jest.mock('@/features/album/useAlbums', () => ({ useAlbums: () => ({ albums: mockEmpty }) }));
jest.mock('@/features/artist/useArtists', () => ({ useArtists: () => ({ artists: mockEmpty }) }));
jest.mock('@/features/playlist/usePlaylists', () => ({ usePlaylists: () => ({ playlists: mockEmpty }) }));
jest.mock('@/features/song/useTracks', () => ({ useTracks: () => ({ tracks: mockSongs }) }));

const mockBuildSpy = jest.fn();
jest.mock('./localFirst', () => {
  const actual = jest.requireActual('./localFirst');
  return {
    ...actual,
    buildLibraryIndex: (...args: unknown[]) => {
      mockBuildSpy();
      return (actual.buildLibraryIndex as (...a: unknown[]) => unknown)(...args);
    },
  };
});

import { useLocalFirst } from './useLocalFirst';
import { useCatalogStore, _resetCatalogStore } from './useCatalogStore';

function Row() {
  useLocalFirst();
  return <Text>row</Text>;
}

/** Reads the store without ever touching the identity index. */
function Bystander() {
  useCatalogStore();
  return <Text>bystander</Text>;
}

beforeEach(() => {
  _resetCatalogStore();
  mockBuildSpy.mockClear();
});

describe('useLocalFirst', () => {
  it('builds the index once for a screen full of rows, not once per row', async () => {
    await render(<>{Array.from({ length: 15 }, (_, i) => <Row key={i} />)}</>);

    expect(mockBuildSpy).toHaveBeenCalledTimes(1);
  });

  it('does not build it for a screen that never asks', async () => {
    // The store gets built either way; the index costs 311 ms at 90,000
    // tracks and most screens have no use for it.
    await render(<>{Array.from({ length: 15 }, (_, i) => <Bystander key={i} />)}</>);

    expect(mockBuildSpy).not.toHaveBeenCalled();
  });

  it('builds it on the first ask, and not again', async () => {
    await render(<Bystander />);
    expect(mockBuildSpy).not.toHaveBeenCalled();

    await render(<Row />);
    await render(<Row />);

    expect(mockBuildSpy).toHaveBeenCalledTimes(1);
  });

  it('builds again when a sync replaces the catalog', async () => {
    await render(<Row />);
    expect(mockBuildSpy).toHaveBeenCalledTimes(1);

    mockSongs = mockSongs.slice(0, 500);
    await render(<Row />);

    expect(mockBuildSpy).toHaveBeenCalledTimes(2);
  });
});
