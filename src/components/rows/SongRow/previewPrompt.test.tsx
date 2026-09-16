import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import SongRow from './index';
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { integrationProvenance } from '@/domain/identity/Provenance';

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
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666' } }),
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
// Previews are off: the row has to ask.
jest.mock('@/features/settings/sources/useSourceUse', () => ({
  useSourceUse: () => false,
}));
jest.mock('@/features/settings/sources/sourceUsePrompt', () => ({
  promptSourceUse: (...args: unknown[]) => mockPrompt(...args),
}));
jest.mock('@/components/options/SongOptions', () => 'SongOptions');
jest.mock('@/components/useSheetRef', () => ({
  useSheetRef: () => ({ current: null }),
}));
jest.mock('@/components/MediaListRow', () => {
  const { Text } = require('react-native');
  return function MockMediaListRow({ title, onPress }: { title: string; onPress: () => void }) {
    return <Text onPress={onPress}>{title}</Text>;
  };
});
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

/* eslint-disable no-var -- hoisted for the jest.mock factories above */
var mockPrompt = jest.fn();
/* eslint-enable no-var */

const provenance = integrationProvenance('deezer');
const outsideSong: Song = {
  localId: makeLocalId('song', provenance, 'dz-1'),
  nativeId: 'dz-1',
  provenance,
  externalIds: {},
  libraryState: 'external',
  title: 'Blunts',
  artist: { localId: makeLocalId('artist', provenance, 'dz-ar'), nativeId: 'dz-ar', externalIds: {}, name: 'Artist', cover: { kind: 'none' } },
  album: { localId: makeLocalId('album', provenance, 'dz-al'), nativeId: 'dz-al', externalIds: {}, title: 'Album', cover: { kind: 'none' } },
  cover: { kind: 'none' },
  durationSeconds: 30,
  contentKind: 'song',
  genres: [],
};

describe('tapping an outside track with previews off', () => {
  beforeEach(() => {
    mockPrompt.mockReset();
    jest.useRealTimers();
  });

  it('plays the tapped track once previews are on and its clip arrives, without a second tap', async () => {
    const view = await render(<SongRow song={outsideSong} albumTitle="Album" albumArtist="Artist" />);

    await fireEvent.press(view.getByText('Blunts'));
    expect(mockPrompt).toHaveBeenCalledWith('deezer.previews', expect.objectContaining({ onTurnOn: expect.any(Function) }));

    // The user says yes; the clip is fetched and the album hands the row its play action.
    await act(async () => mockPrompt.mock.calls[0][1].onTurnOn());
    const play = jest.fn();
    await view.rerender(<SongRow song={outsideSong} albumTitle="Album" albumArtist="Artist" previewUrl="https://clip" onPress={play} />);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not play the track later on if no clip turned up in time', async () => {
    jest.useFakeTimers();
    const view = await render(<SongRow song={outsideSong} albumTitle="Album" albumArtist="Artist" />);

    await fireEvent.press(view.getByText('Blunts'));
    await act(async () => mockPrompt.mock.calls[0][1].onTurnOn());
    await act(async () => { jest.advanceTimersByTime(11_000); });

    const play = jest.fn();
    await view.rerender(<SongRow song={outsideSong} albumTitle="Album" albumArtist="Artist" previewUrl="https://clip" onPress={play} />);

    expect(play).not.toHaveBeenCalled();
  });
});
