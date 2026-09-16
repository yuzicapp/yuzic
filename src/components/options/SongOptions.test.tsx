import React from 'react';
import { render } from '@testing-library/react-native';

import SongOptions from './SongOptions';
import type { Song } from '@/domain/entities/Song';

jest.mock('@/features/library/useLocalFirst', () => ({
  useLocalFirst: () => ({
    index: {
      songs: { size: 0, find: () => null },
      albums: { size: 0, find: () => null },
      artists: { size: 0, find: () => null },
    },
    localSong: () => null,
    localAlbum: () => null,
    localArtist: () => null,
    preferLocalSong: (song: unknown) => song,
  }),
}));
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', border: '#ccc', favorite: '#f00', placeholder: '#999' }, isDarkMode: false }),
}));

jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ lg: 16, card: 8 }),
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

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({}),
  useDispatch: () => mockDispatch,
}));

jest.mock('@/state/redux/selectors/statsSelectors', () => ({
  selectSongPlayCount: () => () => 0,
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

jest.mock('@/providers/registry/similarityService', () => ({ useSimilarityService: () => null }));

const mockGenerateSimilarPlaylist = jest.fn();
jest.mock('@/features/playlist/generateSimilarPlaylist', () => ({
  generateSimilarPlaylistForSong: (...args: unknown[]) => mockGenerateSimilarPlaylist(...args),
}));

jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({}),
}));

jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingState: () => ({ currentSong: null }),
  usePlayingActions: () => ({ addToQueue: jest.fn(), playNext: jest.fn(), playSimilar: jest.fn() }),
}));

jest.mock('@/features/connectivity/useIsOffline', () => ({
  useIsOffline: () => false,
}));

jest.mock('@/features/offline/DownloadContext', () => ({
  useDownload: () => ({
    downloadTrack: jest.fn(),
    deleteDownloadedTrack: jest.fn(),
    isTrackDownloaded: () => false,
    isTrackDownloading: () => false,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/features/library/useStarredSongs', () => ({ useStarredSongs: () => ({ songs: [] }) }));
jest.mock('@/features/library/useStarSong', () => ({ useStarSong: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/library/useUnstarSong', () => ({ useUnstarSong: () => ({ mutateAsync: jest.fn() }) }));

jest.mock('@/features/downloaders/registry', () => ({
  useAnyDownloaderConnected: jest.fn(() => false),
  useAnyTrackDownloaderConnected: jest.fn(() => false),
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

const { useAnyDownloaderConnected, useAnyTrackDownloaderConnected } = jest.requireMock(
  '@/features/downloaders/registry'
) as {
  useAnyDownloaderConnected: jest.Mock;
  useAnyTrackDownloaderConnected: jest.Mock;
};

const librarySong: Song = {
  localId: 'local:song:srv:server1:s1' as Song['localId'],
  nativeId: 's1',
  provenance: { origin: 'server', serverId: 'server1' },
  externalIds: {},
  libraryState: 'in-library',
  title: 'Local Song',
  artist: {
    localId: 'local:artist:srv:server1:ar1' as Song['artist']['localId'],
    nativeId: 'ar1',
    name: 'Some Artist',
    cover: { kind: 'none' },
    externalIds: {},
  },
  album: {
    localId: 'local:album:srv:server1:al1' as Song['album']['localId'],
    nativeId: 'al1',
    title: 'Local Album',
    cover: { kind: 'none' },
    externalIds: {},
  },
  cover: { kind: 'none' },
  durationSeconds: 180,
  contentKind: 'song',
  genres: [],
};

const externalSong: Song = {
  localId: 'local:song:ext:deezer:ext-s1' as Song['localId'],
  nativeId: 'ext-s1',
  provenance: { origin: 'integration', providerId: 'deezer' },
  externalIds: {},
  libraryState: 'external',
  title: 'External Song',
  artist: {
    localId: 'local:artist:ext:deezer:extArtist1' as Song['artist']['localId'],
    nativeId: 'extArtist1',
    name: 'External Artist',
    cover: { kind: 'none' },
    externalIds: {},
  },
  album: {
    localId: 'local:album:ext:deezer:ext-al1' as Song['album']['localId'],
    nativeId: 'ext-al1',
    title: 'External Album',
    cover: { kind: 'none' },
    externalIds: {},
  },
  cover: { kind: 'none' },
  durationSeconds: 180,
  contentKind: 'preview',
  genres: [],
};

describe('SongOptions', () => {
  beforeEach(() => {
    useAnyDownloaderConnected.mockReset().mockReturnValue(false);
    useAnyTrackDownloaderConnected.mockReset().mockReturnValue(false);
    mockGenerateSimilarPlaylist.mockReset();
    mockIsWanted.mockReset().mockReturnValue(false);
    mockDispatch.mockClear();
  });

  it('renders the library action set for a library song, including instant mix', async () => {
    const view = await render(
      <SongOptions ref={null as any} selectedSong={librarySong} onAddToPlaylist={jest.fn()} />
    );
    expect(view.getByText('songOptions.actions.addToPlaylist')).toBeTruthy();
    expect(view.getByText('songOptions.actions.instantMix')).toBeTruthy();
    // External-only actions must not appear.
    expect(view.queryByText('externalAlbum.menu.get')).toBeNull();
    expect(view.queryByText('externalAlbum.menu.getSong')).toBeNull();
    expect(view.queryByText('externalAlbum.menu.want')).toBeNull();
  });

  it('renders parallel Want and Get actions for an external song (no downloader connected)', async () => {
    const view = await render(
      <SongOptions
        ref={null as any}
        selectedSong={externalSong}
        albumTitle="External Album"
        albumArtist="External Artist"
      />
    );
    expect(view.getByText('External Song')).toBeTruthy();
    expect(view.getByText('externalAlbum.menu.want')).toBeTruthy();
    // Library-only actions must not appear.
    expect(view.queryByText('songOptions.actions.addToPlaylist')).toBeNull();
    expect(view.queryByText('songOptions.actions.instantMix')).toBeNull();
    expect(view.queryByText('externalAlbum.menu.get')).toBeNull();
  });

  it('shows the Get actions for an external song with connected downloaders', async () => {
    useAnyDownloaderConnected.mockReturnValue(true);
    useAnyTrackDownloaderConnected.mockReturnValue(true);
    const view = await render(
      <SongOptions
        ref={null as any}
        selectedSong={externalSong}
        albumTitle="External Album"
        albumArtist="External Artist"
      />
    );
    expect(view.getByText('externalAlbum.menu.get')).toBeTruthy();
    expect(view.getByText('externalAlbum.menu.getSong')).toBeTruthy();
    expect(view.getByText('externalAlbum.menu.want')).toBeTruthy();
  });

  it('dispatches addWant (and no download) when tapping Want, save-only', async () => {
    useAnyDownloaderConnected.mockReturnValue(true);
    useAnyTrackDownloaderConnected.mockReturnValue(true);
    const view = await render(
      <SongOptions
        ref={null as any}
        selectedSong={externalSong}
        albumTitle="External Album"
        albumArtist="External Artist"
      />
    );
    view.getByText('externalAlbum.menu.want').props.onPress();

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('wants/addWant');
    expect(action.payload).toMatchObject({
      serverId: 'server-1',
      want: expect.objectContaining({ unit: 'track', title: 'External Song', artist: 'External Artist' }),
    });
  });

  it('shows the toggled Wanted state and dispatches removeWant when already wanted', async () => {
    mockIsWanted.mockReturnValue(true);
    const view = await render(
      <SongOptions
        ref={null as any}
        selectedSong={externalSong}
        albumTitle="External Album"
        albumArtist="External Artist"
      />
    );
    expect(view.queryByText('externalAlbum.menu.want')).toBeNull();
    expect(view.getByText('externalAlbum.menu.wanted')).toBeTruthy();

    view.getByText('externalAlbum.menu.wanted').props.onPress();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('wants/removeWant');
  });

  // The "no externalSource / no stable localId" case this used to cover is
  // no longer representable: every domain `Song` carries a required
  // `provenance` and `localId` (`EntityCore`), not fields added partway
  // through the pre-rewrite migration, so there is no longer a real song
  // value with them absent to construct.
});
