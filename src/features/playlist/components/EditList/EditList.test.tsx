import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import type { Playlist } from '@/domain/entities/Playlist';
import type { Song } from '@/domain/entities/Song';
import { PlaylistChangedError } from '@/providers/contracts/ServerAdapter';
import PlaylistEditList from './index';

const mockRemoveMutate = jest.fn();
const mockMoveMutate = jest.fn();
let mockOffline = false;
const mockNotifyError = jest.fn();

jest.mock('react-native-reorderable-list', () => {
  const { View, ScrollView } = require('react-native');
  const MockList = ({ data, renderItem, onReorder, keyExtractor }: any) => (
    <View>
      {data.map((item: any, index: number) => (
        <View key={keyExtractor(item)}>{renderItem({ item, index })}</View>
      ))}
      <View testID="drag-first-to-last" onTouchEnd={() => onReorder({ from: 0, to: data.length - 1 })} />
    </View>
  );
  return {
    __esModule: true,
    default: MockList,
    NestedReorderableList: MockList,
    ScrollViewContainer: ScrollView,
    reorderItems: (items: any[], from: number, to: number) => {
      const next = [...items];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    },
    useReorderableDrag: () => jest.fn(),
    useIsActive: () => false,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.title ? `${key}:${opts.title}` : key) }),
}));
jest.mock('react-redux', () => ({ useSelector: () => ({ id: 'srv' }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { card: '#111', subtext: '#666', themeColor: '#7c3aed', background: '#000' } }),
}));
jest.mock('@/features/theme/useScrollClearance', () => ({ useScrollClearance: () => 0 }));
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => mockOffline }));
jest.mock('@/components/toast', () => ({ notify: { error: (...args: unknown[]) => mockNotifyError(...args) } }));
jest.mock('@/components/DetailHeader', () => {
  const { View, Text } = require('react-native');
  return { DetailHeaderBar: ({ subtitle, rightAction }: any) => <View><Text>{subtitle}</Text>{rightAction}</View> };
});
jest.mock('@/components/MediaListRow', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ title }: any) => <Text>{title}</Text> };
});
jest.mock('@/features/home/components/SectionEmptyState', () => 'SectionEmptyState');
jest.mock('../../useRemoveSongFromPlaylist', () => ({ useRemoveSongFromPlaylist: () => ({ mutate: mockRemoveMutate }) }));
jest.mock('../../useMoveSongInPlaylist', () => ({ useMoveSongInPlaylist: () => ({ mutate: mockMoveMutate }) }));

const song = (nativeId: string, title: string) =>
  ({ nativeId, localId: `song:srv:${nativeId}`, title, artist: { name: 'Artist' }, cover: { kind: 'none' } }) as unknown as Song;

const playlist = { nativeId: 'p1', title: 'Mix', isOwned: true } as unknown as Playlist;
const songs = [song('a', 'Alpha'), song('b', 'Beta'), song('a', 'Alpha')];

beforeEach(() => {
  mockRemoveMutate.mockReset();
  mockMoveMutate.mockReset();
  mockNotifyError.mockReset();
  mockOffline = false;
});

describe('PlaylistEditList', () => {
  it('removes the copy that was tapped, by its position, and drops just that row', async () => {
    const view = await render(<PlaylistEditList playlist={playlist} songs={songs} onDone={jest.fn()} />);

    await act(async () => {
      fireEvent.press(view.getAllByLabelText('a11y.playlist.removeSong:Alpha')[1]);
    });

    expect(mockRemoveMutate).toHaveBeenCalledWith(
      { playlistId: 'p1', songId: 'a', position: 2 },
      expect.anything()
    );
    expect(view.getAllByText('Alpha')).toHaveLength(1);
  });

  it('moves the dragged entry and keeps it where it was dropped', async () => {
    const view = await render(<PlaylistEditList playlist={playlist} songs={songs} onDone={jest.fn()} />);

    await act(async () => {
      fireEvent(view.getByTestId('drag-first-to-last'), 'touchEnd');
    });

    expect(mockMoveMutate).toHaveBeenCalledWith(
      { playlistId: 'p1', songId: 'a', from: 0, to: 2 },
      expect.anything()
    );
    expect(view.getAllByTestId('playlist-edit-row')).toHaveLength(3);
  });

  it('says the playlist changed and puts the order back when the server refuses a move', async () => {
    mockMoveMutate.mockImplementation((_args, { onError }) => onError(new PlaylistChangedError()));
    const view = await render(<PlaylistEditList playlist={playlist} songs={songs} onDone={jest.fn()} />);

    await act(async () => {
      fireEvent(view.getByTestId('drag-first-to-last'), 'touchEnd');
    });

    expect(mockNotifyError).toHaveBeenCalledWith('playlist.edit.changed');
    expect(view.getAllByText(/Alpha|Beta/).map(node => node.props.children)).toEqual(['Alpha', 'Beta', 'Alpha']);
  });

  it('offers no drag handles offline, and says why', async () => {
    mockOffline = true;
    const view = await render(<PlaylistEditList playlist={playlist} songs={songs} onDone={jest.fn()} />);

    expect(view.queryByLabelText('a11y.playlist.reorderSong:Beta')).toBeNull();
    expect(view.getByText('playlist.edit.offlineReorder')).toBeTruthy();
  });

  it('ends editing from Done', async () => {
    const onDone = jest.fn();
    const view = await render(<PlaylistEditList playlist={playlist} songs={songs} onDone={onDone} />);

    fireEvent.press(view.getByTestId('playlist-edit-done'));

    expect(onDone).toHaveBeenCalled();
  });
});
