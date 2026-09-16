import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/features/sources/useMatchedNavigation', () => ({
  useMatchedNavigation: () => ({ navigateToAlbum: jest.fn(), navigateToArtist: jest.fn() }),
}));
jest.mock('@/features/shares/share', () => ({ shareItem: jest.fn() }));
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', border: '#ccc', favorite: '#f00', placeholder: '#999', muted: '#333' }, isDarkMode: false }),
}));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ lg: 16, card: 8 }) }));
jest.mock('@/components/BottomSheetBackdrop', () => ({ renderBackdrop: () => null }));
jest.mock('@/components/useSheetRef', () => ({ useSheetRef: () => ({ current: null }) }));
jest.mock('@/components/haptics', () => ({
  __esModule: true,
  default: { selection: jest.fn(), tap: jest.fn(), primary: jest.fn(), heavy: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() },
  selection: jest.fn(),
}));
jest.mock('@/components/toast', () => ({
  notify: Object.assign(jest.fn(), { info: jest.fn(), success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn() }),
}));
jest.mock('react-redux', () => ({ useSelector: (selector: any) => selector({}), useDispatch: () => jest.fn() }));
jest.mock('@/state/redux/selectors/statsSelectors', () => ({ selectSongPlayCount: () => () => 0, selectAlbumPlayCount: () => () => 0 }));
jest.mock('@/state/redux/selectors/serversSelectors', () => ({ selectActiveServerId: () => 'server-1' }));
jest.mock('@/state/redux/selectors/wantsSelectors', () => ({ selectIsWanted: () => () => false }));
jest.mock('@/state/redux/slices/wantsSlice', () => ({
  addWant: (payload: any) => ({ type: 'wants/addWant', payload }),
  removeWant: (payload: any) => ({ type: 'wants/removeWant', payload }),
}));
jest.mock('@/providers/registry/similarityService', () => ({ useSimilarityService: () => null }));
jest.mock('@/features/playlist/generateSimilarPlaylist', () => ({
  generateSimilarPlaylistForSong: jest.fn(), generateSimilarPlaylistForAlbum: jest.fn(), useCanGeneratePlaylist: () => false,
}));
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ shares: undefined }) }));
jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingState: () => ({ currentSong: null }),
  usePlayingActions: () => ({ addToQueue: jest.fn(), playNext: jest.fn(), playSimilar: jest.fn() }),
  usePlaying: () => ({
    playSongInCollection: jest.fn(), addCollectionToQueue: jest.fn(), shuffleCollectionToQueue: jest.fn(),
    getQueue: () => [], currentSong: null, playNext: jest.fn(),
  }),
}));
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => false }));
jest.mock('@/features/offline/DownloadContext', () => ({
  useDownload: () => ({
    downloadTrack: jest.fn(), deleteDownloadedTrack: jest.fn(), isTrackDownloaded: () => false, isTrackDownloading: () => false,
    downloadAlbumById: jest.fn(), getCollectionDownloadState: () => ({ isDownloaded: false, isDownloading: false }),
  }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/downloaders/registry', () => ({
  useAnyDownloaderConnected: () => false, useAnyTrackDownloaderConnected: () => false, useAnyAlbumDownloaderConnected: () => false,
}));
jest.mock('@/features/sources/registry', () => ({ useEnabledExternalSources: () => [] }));
jest.mock('@/features/downloaders/useExternalAlbumStatus', () => ({ useExternalAlbumStatus: () => ({ kind: 'none' }) }));
jest.mock('./useLazyCollectionDetails', () => ({}), { virtual: true });
jest.mock('@/components/options/useLazyCollectionDetails', () => ({
  useLazyAlbumDetail: () => ({ albumWithSongs: null, songs: [], songsLoading: false }),
}));

const mockStarSong = jest.fn().mockResolvedValue(undefined);
const mockUnstarSong = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/library/useStarredSongs', () => ({ useStarredSongs: () => ({ songs: [] }) }));
jest.mock('@/features/library/useStarSong', () => ({ useStarSong: () => ({ mutateAsync: mockStarSong }) }));
jest.mock('@/features/library/useUnstarSong', () => ({ useUnstarSong: () => ({ mutateAsync: mockUnstarSong }) }));
jest.mock('@/features/library/useStarredAlbums', () => ({ useStarredAlbums: () => ({ albums: [] }) }));
jest.mock('@/features/library/useStarAlbum', () => ({ useStarAlbum: () => ({ mutateAsync: mockStarSong }) }));
jest.mock('@/features/library/useUnstarAlbum', () => ({ useUnstarAlbum: () => ({ mutateAsync: mockUnstarSong }) }));

jest.mock('@/components/options/GetReviewSheet', () => 'GetReviewSheet');
jest.mock('@/components/SpinningLoaderCircle', () => 'SpinningLoaderCircle');
jest.mock('@/components/options/OptionSheetPrimitives', () => {
  const { Text: RNText, View: RNView } = require('react-native');
  return {
    OptionSheetHeader: ({ title }: any) => <RNView><RNText>{title}</RNText></RNView>,
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

import * as starActions from './shared/starActions';
import SongOptions from '@/components/options/SongOptions';
import AlbumOptions from '@/components/options/AlbumOptions';
import type { Song } from '@/domain/entities/Song';
import type { Album } from '@/domain/entities/Album';

const librarySong: Song = {
  localId: 'local:song:srv:server1:s1' as Song['localId'], nativeId: 's1',
  provenance: { origin: 'server', serverId: 'server1' }, externalIds: {}, libraryState: 'in-library',
  title: 'Local Song',
  artist: { localId: 'local:artist:srv:server1:ar1' as Song['artist']['localId'], nativeId: 'ar1', name: 'Some Artist', cover: { kind: 'none' }, externalIds: {} },
  album: { localId: 'local:album:srv:server1:al1' as Song['album']['localId'], nativeId: 'al1', title: 'Local Album', cover: { kind: 'none' }, externalIds: {} },
  cover: { kind: 'none' }, durationSeconds: 180, contentKind: 'song', genres: [],
};

const libraryAlbum: Album = {
  localId: 'local:album:srv:server1:a1' as Album['localId'], nativeId: 'a1',
  provenance: { origin: 'server', serverId: 'server1' }, externalIds: {}, libraryState: 'in-library',
  title: 'Local Album', cover: { kind: 'none' },
  artist: { localId: 'local:artist:srv:server1:ar1' as Album['artist']['localId'], nativeId: 'ar1', name: 'Some Artist', cover: { kind: 'none' }, externalIds: {} },
  year: 2020, releaseType: 'album', genres: [], songIds: [],
};

/**
 * Proves the consolidation's central claim for one behaviour (starring):
 * both the song sheet and the album sheet, which used to each hand-roll
 * their own star/unstar orchestration, now call the exact same
 * `toggleFavorite` from `shared/starActions.ts` — not two independent
 * copies that happen to behave alike.
 */
describe('shared favorite implementation', () => {
  it('is the same function invoked by both the song and album favorite rows', async () => {
    const spy = jest.spyOn(starActions, 'toggleFavorite');

    const songView = await render(<SongOptions ref={null as any} selectedSong={librarySong} onAddToPlaylist={jest.fn()} />);
    songView.getByText('songOptions.actions.favorite').props.onPress();
    expect(spy).toHaveBeenCalledTimes(1);

    const albumView = await render(<AlbumOptions ref={null as any} album={libraryAlbum} />);
    albumView.getByText('albumOptions.actions.favorite').props.onPress();

    // The same spied function was called by both sheets — one shared
    // implementation, not two per-sheet reimplementations that merely look
    // alike.
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
