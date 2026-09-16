import React from 'react';
import { render } from '@testing-library/react-native';

import SongRow, { isExternalSong } from './index';
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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', favorite: '#f00' } }),
}));

jest.mock('@/features/theme/useListDensity', () => ({
  useListDensity: () => ({ rowPadding: 8, trackRowPadding: 8 }),
}));

jest.mock('@/features/playback/PlayingContext', () => ({
  usePlayingActions: () => ({ playSongInCollection: jest.fn() }),
}));

jest.mock('@/features/entity-actions/SongActionSheetContext', () => ({
  useSongActionSheets: () => ({ openSongOptions: jest.fn() }),
}));

jest.mock('@/features/offline/DownloadContext', () => ({
  useDownloadState: () => ({ isTrackDownloaded: () => false }),
}));

jest.mock('@/features/settings/sources/useSourceUse', () => ({
  useSourceUse: () => false,
}));

jest.mock('@/components/options/SongOptions', () => 'SongOptions');

jest.mock('@/components/useSheetRef', () => ({
  useSheetRef: () => ({ current: null }),
}));

jest.mock('@/components/toast', () => ({
  notify: Object.assign(jest.fn(), { info: jest.fn(), success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn() }),
}));

jest.mock('@/components/MediaListRow', () => {
  const { Text: RNText, View: RNView } = require('react-native');
  function MockMediaListRow({ title }: any) {
    return (
      <RNView>
        <RNText>{title}</RNText>
      </RNView>
    );
  }
  return MockMediaListRow;
});

// SongRow animates its favorite heart via react-native-reanimated; the
// module's own jest mock is ESM and isn't covered by the project's
// transformIgnorePatterns, so a minimal inline stub is used instead.
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v,
  };
});

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

describe('SongRow', () => {
  it('detects external-origin songs via provenance', () => {
    expect(isExternalSong(librarySong)).toBe(false);
    expect(isExternalSong(externalSong)).toBe(true);
  });

  it('renders a plain library song row', async () => {
    const view = await render(<SongRow song={librarySong} />);
    expect(view.getByText('Local Song')).toBeTruthy();
  });

  it('renders an external song row via the shared component', async () => {
    const view = await render(
      <SongRow
        song={externalSong}
        albumTitle="External Album"
        albumArtist="External Artist"
      />
    );
    expect(view.getByText('External Song')).toBeTruthy();
  });
});
