import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import OptionsTile from './OptionsTile';

const mockOpenSongOptions = jest.fn();

jest.mock('@/features/entity-actions/SongActionSheetContext', () => ({
  useSongActionSheets: () => ({ openSongOptions: mockOpenSongOptions }),
}));
jest.mock('@/components/options/AlbumOptions', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text testID="album-options">album options</Text> };
});
jest.mock('@/components/options/ArtistOptions', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text testID="artist-options">artist options</Text> };
});
jest.mock('@/components/useSheetRef', () => ({ useSheetRef: () => ({ current: { present: jest.fn() } }) }));
jest.mock('./MediaTile', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress, onLongPress }: any) => (
      <Text testID="tile" onPress={onPress} onLongPress={onLongPress}>{title}</Text>
    ),
  };
});

const album = { localId: 'local:album:int:deezer:1', title: 'Geogaddi' } as unknown as Album;
const artist = { localId: 'local:artist:int:deezer:9', name: 'Boards of Canada' } as unknown as Artist;
const song = { localId: 'local:song:srv:s:1', title: 'Roygbiv' } as unknown as Song;

beforeEach(() => { mockOpenSongOptions.mockClear(); });

const tile = (entity: React.ComponentProps<typeof OptionsTile>['entity']) => (
  <OptionsTile
    entity={entity}
    cover={{ kind: 'none' }}
    title="Tile"
    subtitle="Subtitle"
    size={100}
    radius={8}
  />
);

describe('OptionsTile', () => {
  it('mounts nothing until the tile is long-pressed', async () => {
    const view = await render(tile({ kind: 'album', album }));
    expect(view.queryByTestId('album-options')).toBeNull();
  });

  it("opens an album's options on a long press", async () => {
    const view = await render(tile({ kind: 'album', album }));

    await fireEvent(view.getByTestId('tile'), 'longPress');

    expect(view.getByTestId('album-options')).toBeTruthy();
  });

  it("opens an artist's options on a long press", async () => {
    const view = await render(tile({ kind: 'artist', artist }));

    await fireEvent(view.getByTestId('tile'), 'longPress');

    expect(view.getByTestId('artist-options')).toBeTruthy();
  });

  it('sends a song to the app-wide song sheet, the one with Add to playlist', async () => {
    const view = await render(tile({ kind: 'song', song }));

    await fireEvent(view.getByTestId('tile'), 'longPress');

    expect(mockOpenSongOptions).toHaveBeenCalledWith(song);
    expect(view.queryByTestId('album-options')).toBeNull();
  });
});
