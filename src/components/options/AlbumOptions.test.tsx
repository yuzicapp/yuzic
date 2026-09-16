import React from 'react';
import { render } from '@testing-library/react-native';

import AlbumOptions from './AlbumOptions';
import type { Album } from '@/domain/entities/Album';

jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', border: '#ccc', muted: '#333', placeholder: '#999' }, isDarkMode: false }),
}));

jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ lg: 16, card: 8, thumb: 8, pill: 999, pillFor: (n: number) => n / 2 }),
}));

jest.mock('@/components/BottomSheetBackdrop', () => ({
  renderBackdrop: () => null,
}));

jest.mock('@/components/useSheetRef', () => ({
  useSheetRef: () => ({ current: null }),
}));

jest.mock('@/components/haptics', () => ({
  __esModule: true,
  default: { selection: jest.fn(), tap: jest.fn(), primary: jest.fn(), heavy: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() },
  selection: jest.fn(),
}));

jest.mock('@/components/toast', () => ({
  notify: Object.assign(jest.fn(), { info: jest.fn(), success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn() }),
}));

jest.mock('@/features/shares/share', () => ({
  shareItem: jest.fn(),
}));

const mockNavigateToArtist = jest.fn();
jest.mock('@/features/sources/useMatchedNavigation', () => ({
  useMatchedNavigation: () => ({ navigateToAlbum: jest.fn(), navigateToArtist: mockNavigateToArtist }),
}));

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({}),
  useDispatch: () => mockDispatch,
}));

jest.mock('@/state/redux/selectors/statsSelectors', () => ({
  selectAlbumPlayCount: () => () => 0,
}));

jest.mock('@/state/redux/selectors/serversSelectors', () => ({
  selectActiveServerId: () => 'server-1',
}));

const mockIsWanted = jest.fn(() => false);
jest.mock('@/state/redux/selectors/wantsSelectors', () => ({
  selectIsWanted: (_localId: string) => () => mockIsWanted(),
}));

jest.mock('@/state/redux/slices/wantsSlice', () => ({
  addWant: (payload: any) => ({ type: 'wants/addWant', payload }),
  removeWant: (payload: any) => ({ type: 'wants/removeWant', payload }),
}));

jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({ shares: undefined }),
}));

jest.mock('@/providers/registry/similarityService', () => ({
  useSimilarityService: () => ({ similarTrackIds: async () => [] }),
}));

const mockCanGeneratePlaylist = jest.fn(() => false);
const mockGenerateForAlbum = jest.fn();
jest.mock('@/features/playlist/generateSimilarPlaylist', () => ({
  useCanGeneratePlaylist: () => mockCanGeneratePlaylist(),
  generateSimilarPlaylistForAlbum: (...args: unknown[]) => mockGenerateForAlbum(...args),
}));

jest.mock('@/features/playback/PlayingContext', () => ({
  usePlaying: () => ({
    playSongInCollection: jest.fn(),
    addCollectionToQueue: jest.fn(),
    shuffleCollectionToQueue: jest.fn(),
    getQueue: () => [],
    currentSong: null,
    playNext: jest.fn(),
  }),
}));

jest.mock('@/features/offline/DownloadContext', () => ({
  useDownload: () => ({
    downloadAlbumById: jest.fn(),
    getCollectionDownloadState: () => ({ isDownloaded: false, isDownloading: false }),
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/features/sources/registry', () => ({
  useEnabledExternalSources: () => [],
}));

jest.mock('@/features/downloaders/registry', () => ({
  useAnyAlbumDownloaderConnected: jest.fn(() => false),
}));

jest.mock('./useLazyCollectionDetails', () => ({
  useLazyAlbumDetail: () => ({ albumWithSongs: null, songs: [], songsLoading: false }),
}));

jest.mock('@/features/library/useStarredAlbums', () => ({ useStarredAlbums: () => ({ albums: [] }) }));
jest.mock('@/features/library/useStarAlbum', () => ({ useStarAlbum: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/library/useUnstarAlbum', () => ({ useUnstarAlbum: () => ({ mutateAsync: jest.fn() }) }));

jest.mock('@/features/downloaders/useExternalAlbumStatus', () => ({
  useExternalAlbumStatus: jest.fn(() => ({ kind: 'none' })),
}));

jest.mock('@/components/options/GetReviewSheet', () => 'GetReviewSheet');

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
    OptionSheetRow: ({ label, onPress }: any) => <RNText onPress={onPress}>{label}</RNText>,
    OptionSheetInfoRow: ({ label, value }: any) => <RNText>{label}: {value}</RNText>,
    OptionSheetChipsRow: ({ label }: any) => <RNText>{label}</RNText>,
    OptionSheetSectionLabel: ({ label }: any) => <RNText>{label}</RNText>,
    OptionSheetDivider: () => <RNView />,
    optionSheetStyles: { sheetBackground: {}, sheetContent: {}, loading: {} },
    useOptionSheetBackground: () => ({}),
    useOptionSheetContentStyle: () => ({}),
  };
});

const { useAnyAlbumDownloaderConnected } = jest.requireMock('@/features/downloaders/registry') as {
  useAnyAlbumDownloaderConnected: jest.Mock;
};
const { useExternalAlbumStatus } = jest.requireMock('@/features/downloaders/useExternalAlbumStatus') as {
  useExternalAlbumStatus: jest.Mock;
};

const libraryAlbum: Album = {
  localId: 'local:album:srv:server1:a1' as Album['localId'],
  nativeId: 'a1',
  provenance: { origin: 'server', serverId: 'server1' },
  externalIds: {},
  libraryState: 'in-library',
  title: 'Local Album',
  cover: { kind: 'none' },
  artist: {
    localId: 'local:artist:srv:server1:ar1' as Album['artist']['localId'],
    nativeId: 'ar1',
    name: 'Some Artist',
    cover: { kind: 'none' },
    externalIds: {},
  },
  year: 2020,
  releaseType: 'album',
  genres: [],
  songIds: [],
};

const externalAlbum: Album = {
  localId: 'local:album:ext:deezer:ext1' as Album['localId'],
  nativeId: 'ext1',
  provenance: { origin: 'integration', providerId: 'deezer' },
  externalIds: {},
  libraryState: 'external',
  title: 'External Album',
  cover: { kind: 'none' },
  artist: {
    localId: 'local:artist:ext:deezer:extArtist1' as Album['artist']['localId'],
    nativeId: 'extArtist1',
    name: 'External Artist',
    cover: { kind: 'none' },
    externalIds: {},
  },
  releaseType: 'album',
  genres: [],
  songIds: [],
};

describe('AlbumOptions', () => {
  beforeEach(() => {
    useAnyAlbumDownloaderConnected.mockReset().mockReturnValue(false);
    useExternalAlbumStatus.mockReset().mockReturnValue({ kind: 'none' });
    mockIsWanted.mockReset().mockReturnValue(false);
    mockDispatch.mockClear();
    mockCanGeneratePlaylist.mockReset().mockReturnValue(false);
    mockGenerateForAlbum.mockReset();
  });

  it('renders the library action set for a library album', async () => {
    const view = await render(<AlbumOptions ref={null as any} album={libraryAlbum} />);
    // Library-only actions.
    expect(view.getByText('albumOptions.actions.play')).toBeTruthy();
    expect(view.getByText('albumOptions.actions.shuffle')).toBeTruthy();
    expect(view.getByText('albumOptions.actions.goToAlbum')).toBeTruthy();
    // External-only action must not appear.
    expect(view.queryByText('externalAlbum.menu.noServiceConnected')).toBeNull();
    expect(view.queryByText('externalAlbum.menu.get')).toBeNull();
  });

  it("offers the browsed album's artist, and shares its source page where it has one", async () => {
    const { shareItem } = jest.requireMock('@/features/shares/share') as { shareItem: jest.Mock };
    shareItem.mockClear();
    mockNavigateToArtist.mockClear();
    const withDeezerId = { ...externalAlbum, externalIds: { deezerId: '119606' } };

    const view = await render(<AlbumOptions ref={null as any} album={withDeezerId} />);

    view.getByText('externalAlbum.menu.goToArtist').props.onPress();
    expect(mockNavigateToArtist).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'External Artist', libraryState: 'external' })
    );

    view.getByText('albumOptions.actions.share').props.onPress();
    expect(shareItem).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.deezer.com/album/119606' })
    );
    expect(view.getByText('externalOptions.openInSource')).toBeTruthy();
  });

  it('leaves out Share and Open in … when nothing identifies the album publicly', async () => {
    const view = await render(<AlbumOptions ref={null as any} album={externalAlbum} />);

    expect(view.queryByText('albumOptions.actions.share')).toBeNull();
    expect(view.queryByText('externalOptions.openInSource')).toBeNull();
  });

  it('renders parallel Want and Get actions for an external album (no downloader connected)', async () => {
    const view = await render(<AlbumOptions ref={null as any} album={externalAlbum} />);
    expect(view.getByText('externalAlbum.menu.noServiceConnected')).toBeTruthy();
    expect(view.getByText('externalAlbum.menu.want')).toBeTruthy();
    // Library-only actions must not appear.
    expect(view.queryByText('albumOptions.actions.play')).toBeNull();
    expect(view.queryByText('albumOptions.actions.goToAlbum')).toBeNull();
  });

  it('shows the Get action for an external album with a connected downloader', async () => {
    useAnyAlbumDownloaderConnected.mockReturnValue(true);
    const view = await render(<AlbumOptions ref={null as any} album={externalAlbum} />);
    expect(view.getByText('externalAlbum.menu.get')).toBeTruthy();
    expect(view.getByText('externalAlbum.menu.want')).toBeTruthy();
  });

  it('dispatches addWant (and no download) when tapping Want, save-only', async () => {
    useAnyAlbumDownloaderConnected.mockReturnValue(true);
    const view = await render(<AlbumOptions ref={null as any} album={externalAlbum} />);
    view.getByText('externalAlbum.menu.want').props.onPress();

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('wants/addWant');
    expect(action.payload).toMatchObject({
      serverId: 'server-1',
      want: expect.objectContaining({ unit: 'album', title: 'External Album', artist: 'External Artist' }),
    });
  });

  it('shows the toggled Wanted state and dispatches removeWant when already wanted', async () => {
    mockIsWanted.mockReturnValue(true);
    const view = await render(<AlbumOptions ref={null as any} album={externalAlbum} />);
    expect(view.queryByText('externalAlbum.menu.want')).toBeNull();
    expect(view.getByText('externalAlbum.menu.wanted')).toBeTruthy();

    view.getByText('externalAlbum.menu.wanted').props.onPress();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('wants/removeWant');
  });

  // The "no localId" case this used to cover is no longer representable:
  // `EntityCore.localId` is a required field on every domain `Album`, not an
  // optional one added partway through the pre-rewrite migration, so there
  // is no longer a real album value with it absent to construct.

  it('hides "Make a playlist from this" for a library album when the playlist.generate slot is unfilled', async () => {
    mockCanGeneratePlaylist.mockReturnValue(false);
    const view = await render(<AlbumOptions ref={null as any} album={libraryAlbum} />);
    expect(view.queryByText('albumOptions.actions.generatePlaylist')).toBeNull();
  });

  it('shows "Make a playlist from this" for a library album when the slot is filled', async () => {
    mockCanGeneratePlaylist.mockReturnValue(true);
    const view = await render(<AlbumOptions ref={null as any} album={libraryAlbum} />);
    expect(view.getByText('albumOptions.actions.generatePlaylist')).toBeTruthy();
  });
});
