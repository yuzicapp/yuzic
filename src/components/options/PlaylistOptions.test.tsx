import React from 'react';
import { Alert } from 'react-native';
import { act, render } from '@testing-library/react-native';

import PlaylistOptions from './PlaylistOptions';
import type { Playlist } from '@/domain/entities/Playlist';

jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.title ? `${key}:${opts.title}` : key) }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', border: '#ccc' }, isDarkMode: false }),
}));

jest.mock('@/components/BottomSheetBackdrop', () => ({ renderBackdrop: () => null }));

jest.mock('@/components/toast', () => ({
  notify: Object.assign(jest.fn(), { info: jest.fn(), success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn() }),
}));

jest.mock('@/components/haptics', () => ({
  __esModule: true,
  default: { selection: jest.fn(), tap: jest.fn(), primary: jest.fn(), heavy: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() },
  selection: jest.fn(),
}));

jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ shares: undefined }) }));

jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingActions: () => ({
    playSongInCollection: jest.fn(), addCollectionToQueue: jest.fn(), shuffleCollectionToQueue: jest.fn(), getQueue: () => [], playNext: jest.fn(),
  }),
}));

jest.mock('@/features/offline/DownloadContext', () => ({
  useDownload: () => ({ downloadPlaylistById: jest.fn(), getCollectionDownloadState: () => ({ isDownloaded: false, isDownloading: false }) }),
}));

const mockDeleteMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockRenameMutateAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/playlist/useDeletePlaylist', () => ({ useDeletePlaylist: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }) }));
jest.mock('@/features/playlist/useRenamePlaylist', () => ({ useRenamePlaylist: () => ({ mutateAsync: mockRenameMutateAsync }) }));
jest.mock('@/features/playlist/RenamePlaylistSheet', () => {
  const { Text: RNText } = require('react-native');
  return { __esModule: true, default: ({ playlist }: any) => <RNText>rename-sheet:{playlist.title}</RNText> };
});

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('./useLazyCollectionDetails', () => ({
  useLazyPlaylistDetail: () => ({ playlistWithSongs: null, songs: [], songsLoading: false }),
}));

jest.mock('@/components/SpinningLoaderCircle', () => 'SpinningLoaderCircle');

jest.mock('@/components/options/OptionSheetPrimitives', () => {
  const { Text: RNText, View: RNView } = require('react-native');
  return {
    OptionSheetHeader: ({ title, subtitle }: any) => (
      <RNView>
        <RNText>{title}</RNText>
        {subtitle !== undefined && <RNText>{subtitle}</RNText>}
      </RNView>
    ),
    OptionSheetRow: ({ label, onPress, disabled }: any) => <RNText onPress={disabled ? undefined : onPress}>{label}</RNText>,
    OptionSheetInfoRow: ({ label, value }: any) => <RNText>{label}: {value}</RNText>,
    OptionSheetSectionLabel: ({ label }: any) => <RNText>{label}</RNText>,
    OptionSheetDivider: () => <RNView />,
    optionSheetStyles: { sheetBackground: {}, sheetContent: {}, loading: {} },
    useOptionSheetBackground: () => ({}),
    useOptionSheetContentStyle: () => ({}),
  };
});

const ownedPlaylist: Playlist = {
  localId: 'local:playlist:srv:server1:p1' as Playlist['localId'],
  nativeId: 'p1',
  provenance: { origin: 'server', serverId: 'server1' },
  externalIds: {},
  libraryState: 'in-library',
  title: 'My Mix',
  cover: { kind: 'none' },
  isOwned: true,
  songIds: [],
};

const favoritesPlaylist: Playlist = {
  ...ownedPlaylist,
  nativeId: 'favorites',
  title: 'Favorites',
};

describe('PlaylistOptions', () => {
  beforeEach(() => {
    mockDeleteMutateAsync.mockClear();
    mockRenameMutateAsync.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the base playback + rename/delete action set for an ordinary playlist', async () => {
    const view = await render(<PlaylistOptions ref={null as any} playlist={ownedPlaylist} />);
    expect(view.getByText('playlistOptions.actions.play')).toBeTruthy();
    expect(view.getByText('playlistOptions.actions.rename')).toBeTruthy();
    expect(view.getByText('playlistOptions.actions.delete')).toBeTruthy();
  });

  it('hides rename/delete for the Favorites playlist', async () => {
    const view = await render(<PlaylistOptions ref={null as any} playlist={favoritesPlaylist} />);
    expect(view.queryByText('playlistOptions.actions.rename')).toBeNull();
    expect(view.queryByText('playlistOptions.actions.delete')).toBeNull();
  });

  it('confirms before deleting (destructive action) instead of deleting on the first tap', async () => {
    const view = await render(<PlaylistOptions ref={null as any} playlist={ownedPlaylist} />);
    view.getByText('playlistOptions.actions.delete').props.onPress();

    // The delete mutation must not run until the confirm dialog's destructive
    // button is pressed.
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    const destructiveButton = buttons.find((b: any) => b.style === 'destructive');
    expect(destructiveButton).toBeTruthy();

    await destructiveButton.onPress();
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('p1');
  });

  it('renders no options-sheet rows for null playlist while it loads', async () => {
    const view = await render(<PlaylistOptions ref={null as any} playlist={null} />);
    expect(view.queryByText('playlistOptions.actions.play')).toBeNull();
  });

  it('asks for the new name in a sheet, which works on Android too, instead of an iOS-only prompt', async () => {
    const view = await render(<PlaylistOptions ref={null as any} playlist={ownedPlaylist} />);
    expect(view.queryByText('rename-sheet:My Mix')).toBeNull();

    await act(async () => {
      view.getByText('playlistOptions.actions.rename').props.onPress();
    });

    expect(view.getByText('rename-sheet:My Mix')).toBeTruthy();
  });

  it('offers Edit songs only where the screen can edit, and it opens the edit mode', async () => {
    const onEditSongs = jest.fn();
    const withoutEditor = await render(<PlaylistOptions ref={null as any} playlist={ownedPlaylist} />);
    expect(withoutEditor.queryByText('playlistOptions.actions.editSongs')).toBeNull();

    const view = await render(<PlaylistOptions ref={null as any} playlist={ownedPlaylist} onEditSongs={onEditSongs} />);
    view.getByText('playlistOptions.actions.editSongs').props.onPress();
    expect(onEditSongs).toHaveBeenCalled();

    const favorites = await render(<PlaylistOptions ref={null as any} playlist={favoritesPlaylist} onEditSongs={onEditSongs} />);
    expect(favorites.queryByText('playlistOptions.actions.editSongs')).toBeNull();
  });

  it("offers no changes to another account's playlist", async () => {
    const shared = { ...ownedPlaylist, isOwned: false };
    const view = await render(<PlaylistOptions ref={null as any} playlist={shared} onEditSongs={jest.fn()} />);

    expect(view.getByText('playlistOptions.actions.play')).toBeTruthy();
    expect(view.queryByText('playlistOptions.actions.editSongs')).toBeNull();
    expect(view.queryByText('playlistOptions.actions.rename')).toBeNull();
    expect(view.queryByText('playlistOptions.actions.delete')).toBeNull();
  });
});
