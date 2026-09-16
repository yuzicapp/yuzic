import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import WantsScreen from './WantsScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: any) => (opts?.title ? `${key}:${opts.title}` : key) }),
}));

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: mockNavigate }),
}));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#000', subtext: '#666', background: '#fff' } }),
}));

jest.mock('@/features/theme/useScrollClearance', () => ({
  useScrollClearance: () => 0,
}));

jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ lg: 16, card: 8, thumb: 8, pill: 999, md: 8, pillFor: (n: number) => n / 2 }),
}));

jest.mock('@/features/theme/useListDensity', () => ({
  useListDensity: () => ({ rowPadding: 8, rowGap: 8, trackRowPadding: 4 }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

// Captures what each row hands the image layer, which is where the one
// picture rule takes over.
const mockMediaImage = jest.fn();
jest.mock('@/components/MediaImage', () => {
  const { View } = require('react-native');
  return {
    MediaImage: (props: { cover: unknown }) => { mockMediaImage(props.cover); return <View testID="media-image-mock" />; },
  };
});

jest.mock('@/components/DetailHeader', () => {
  const { Text, View } = require('react-native');
  return {
    DetailHeaderBar: ({ title, subtitle }: any) => (
      <View><Text>{title}</Text>{subtitle ? <Text>{subtitle}</Text> : null}</View>
    ),
  };
});

jest.mock('@/components/options/WantOptions', () => {
  const { Text, View } = require('react-native');
  return {
    WantOptions: ({ onSearch, onRemove, onOpen, onGet }: any) => (
      <View testID="want-options-sheet">
        <Text testID="want-option-search" onPress={onSearch}>search</Text>
        <Text testID="want-option-open" onPress={onOpen}>open</Text>
        <Text testID="want-option-get" onPress={onGet}>get</Text>
        <Text testID="want-option-remove" onPress={onRemove}>remove</Text>
      </View>
    ),
  };
});

const mockGetSheet = jest.fn();
jest.mock('./WantGetSheet', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { want: { localId: string } }) => {
      mockGetSheet(props.want);
      return <View testID="want-get-sheet" />;
    },
  };
});

let mockStatus: any = { kind: 'saved' };
jest.mock('./useWantRowStatus', () => ({
  useWantRowStatus: () => () => mockStatus,
}));

const mockNavigateToAlbum = jest.fn();
const mockNavigateToArtist = jest.fn();
jest.mock('@/features/sources/useMatchedNavigation', () => ({
  useMatchedNavigation: () => ({
    navigateToAlbum: mockNavigateToAlbum,
    navigateToArtist: mockNavigateToArtist,
  }),
}));

jest.mock('@/components/EmptyState', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ message, action }: any) => (
      <View>
        <Text>{message}</Text>
        {action ? (
          <Text testID="empty-action" onPress={action.onPress}>{action.label}</Text>
        ) : null}
      </View>
    ),
  };
});

let mockWants: any[] = [];
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({ __mockWants: true }),
  useDispatch: () => mockDispatch,
}));

jest.mock('@/state/redux/selectors/wantsSelectors', () => ({
  selectWantsForActiveServer: () => mockWants,
}));
jest.mock('@/state/redux/selectors/serversSelectors', () => ({
  selectActiveServerId: () => 'server-1',
}));
jest.mock('@/state/redux/slices/wantsSlice', () => ({
  removeWant: (payload: any) => ({ type: 'wants/removeWant', payload }),
}));

const ALBUM_COVER = { kind: 'none', subject: { kind: 'album', title: 'Album Title', artistName: 'Album Artist' } };

const trackWant = {
  localId: 'local:song:ext:deezer:1', title: 'My Title', artist: 'My Artist', unit: 'track',
  origin: 'manual', createdAt: 1, updatedAt: 1,
};
const albumWant = {
  localId: 'local:album:ext:deezer:2', title: 'Album Title', artist: 'Album Artist', unit: 'album',
  cover: ALBUM_COVER, origin: 'manual', createdAt: 2, updatedAt: 2,
};
const artistWant = {
  localId: 'local:artist:ext:deezer:3', title: 'Some Artist', artist: 'Some Artist', unit: 'artist',
  origin: 'artist-page', createdAt: 3, updatedAt: 3,
};

describe('WantsScreen', () => {
  beforeEach(() => {
    mockWants = [];
    mockStatus = { kind: 'saved' };
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    mockMediaImage.mockClear();
    mockGetSheet.mockClear();
    mockNavigateToAlbum.mockClear();
    mockNavigateToArtist.mockClear();
  });

  it('shows the empty state with zero providers/wants', async () => {
    const view = await render(<WantsScreen />);
    expect(view.getByText('wants.empty')).toBeTruthy();
  });

  it('lists every saved want', async () => {
    mockWants = [trackWant, albumWant];
    const view = await render(<WantsScreen />);

    expect(view.getAllByTestId('want-row')).toHaveLength(2);
    expect(view.getByText('My Title')).toBeTruthy();
    expect(view.getByText('Album Title')).toBeTruthy();
  });

  /**
   * The artwork half of the bug. A want stored no cover, and the row drew a
   * hardcoded `{ kind: 'none' }` — a gap about nobody, which the one picture
   * rule returns untouched. The row hands over the cover the want saved now,
   * and the rule resolves it like any other.
   */
  it('draws each want through the cover it was saved with', async () => {
    mockWants = [albumWant];
    await render(<WantsScreen />);

    expect(mockMediaImage).toHaveBeenCalledWith(ALBUM_COVER);
  });

  it('navigates to Search from the empty-state action', async () => {
    const view = await render(<WantsScreen />);
    fireEvent.press(view.getByTestId('empty-action'));

    expect(mockNavigate).toHaveBeenCalledWith('/(home)/(tabs)/(search)');
  });

  it('opens the catalogue album when a release want is pressed', async () => {
    mockWants = [albumWant];
    const view = await render(<WantsScreen />);

    await fireEvent.press(view.getByTestId('want-row'));

    // Through the app's one external-resolution path, which lands on the
    // library's own copy where there is one.
    expect(mockNavigateToAlbum).toHaveBeenCalledTimes(1);
    expect(mockNavigateToAlbum.mock.calls[0][0]).toMatchObject({ title: 'Album Title', nativeId: '2' });
  });

  it('opens the artist page when an artist want is pressed', async () => {
    mockWants = [artistWant];
    const view = await render(<WantsScreen />);

    await fireEvent.press(view.getByTestId('want-row'));

    expect(mockNavigateToArtist).toHaveBeenCalledTimes(1);
    expect(mockNavigateToArtist.mock.calls[0][0]).toMatchObject({ name: 'Some Artist', nativeId: '3' });
  });

  it('shows what a downloader is doing with a want', async () => {
    mockWants = [albumWant];
    mockStatus = { kind: 'downloading', progress: 42 };
    const view = await render(<WantsScreen />);

    expect(view.getByTestId('want-status-downloading')).toBeTruthy();
  });

  it('says nothing on a saved want — the row is the statement', async () => {
    mockWants = [albumWant];
    const view = await render(<WantsScreen />);

    expect(view.queryByTestId('want-status-saved')).toBeNull();
  });

  it('opens no Get sheet until the row asks for one — wanting never starts a download', async () => {
    mockWants = [albumWant];
    const view = await render(<WantsScreen />);

    expect(view.queryByTestId('want-get-sheet')).toBeNull();
    expect(mockGetSheet).not.toHaveBeenCalled();
  });

  it('sends a release want to the normal Get review when asked', async () => {
    mockWants = [albumWant];
    const view = await render(<WantsScreen />);

    await fireEvent.press(view.getByTestId('want-options'));
    await fireEvent.press(view.getByTestId('want-option-get'));

    expect(mockGetSheet).toHaveBeenCalledWith(expect.objectContaining({ localId: albumWant.localId }));
  });

  it('never opens the release review for an artist want, which has no release to review', async () => {
    mockWants = [artistWant];
    const view = await render(<WantsScreen />);

    await fireEvent.press(view.getByTestId('want-options'));
    await fireEvent.press(view.getByTestId('want-option-get'));

    expect(mockGetSheet).not.toHaveBeenCalled();
  });

  it('removes a want when its remove control is pressed', async () => {
    mockWants = [trackWant];
    const view = await render(<WantsScreen />);

    await fireEvent.press(view.getByTestId('want-options'));
    await fireEvent.press(view.getByTestId('want-option-remove'));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'wants/removeWant',
      payload: { serverId: 'server-1', localId: trackWant.localId },
    });
  });
});
