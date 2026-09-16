import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import GetReviewSheet from './GetReviewSheet';
import type { Album } from '@/domain/entities/Album';

jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { secondary: '#000', subtext: '#666', border: '#ccc', background: '#fff', placeholder: '#999' },
    isDarkMode: false,
  }),
}));

jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ lg: 16, card: 8, pill: 999, pillFor: (n: number) => n / 2 }),
}));

jest.mock('@/components/BottomSheetBackdrop', () => ({
  renderBackdrop: () => null,
}));

jest.mock('@/components/toast', () => ({
  notify: Object.assign(jest.fn(), { info: jest.fn(), success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn() }),
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
    // Row is keyed by testID so a provider row can be pressed unambiguously —
    // the visible label text is asserted separately.
    OptionSheetRow: ({ label, description, onPress, disabled, trailing }: any) => (
      <RNView>
        <RNText testID={`row-${label}`} onPress={onPress} disabled={disabled}>{label}</RNText>
        {description !== undefined && <RNText>{description}</RNText>}
        {trailing}
      </RNView>
    ),
    OptionSheetInfoRow: ({ label, value }: any) => <RNText>{label}: {value}</RNText>,
    OptionSheetSectionLabel: ({ label }: any) => <RNText>{label}</RNText>,
    OptionSheetDivider: () => <RNView />,
    optionSheetStyles: { sheetBackground: {}, sheetContent: {}, loading: {} },
    useOptionSheetBackground: () => ({}),
    useOptionSheetContentStyle: () => ({}),
  };
});

const mockDispatch = jest.fn();
let mockState: any = {};

jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector(mockState),
  useDispatch: () => mockDispatch,
}));

jest.mock('@/state/redux/selectors/serversSelectors', () => ({
  selectActiveServer: (state: any) => state.servers?.activeServer ?? null,
  selectActiveServerId: (state: any) => state.servers?.activeServerId ?? null,
}));

const mockIsWanted = jest.fn(() => false);
jest.mock('@/state/redux/selectors/wantsSelectors', () => ({
  selectIsWanted: (_localId: string) => () => mockIsWanted(),
}));

jest.mock('@/state/redux/slices/wantsSlice', () => ({
  setWantJobRef: (payload: any) => ({ type: 'wants/setWantJobRef', payload }),
}));

jest.mock('@/state/redux/selectors/downloadersSelectors', () => ({
  selectDefaultProviderForActiveServer: (state: any) => state.downloaders?.defaultsByServer?.['server-1'] ?? {},
  selectDefaultQualityProfileId: (state: any) =>
    state.downloaders?.defaultsByServer?.['server-1']?.lidarrDefaultQualityProfileId,
}));

jest.mock('@/state/redux/slices/downloadersSlice', () => ({
  setDefaultProvider: (payload: any) => ({ type: 'downloaders/setDefaultProvider', payload }),
  setDefaultQualityProfileId: (payload: any) => ({
    type: 'downloaders/setDefaultQualityProfileId',
    payload,
  }),
}));

const mockGetQualityProfiles = jest.fn(async (..._args: unknown[]) => [
  { id: 1, name: 'Standard' },
  { id: 4, name: 'Lossless' },
]);

const mockDownloaderStates = jest.fn();
jest.mock('@/features/downloaders/registry', () => ({
  downloadErrorKey: (id: string, code?: string) => `externalAlbum.download.errors.${id}.${code}`,
  useDownloaderStates: () => mockDownloaderStates(),
}));

const mockLoadAlbumTracks = jest.fn();
jest.mock('@/features/downloaders/albumTracks', () => ({
  useAlbumTrackLoader: () => mockLoadAlbumTracks,
}));

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

const lidarrDownloadAlbum = jest.fn(async () => ({ success: true as const }));
const slskdDownloadAlbum = jest.fn(async () => ({ success: true as const }));

function makeDownloaderStates() {
  return [
    {
      def: {
        id: 'lidarr',
        label: 'Lidarr',
        descriptionKey: 'externalAlbum.download.lidarrDesc',
        albumAddedKey: 'externalAlbum.download.addedToLidarr',
        downloadAlbum: lidarrDownloadAlbum,
        getQualityProfiles: (...args: unknown[]) => mockGetQualityProfiles(...args),
      },
      config: { serverUrl: 'http://lidarr', apiKey: 'k1' },
      isConnected: true,
    },
    {
      def: {
        id: 'slskd',
        label: 'slskd',
        descriptionKey: 'externalAlbum.download.slskdDesc',
        albumAddedKey: 'externalAlbum.download.addedToSlskd',
        trackAddedKey: 'externalAlbum.download.addedTrackToSlskd',
        downloadAlbum: slskdDownloadAlbum,
      },
      config: { serverUrl: 'http://slskd', apiKey: 'k2' },
      isConnected: true,
    },
  ];
}

describe('GetReviewSheet', () => {
  beforeEach(() => {
    mockDownloaderStates.mockReset().mockReturnValue(makeDownloaderStates());
    mockIsWanted.mockReset().mockReturnValue(false);
    mockDispatch.mockClear();
    lidarrDownloadAlbum.mockClear();
    slskdDownloadAlbum.mockClear();
    mockGetQualityProfiles.mockClear();
    mockState = {
      servers: { activeServer: { id: 'server-1', serverUrl: 'My Server' }, activeServerId: 'server-1' },
      downloaders: { defaultsByServer: {} },
    };
  });

  it('renders the target server and every connected provider for the unit', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);
    expect(view.getByText(/My Server/)).toBeTruthy();
    expect(view.getByText('Lidarr')).toBeTruthy();
    expect(view.getByText('slskd')).toBeTruthy();
  });

  it('shows a Requesting line with the title/artist being asked for', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);
    expect(view.getByText(/External Album — External Artist/)).toBeTruthy();
  });

  it('does not preselect any provider and starts no job when there is no saved default', async () => {
    await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);
    // Nothing fires on mount — Get always needs an explicit tap on a provider
    // row first, saved default or not.
    expect(lidarrDownloadAlbum).not.toHaveBeenCalled();
    expect(slskdDownloadAlbum).not.toHaveBeenCalled();
  });

  it('preselects the saved default provider for the unit when it is still available', async () => {
    mockState.downloaders.defaultsByServer['server-1'] = { defaultAlbumProvider: 'slskd' };
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);
    // The preselected row means Get is already actionable without tapping a
    // row first — but the tap on Get is still required for the job to start.
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();
    expect(slskdDownloadAlbum).toHaveBeenCalledTimes(1);
    expect(lidarrDownloadAlbum).not.toHaveBeenCalled();
  });

  it('never starts a job before Get is tapped, even with a preselected default', async () => {
    mockState.downloaders.defaultsByServer['server-1'] = { defaultAlbumProvider: 'lidarr' };
    await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);
    expect(lidarrDownloadAlbum).not.toHaveBeenCalled();
    expect(slskdDownloadAlbum).not.toHaveBeenCalled();
  });

  it('tapping Get calls the selected provider and dismisses on success', async () => {
    // `ref={sheetRef}` on a class-component BottomSheetModal makes React
    // overwrite `sheetRef.current` with the real instance on mount, so the
    // dismiss spy has to be attached to that instance after render rather
    // than passed in pre-populated.
    const sheetRef = { current: null } as any;
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={sheetRef} />);
    const dismiss = jest.spyOn(sheetRef.current, 'dismiss');

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(lidarrDownloadAlbum).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('does not persist a request-only provider choice unless "save as default" is toggled', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'downloaders/setDefaultProvider' })
    );
  });

  it('persists the chosen provider as the unit default only when "save as default" is toggled', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await fireEvent.press(view.getByText('externalAlbum.review.saveAsDefaultAlbums'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'downloaders/setDefaultProvider',
      payload: { serverId: 'server-1', unit: 'album', provider: 'lidarr' },
    });
  });

  it('sets the wanted entity jobRef on a successful Get for a wanted item', async () => {
    mockIsWanted.mockReturnValue(true);
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'wants/setWantJobRef',
        payload: expect.objectContaining({ serverId: 'server-1', localId: externalAlbum.localId }),
      })
    );
  });

  it('does not touch the want when the entity is not wanted', async () => {
    mockIsWanted.mockReturnValue(false);
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'wants/setWantJobRef' })
    );
  });

  it('shows the quality-profile selector only when a downloader with profiles is selected for an album Get', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    // Nothing selected yet — no quality-profile section.
    expect(view.queryByText('externalAlbum.review.qualityProfile')).toBeNull();

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await flush();
    expect(view.getByText('externalAlbum.review.qualityProfile')).toBeTruthy();
    expect(view.getByTestId('row-Lossless')).toBeTruthy();

    await fireEvent.press(view.getByTestId('row-slskd'));
    await flush();
    expect(view.queryByText('externalAlbum.review.qualityProfile')).toBeNull();
  });

  it('does not show a quality-profile selector for a track Get', async () => {
    const view = await render(
      <GetReviewSheet
        album={externalAlbum}
        track={{ title: 'A Song', artist: 'External Artist' }}
        sheetRef={{ current: null } as any}
      />
    );

    // Lidarr has no downloadTrack, so it isn't even offered as an option for
    // a track Get — nothing to select, and no quality-profile section either.
    expect(view.queryByTestId('row-Lidarr')).toBeNull();
    expect(view.queryByText('externalAlbum.review.qualityProfile')).toBeNull();
  });

  it('passes the chosen quality profile to downloadAlbum as a request-only override', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await flush();
    await fireEvent.press(view.getByTestId('row-Lossless'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(lidarrDownloadAlbum).toHaveBeenCalledWith(
      expect.anything(),
      externalAlbum,
      { qualityProfileId: 4 }
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'downloaders/setDefaultQualityProfileId' })
    );
  });

  it('persists the bumped quality profile as the new default only when "save as default" is toggled', async () => {
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-Lidarr'));
    await flush();
    await fireEvent.press(view.getByTestId('row-Lossless'));
    await fireEvent.press(view.getByText('externalAlbum.review.saveAsDefaultAlbums'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'downloaders/setDefaultQualityProfileId',
      payload: { serverId: 'server-1', qualityProfileId: 4 },
    });
  });
});

describe('GetReviewSheet with a downloader that takes only tracks', () => {
  const soulsyncDownloadTrack = jest.fn(async (..._args: unknown[]) => ({ success: true as const }));
  const soulsync = {
    def: {
      id: 'soulsync',
      label: 'SoulSync',
      descriptionKey: 'externalAlbum.download.soulsyncDesc',
      albumAddedKey: 'externalAlbum.download.addedToSoulsync',
      trackAddedKey: 'externalAlbum.download.addedTrackToSoulsync',
      downloadTrack: soulsyncDownloadTrack,
    },
    config: { serverUrl: 'http://soulsync', apiKey: 'k3' },
    isConnected: true,
  };

  beforeEach(() => {
    mockDownloaderStates.mockReset().mockReturnValue([soulsync]);
    soulsyncDownloadTrack.mockClear();
    mockLoadAlbumTracks.mockReset().mockResolvedValue([
      { title: 'First', artist: 'External Artist' },
      { title: 'Second', artist: 'External Artist' },
    ]);
    mockState = {
      servers: { activeServer: { id: 'server-1', serverUrl: 'My Server' }, activeServerId: 'server-1' },
      downloaders: { defaultsByServer: {} },
    };
  });

  it('offers it for an album, and requests the album as its tracks', async () => {
    const { notify } = require('@/components/toast');
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-SoulSync'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(mockLoadAlbumTracks).toHaveBeenCalledWith(externalAlbum);
    expect(soulsyncDownloadTrack.mock.calls.map(([, req]) => req)).toEqual([
      { title: 'First', artist: 'External Artist' },
      { title: 'Second', artist: 'External Artist' },
    ]);
    expect(notify.success).toHaveBeenCalledWith('externalAlbum.download.addedToSoulsync');
  });

  it("says so when the album's tracks can't be listed", async () => {
    const { notify } = require('@/components/toast');
    mockLoadAlbumTracks.mockResolvedValue([]);
    const view = await render(<GetReviewSheet album={externalAlbum} sheetRef={{ current: null } as any} />);

    await fireEvent.press(view.getByTestId('row-SoulSync'));
    await fireEvent.press(view.getByText('externalAlbum.review.confirmGet'));
    await flush();

    expect(soulsyncDownloadTrack).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('externalAlbum.download.errors.soulsync.no_tracks');
  });
});

/** Lets the pending `handleGet` promise chain settle before assertions run. */
async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
