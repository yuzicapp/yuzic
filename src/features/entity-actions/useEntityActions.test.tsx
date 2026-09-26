import { act, renderHook } from '@testing-library/react-native';

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
jest.mock('@/features/sources/useMatchedNavigation', () => ({
  useMatchedNavigation: () => ({ navigateToAlbum: jest.fn(), navigateToArtist: jest.fn() }),
}));
jest.mock('@/features/shares/share', () => ({ shareItem: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', muted: '#333', placeholder: '#999' }, isDarkMode: false }),
}));
jest.mock('@/components/haptics', () => ({
  __esModule: true,
  default: { selection: jest.fn(), tap: jest.fn(), primary: jest.fn(), heavy: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() },
  selection: jest.fn(),
}));
jest.mock('@/components/toast', () => ({
  notify: Object.assign(jest.fn(), { info: jest.fn(), success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn() }),
}));
// The rating row reads the real `selectRatingOverrides`, so the fake state
// has to carry the slice, empty.
jest.mock('react-redux', () => ({ useSelector: (selector: any) => selector({ ratings: { byServer: {} } }), useDispatch: () => jest.fn() }));
jest.mock('@/state/redux/selectors/statsSelectors', () => ({
  selectSongPlayCount: () => () => 0, selectAlbumPlayCount: () => () => 0, selectArtistPlayCount: () => () => 0,
}));
jest.mock('@/state/redux/selectors/serversSelectors', () => ({ selectActiveServerId: () => 'server-1' }));
jest.mock('@/state/redux/selectors/wantsSelectors', () => ({ selectIsWanted: () => () => false }));
jest.mock('@/state/redux/slices/wantsSlice', () => ({
  addWant: (payload: any) => ({ type: 'wants/addWant', payload }),
  removeWant: (payload: any) => ({ type: 'wants/removeWant', payload }),
}));
jest.mock('@/providers/registry/similarityService', () => ({ useSimilarityService: () => null }));
jest.mock('@/features/playlist/generateSimilarPlaylist', () => ({
  generateSimilarPlaylistForSong: jest.fn(), generateSimilarPlaylistForAlbum: jest.fn(), generateSimilarPlaylistForArtist: jest.fn(),
  useCanGeneratePlaylist: () => false,
}));
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ shares: undefined }) }));
jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingState: () => ({ currentSong: null }),
  usePlayingActions: () => ({
    addToQueue: jest.fn(), playNext: jest.fn(), playSimilar: jest.fn(),
    playSongInCollection: jest.fn(), addCollectionToQueue: jest.fn(), shuffleCollectionToQueue: jest.fn(), getQueue: () => [],
  }),
  usePlaying: () => ({
    playSongInCollection: jest.fn(), addCollectionToQueue: jest.fn(), shuffleCollectionToQueue: jest.fn(),
    getQueue: () => [], currentSong: null, playNext: jest.fn(),
  }),
}));
jest.mock('@/features/connectivity/useIsOffline', () => ({ useIsOffline: () => false }));
jest.mock('@/features/offline/DownloadContext', () => ({
  useDownload: () => ({
    downloadTrack: jest.fn(), deleteDownloadedTrack: jest.fn(), isTrackDownloaded: () => false, isTrackDownloading: () => false,
    downloadAlbumById: jest.fn(), downloadPlaylistById: jest.fn(), getCollectionDownloadState: () => ({ isDownloaded: false, isDownloading: false }),
  }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@/features/downloaders/registry', () => ({
  useAnyDownloaderConnected: () => false, useAnyTrackDownloaderConnected: () => false, useAnyAlbumDownloaderConnected: () => false,
}));
jest.mock('@/features/sources/registry', () => ({ useEnabledExternalSources: () => [] }));
jest.mock('@/features/downloaders/useExternalAlbumStatus', () => ({ useExternalAlbumStatus: () => ({ kind: 'none' }) }));
jest.mock('@/features/artist/useArtistAlbums', () => ({ useArtistAlbums: () => [] }));
jest.mock('@/features/playlist/useDeletePlaylist', () => ({ useDeletePlaylist: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
jest.mock('@/features/playlist/useRenamePlaylist', () => ({ useRenamePlaylist: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/components/options/useLazyCollectionDetails', () => ({
  useLazyAlbumDetail: () => ({ albumWithSongs: null, songs: [], songsLoading: false }),
  useLazyArtistSongs: () => ({ songs: [], songsLoading: false }),
  useLazyPlaylistDetail: () => ({ playlistWithSongs: null, songs: [], songsLoading: false }),
}));
jest.mock('@/features/library/useStarredSongs', () => ({ useStarredSongs: () => ({ songs: [] }) }));
jest.mock('@/features/library/useStarSong', () => ({ useStarSong: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/library/useUnstarSong', () => ({ useUnstarSong: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/library/useStarredAlbums', () => ({ useStarredAlbums: () => ({ albums: [] }) }));
jest.mock('@/features/library/useStarAlbum', () => ({ useStarAlbum: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/features/library/useUnstarAlbum', () => ({ useUnstarAlbum: () => ({ mutateAsync: jest.fn() }) }));

import {
  useSongLibraryActions,
  useSongExternalActions,
  useAlbumLibraryActions,
  useAlbumExternalActions,
  useArtistOptionsActions,
  usePlaylistOptionsActions,
} from './useEntityActions';
import type { Song } from '@/domain/entities/Song';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Playlist } from '@/domain/entities/Playlist';

const song: Song = {
  localId: 'local:song:srv:server1:s1' as Song['localId'], nativeId: 's1',
  provenance: { origin: 'server', serverId: 'server1' }, externalIds: {}, title: 'Local Song',
  artist: { localId: 'local:artist:srv:server1:ar1' as Song['artist']['localId'], nativeId: 'ar1', name: 'Some Artist', cover: { kind: 'none' }, externalIds: {} },
  album: { localId: 'local:album:srv:server1:al1' as Song['album']['localId'], nativeId: 'al1', title: 'Local Album', cover: { kind: 'none' }, externalIds: {} },
  cover: { kind: 'none' }, durationSeconds: 180, contentKind: 'song', genres: [],
};

const externalSong: Song = {
  ...song, localId: 'local:song:ext:deezer:1' as Song['localId'], nativeId: 'ext-1',
  provenance: { origin: 'integration', providerId: 'deezer' }, contentKind: 'preview',
};

const album: Album = {
  localId: 'local:album:srv:server1:a1' as Album['localId'], nativeId: 'a1',
  provenance: { origin: 'server', serverId: 'server1' }, externalIds: {}, title: 'Local Album', cover: { kind: 'none' },
  artist: { localId: 'local:artist:srv:server1:ar1' as Album['artist']['localId'], nativeId: 'ar1', name: 'Some Artist', cover: { kind: 'none' }, externalIds: {} },
  year: 2020, releaseType: 'album', genres: [], songIds: [],
};

const externalAlbum: Album = {
  ...album, localId: 'local:album:ext:deezer:1' as Album['localId'], nativeId: 'ext-a1',
  provenance: { origin: 'integration', providerId: 'deezer' },
};

const artist: Artist = {
  localId: 'local:artist:srv:server1:ar1' as Artist['localId'], nativeId: 'ar1',
  provenance: { origin: 'server', serverId: 'server1' }, externalIds: {}, cover: { kind: 'none' }, name: 'Some Artist', tags: [], albumIds: [],
};

const playlist: Playlist = {
  localId: 'local:playlist:srv:server1:p1' as Playlist['localId'], nativeId: 'p1',
  provenance: { origin: 'server', serverId: 'server1' }, externalIds: {}, title: 'My Mix', cover: { kind: 'none' }, isOwned: true, songIds: [],
};

/**
 * Exercises `useEntityActions.ts`'s public surface — the family of hooks the
 * four sheets are built on — end to end (real hooks, mocked leaf
 * dependencies), rather than importing the underlying `hooks/*.ts` files
 * directly. Each sheet imports its own hook straight from `hooks/*.ts` (so
 * a song sheet's test doesn't drag in playlist rename/delete wiring, etc.),
 * so this file is what actually exercises the barrel other tests assume is
 * just documentation.
 */
describe('useEntityActions', () => {
  const close = jest.fn();

  it('useSongLibraryActions resolves the library song action set', async () => {
    const { result } = await renderHook(() => useSongLibraryActions(song, { onAddToPlaylist: jest.fn(), onRating: jest.fn(), close }));
    expect(result.current.actions.map(a => a.id)).toContain('favorite');
    expect(result.current.actions.map(a => a.id)).toContain('instantMix');
  });

  /**
   * Download was the one row in all four sheets that never dismissed. Every
   * other action closes, a download runs for minutes, and the sheet sat over
   * the screen the whole time hiding the thing being downloaded.
   */
  it.each([
    ['song', () => useSongLibraryActions(song, { onAddToPlaylist: jest.fn(), onRating: jest.fn(), close })],
    ['album', () => useAlbumLibraryActions(album, { hideGoToAlbum: false, isSheetOpen: false, onRating: jest.fn(), close })],
    ['playlist', () => usePlaylistOptionsActions(playlist, { hideGoToPlaylist: false, isSheetOpen: false, close })],
  ])('closes the %s sheet when a download starts', async (_kind, useActions) => {
    close.mockClear();
    const { result } = await renderHook(useActions as () => { actions: { id: string; onPress: () => void }[] });
    const download = result.current.actions.find(a => a.id === 'download');
    expect(download).toBeDefined();
    await act(async () => { download!.onPress(); });
    expect(close).toHaveBeenCalled();
  });

  it('useSongExternalActions resolves the external song action set', async () => {
    const { result } = await renderHook(() => useSongExternalActions(externalSong, {
      albumTitle: 'Album', albumArtist: 'Artist', close, openAlbumGet: jest.fn(), openTrackGet: jest.fn(),
    }));
    expect(result.current.actions.map(a => a.id)).toEqual(['want']);
  });

  it('useAlbumLibraryActions resolves the library album action set', async () => {
    const { result } = await renderHook(() => useAlbumLibraryActions(album, { hideGoToAlbum: false, isSheetOpen: false, onRating: jest.fn(), close }));
    expect(result.current.actions.map(a => a.id)).toContain('addToNext');
  });

  it('useAlbumExternalActions resolves the external album action set', async () => {
    const { result } = await renderHook(() => useAlbumExternalActions(externalAlbum, { close, openGet: jest.fn() }));
    expect(result.current.actions.map(a => a.id)).toContain('noServiceConnected');
  });

  it('useArtistOptionsActions resolves the artist action set', async () => {
    const { result } = await renderHook(() => useArtistOptionsActions(artist, { hideGoToArtist: false, isSheetOpen: false, close }));
    const ids = result.current.actions.map(a => a.id);
    expect(ids).toContain('play');
    expect(ids).not.toContain('addToNext');
  });

  it('usePlaylistOptionsActions resolves the playlist action set', async () => {
    const { result } = await renderHook(() => usePlaylistOptionsActions(playlist, { hideGoToPlaylist: false, isSheetOpen: false, close }));
    const ids = result.current.actions.map(a => a.id);
    expect(ids).toContain('rename');
    expect(ids).toContain('delete');
  });
});
