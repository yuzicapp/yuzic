import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { Song } from '@/domain/entities/Song';
import SongRow from './index';

/**
 * The surface half of the local-first rule: a row handed a browsed track that
 * the library already holds renders the *library* row — full duration, the
 * library options sheet — rather than the browse-only row with its sample.
 * `features/library/localFirst.test.ts` covers the rule itself.
 */

const mockOpenSongOptions = jest.fn();
let mockLibrary: Song[] = [];

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : () => null) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: {}, isDarkMode: false }) }));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ thumb: 6, pill: 999, pillFor: (n: number) => n / 2 }) }));
jest.mock('@/features/theme/useListDensity', () => ({ useListDensity: () => ({ rowPadding: 8, rowGap: 8, trackRowPadding: 4 }) }));
jest.mock('@/components/MediaImage', () => {
  const { View } = require('react-native');
  return { MediaImage: () => <View /> };
});
jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingActions: () => ({ playSongInCollection: jest.fn() }),
}));
jest.mock('@/features/entity-actions/SongActionSheetContext', () => ({
  useSongActionSheets: () => ({ openSongOptions: mockOpenSongOptions }),
}));
jest.mock('@/features/offline/DownloadContext', () => ({
  useDownloadState: () => ({ isTrackDownloaded: () => false }),
}));
jest.mock('@/features/settings/sources/useSourceUse', () => ({ useSourceUse: () => true }));
jest.mock('@/features/settings/sources/sourceUsePrompt', () => ({ promptSourceUse: jest.fn() }));
jest.mock('@/components/options/SongOptions', () => 'SongOptions');
jest.mock('@/components/useSheetRef', () => ({ useSheetRef: () => ({ current: null }) }));
// The library the rule matches against — the real index, fed by this list.
jest.mock('@/features/album/useAlbums', () => ({ useAlbums: () => ({ albums: [] }) }));
jest.mock('@/features/artist/useArtists', () => ({ useArtists: () => ({ artists: [] }) }));
jest.mock('@/features/song/useTracks', () => ({ useTracks: () => ({ tracks: mockLibrary }) }));

const artistRef = {
  localId: 'local:artist:srv:s1:a1' as Song['artist']['localId'],
  nativeId: 'a1', name: 'Boards of Canada', cover: { kind: 'none' as const }, externalIds: {},
};
const albumRef = {
  localId: 'local:album:srv:s1:al1' as Song['album']['localId'],
  nativeId: 'al1', title: 'Geogaddi', cover: { kind: 'none' as const }, externalIds: {},
};

const librarySong: Song = {
  localId: 'local:song:srv:s1:s1' as Song['localId'],
  nativeId: 's1',
  provenance: { origin: 'server', serverId: 's1' },
  externalIds: {},
  libraryState: 'in-library',
  title: 'Roygbiv',
  artist: artistRef,
  album: albumRef,
  cover: { kind: 'none' },
  durationSeconds: 310,
  contentKind: 'song',
  genres: [],
};

const browsedSong: Song = {
  ...librarySong,
  localId: 'local:song:int:deezer:x1' as Song['localId'],
  nativeId: 'x1',
  provenance: { origin: 'integration', providerId: 'deezer' },
  libraryState: 'external',
  contentKind: 'preview',
  durationSeconds: 30,
  streamId: 'https://cdn.deezer.example/clip.mp3',
};

beforeEach(() => {
  mockLibrary = [];
  mockOpenSongOptions.mockClear();
});

describe('SongRow, local first', () => {
  it('renders a browsed track the library holds as the library row', async () => {
    mockLibrary = [librarySong];

    const view = await render(<SongRow song={browsedSong} />);

    // The library row is the one with a testID and the full duration beside
    // the artist; the browse-only row has neither.
    expect(view.getByTestId('song-row')).toBeTruthy();
    expect(view.getByText('Boards of Canada • 5:10')).toBeTruthy();
  });

  it('opens the library options sheet for it, not the browse-only one', async () => {
    mockLibrary = [librarySong];

    const view = await render(<SongRow song={browsedSong} />);
    await fireEvent.press(view.getByLabelText('a11y.rows.options'));

    expect(mockOpenSongOptions).toHaveBeenCalledWith(librarySong);
  });

  it('keeps the browse-only row when the library has no copy', async () => {
    mockLibrary = [];

    const view = await render(<SongRow song={browsedSong} />);

    expect(view.queryByTestId('song-row')).toBeNull();
    expect(mockOpenSongOptions).not.toHaveBeenCalled();
  });
});
