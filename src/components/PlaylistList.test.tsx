import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Song } from '@/domain/entities/Song';
import type { Playlist } from '@/domain/entities/Playlist';
import { FAVORITES_ID } from '@/constants/favorites';

/**
 * The add-to-playlist sheet, rendered (#327).
 *
 * This was guarded by reading the component's source, on the grounds that
 * rendering it needs the bottom-sheet stack, the query client and the store.
 * It needs none of those — it needs the sheet's two containers standing in as
 * plain views, and the hooks it calls answered. What the source-reading
 * version could never say is the part that matters: that tapping Favorites
 * stars the song and tapping it back writes nothing.
 *
 * The real `useFavoriteMembership` runs here. Only the server edge is faked.
 */
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    // The real modal tells the screen it opened through `onChange`; the sheet
    // only takes its tick once it believes it is open, so say so on mount.
    BottomSheetModal: ({ children, onChange }: { children: React.ReactNode; onChange?: (i: number) => void }) => {
      ReactActual.useEffect(() => { onChange?.(0); }, [onChange]);
      return <View>{children}</View>;
    },
    BottomSheetFlatList: ({ data, renderItem, ListHeaderComponent }: {
      data: Playlist[];
      renderItem: (info: { item: Playlist }) => React.ReactNode;
      ListHeaderComponent?: () => React.ReactNode;
    }) => (
      <View>
        {ListHeaderComponent ? ListHeaderComponent() : null}
        {data.map(item => <View key={item.localId}>{renderItem({ item })}</View>)}
      </View>
    ),
  };
});

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: {
    secondary: '#fff', subtext: '#aaa', border: '#333', card: '#111',
    muted: '#222', placeholder: '#888', themeColor: '#0f0',
  } }),
}));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ md: 8, card: 12, thumb: 6 }) }));
jest.mock('@/features/theme/useIconSize', () => ({ useIconSize: () => ({ row: 20 }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@/components/BottomSheetBackdrop', () => ({ renderBackdrop: () => null }));
jest.mock('@/components/MediaImage', () => {
  const { View } = jest.requireActual('react-native');
  return { MediaImage: () => <View /> };
});
jest.mock('@/components/toast', () => ({ notify: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => false }));

jest.mock('@/features/playlist/usePlaylists', () => ({ usePlaylists: () => ({ playlists: mockPlaylists }) }));
jest.mock('@/features/playlist/useCreatePlaylist', () => ({ useCreatePlaylist: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/playlist/useAddSongToPlaylist', () => ({ useAddSongToPlaylist: () => ({ mutateAsync: mockAddToPlaylist }) }));
jest.mock('@/features/playlist/useRemoveSongFromPlaylist', () => ({ useRemoveSongFromPlaylist: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/playlist/usePlaylistMembership', () => ({
  usePlaylistMembership: () => ({
    selectedIds: new Set<string>(),
    baseSelectedIds: new Set<string>(),
    loading: false,
    toggle: mockTogglePlaylist,
  }),
}));

// The starred songs behind Favorites, and the writes it commits with.
jest.mock('@/features/library/useStarredSongs', () => ({ useStarredSongs: () => ({ songs: mockStarred }) }));
jest.mock('@/features/library/useStarSong', () => ({ useStarSong: () => ({ mutateAsync: mockStar }) }));
jest.mock('@/features/library/useUnstarSong', () => ({ useUnstarSong: () => ({ mutateAsync: mockUnstar }) }));

/* eslint-disable no-var -- hoisted for the jest.mock factories above */
var mockPlaylists: Playlist[] = [];
var mockStarred: { localId: string }[] = [];
var mockStar = jest.fn();
var mockUnstar = jest.fn();
var mockAddToPlaylist = jest.fn();
var mockTogglePlaylist = jest.fn();
/* eslint-enable no-var */

import PlaylistList from './PlaylistList';

const song = { localId: 'local:song:srv:srv-1:tr-1', nativeId: 'tr-1', title: 'Bend' } as Song;

function playlist(id: string, title: string, extra: Partial<Playlist> = {}): Playlist {
  return {
    localId: `local:playlist:srv:srv-1:${id}`,
    nativeId: id,
    title,
    isOwned: true,
    ...extra,
  } as Playlist;
}

const renderSheet = async (onClose = jest.fn()) =>
  await render(<PlaylistList selectedSong={song} onClose={onClose} />);

const tapFavorites = async () => {
  await act(async () => { fireEvent.press(screen.getByTestId('playlist-list-favorites')); });
};
const tapDone = async () => {
  await act(async () => { fireEvent.press(screen.getByText('common.done')); });
};

describe('the add-to-playlist sheet', () => {
  beforeEach(() => {
    mockPlaylists = [playlist('pl-1', 'Road trip')];
    mockStarred = [];
    mockStar = jest.fn().mockResolvedValue(undefined);
    mockUnstar = jest.fn().mockResolvedValue(undefined);
    mockAddToPlaylist = jest.fn().mockResolvedValue(undefined);
    mockTogglePlaylist = jest.fn();
  });

  it('offers Favorites alongside the playlists', async () => {
    await renderSheet();

    expect(screen.getByTestId('playlist-list-favorites')).toBeTruthy();
    expect(screen.getByText('playlist.favoritesTitle')).toBeTruthy();
    expect(screen.getByText('Road trip')).toBeTruthy();
  });

  it('offers Favorites even with no playlists of your own', async () => {
    // What #327 reported: the sheet rendered empty, which reads as broken.
    mockPlaylists = [];
    await renderSheet();

    expect(screen.getByTestId('playlist-list-favorites')).toBeTruthy();
  });

  it('shows it above the playlists, not among them', async () => {
    // Named to sort before anything: the row is the list header, so it comes
    // first however the playlists are ordered, and cannot be pushed down the
    // list by a rename.
    mockPlaylists = [playlist('pl-1', 'Aaa sorts first')];
    await renderSheet();

    const labels = screen
      .getAllByText(/playlist\.favoritesTitle|Aaa sorts first/)
      .map(node => node.props.children);

    expect(labels).toEqual(['playlist.favoritesTitle', 'Aaa sorts first']);
  });

  it('leaves the server-side Favorites playlist out, so there is only one', async () => {
    // The constant, not a literal: the id is what the filter compares, and a
    // guess here would pass while testing nothing.
    mockPlaylists = [playlist('pl-1', 'Road trip'), playlist(FAVORITES_ID, 'Server Favorites')];
    await renderSheet();

    expect(screen.queryByText('Server Favorites')).toBeNull();
    expect(screen.getByText('playlist.favoritesTitle')).toBeTruthy();
  });

  it('stars the song when Favorites is ticked and Done pressed', async () => {
    await renderSheet();

    await tapFavorites();
    await tapDone();

    expect(mockStar).toHaveBeenCalledWith('tr-1');
    expect(mockUnstar).not.toHaveBeenCalled();
  });

  it('unstars a song that was starred', async () => {
    mockStarred = [{ localId: song.localId }];
    await renderSheet();

    await tapFavorites();
    await tapDone();

    expect(mockUnstar).toHaveBeenCalledWith('tr-1');
    expect(mockStar).not.toHaveBeenCalled();
  });

  it('writes nothing when Favorites is ticked and unticked again', async () => {
    await renderSheet();

    await tapFavorites();
    await tapFavorites();
    await tapDone();

    expect(mockStar).not.toHaveBeenCalled();
    expect(mockUnstar).not.toHaveBeenCalled();
  });

  it('writes nothing when Done is pressed without touching Favorites', async () => {
    mockStarred = [{ localId: song.localId }];
    await renderSheet();

    await tapDone();

    expect(mockStar).not.toHaveBeenCalled();
    expect(mockUnstar).not.toHaveBeenCalled();
  });

  it('closes once the write succeeds', async () => {
    const onClose = jest.fn();
    await renderSheet(onClose);

    await tapFavorites();
    await tapDone();

    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the sheet open and says so when the write fails', async () => {
    // Favorites rides the same settle as the playlist writes, so its failure
    // is reported and counted the same way rather than passing silently.
    const { notify } = jest.requireMock('@/components/toast');
    mockStar = jest.fn().mockRejectedValue(new Error('nope'));
    const onClose = jest.fn();
    await renderSheet(onClose);

    await tapFavorites();
    await tapDone();

    expect(notify.error).toHaveBeenCalledWith('playlistList.updateFailed');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hides Favorites when a search excludes it', async () => {
    await renderSheet();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('playlistList.searchPlaceholder'), 'road');
    });

    expect(screen.queryByTestId('playlist-list-favorites')).toBeNull();
    expect(screen.getByText('Road trip')).toBeTruthy();
  });

  it('keeps Favorites when the search matches it', async () => {
    await renderSheet();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('playlistList.searchPlaceholder'), 'favo');
    });

    expect(screen.getByTestId('playlist-list-favorites')).toBeTruthy();
  });
});
