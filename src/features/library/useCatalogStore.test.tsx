/**
 * The store is built once for the app, not once per component.
 *
 * The same shape `useLocalFirst` got wrong: `useMemo` reads as shared and is
 * per component instance, so an index of the whole library ended up being
 * built inside every visible row.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '@/components/Text';

let mockAlbums: unknown[] = [];
const mockEmptyArtists: unknown[] = [];
const mockEmptyTracks: unknown[] = [];
const mockEmptyPlaylists: unknown[] = [];

jest.mock('@/features/album/useAlbums', () => ({ useAlbums: () => ({ albums: mockAlbums }) }));
jest.mock('@/features/artist/useArtists', () => ({ useArtists: () => ({ artists: mockEmptyArtists }) }));
jest.mock('@/features/song/useTracks', () => ({ useTracks: () => ({ tracks: mockEmptyTracks }) }));
jest.mock('@/features/playlist/usePlaylists', () => ({ usePlaylists: () => ({ playlists: mockEmptyPlaylists }) }));

const mockBuildSpy = jest.fn();
jest.mock('./catalogStore', () => {
  const actual = jest.requireActual('./catalogStore');
  return {
    ...actual,
    buildCatalogStore: (...args: unknown[]) => {
      mockBuildSpy();
      return (actual.buildCatalogStore as (...a: unknown[]) => unknown)(...args);
    },
  };
});

import { useCatalogStore, _resetCatalogStore } from './useCatalogStore';

function Row() {
  useCatalogStore();
  return <Text>row</Text>;
}

beforeEach(() => {
  _resetCatalogStore();
  mockBuildSpy.mockClear();
  mockAlbums = [];
});

describe('useCatalogStore', () => {
  it('builds once for a screen full of rows', async () => {
    await render(<>{Array.from({ length: 15 }, (_, i) => <Row key={i} />)}</>);

    expect(mockBuildSpy).toHaveBeenCalledTimes(1);
  });

  it('does not rebuild for a second screen reading the same catalog', async () => {
    await render(<Row />);
    await render(<Row />);

    expect(mockBuildSpy).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when a sync replaces the catalog', async () => {
    await render(<Row />);
    expect(mockBuildSpy).toHaveBeenCalledTimes(1);

    mockAlbums = [];  // a new array identity, which is what a sync produces
    await render(<Row />);

    expect(mockBuildSpy).toHaveBeenCalledTimes(2);
  });
});
