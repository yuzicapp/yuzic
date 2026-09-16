import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { PodcastChannel, PodcastEpisode } from '@/providers/contracts/ServerAdapter';
import PodcastChannelScreen from './PodcastChannelScreen';

const mockPodcasts = { list: jest.fn(), downloadEpisode: jest.fn(), deleteEpisode: jest.fn() };
const mockPlaySong = jest.fn();

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : () => null) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('react-redux', () => ({ useSelector: () => ({ id: 'srv' }) }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ channelId: 'c1' }),
  useRouter: () => ({ back: mockBack }),
}));
jest.mock('@/components/options/PodcastOptions', () => {
  const { Text, View } = require('react-native');
  return {
    PodcastChannelOptions: ({ onUnsubscribe }: any) => (
      <View testID="podcast-channel-options-sheet">
        <Text testID="podcast-option-unsubscribe" onPress={onUnsubscribe}>unsubscribe</Text>
      </View>
    ),
    PodcastEpisodeOptions: ({ onDelete }: any) => (
      <View testID="podcast-episode-options-sheet">
        <Text testID="episode-option-delete" onPress={onDelete}>delete</Text>
      </View>
    ),
  };
});
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ podcasts: mockPodcasts }) }));
jest.mock('@/features/playback/PlayingContext', () => ({ usePlayingActions: () => ({ playSong: mockPlaySong }) }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@/features/theme/useScrollClearance', () => ({ useScrollClearance: () => 0 }));
jest.mock('@/features/theme/useListDensity', () => ({ useListDensity: () => ({ rowPadding: 0 }) }));
jest.mock('@/components/toast', () => ({ notify: { error: jest.fn(), info: jest.fn() } }));
jest.mock('@/components/SkeletonListRow', () => 'SkeletonListRow');
jest.mock('@/components/SpinningLoaderCircle', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>downloading</Text> };
});
jest.mock('@/components/DetailHeader', () => {
  const { Text, View } = require('react-native');
  return {
    DetailHeaderBar: ({ title, rightAction }: any) => <View><Text>{title}</Text>{rightAction}</View>,
    DetailHeaderIconButton: ({ onPress, accessibilityLabel, children }: any) => (
      <Text onPress={onPress} accessibilityLabel={accessibilityLabel}>{children}</Text>
    ),
  };
});
jest.mock('@/components/Touchable', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('@/components/EmptyState', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ message }: any) => <Text>{message}</Text> };
});

const episode = (id: string, extra: Partial<PodcastEpisode> = {}): PodcastEpisode => ({
  id,
  streamId: null,
  channelId: 'c1',
  title: `Episode ${id}`,
  status: 'skipped',
  playableStreamId: null,
  cover: { kind: 'none' },
  ...extra,
});

const channel = (episodes: PodcastEpisode[]): PodcastChannel => ({
  id: 'c1',
  url: 'https://feeds.example/c1.xml',
  title: 'The Show',
  cover: { kind: 'none' },
  status: 'completed',
  episodes,
});

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PodcastChannelScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockPodcasts.list.mockReset();
  mockPodcasts.downloadEpisode.mockReset();
  mockPlaySong.mockReset();
});

describe('PodcastChannelScreen', () => {
  it('plays a downloaded episode', async () => {
    mockPodcasts.list.mockResolvedValue([channel([episode('e1', { status: 'completed', playableStreamId: 'st1' })])]);
    const view = await renderScreen();

    fireEvent.press(await view.findByLabelText('podcasts.play'));

    expect(mockPlaySong).toHaveBeenCalledWith(expect.objectContaining({ title: 'Episode e1' }));
  });

  it('starts a download and shows it downloading straight away, without waiting on a timer', async () => {
    mockPodcasts.list
      .mockResolvedValueOnce([channel([episode('e1')])])
      .mockResolvedValue([channel([episode('e1', { status: 'downloading' })])]);
    mockPodcasts.downloadEpisode.mockResolvedValue(undefined);
    const view = await renderScreen();

    await act(async () => { fireEvent.press(await view.findByLabelText('podcasts.download')); });

    expect(mockPodcasts.downloadEpisode).toHaveBeenCalledWith('e1');
    await waitFor(() => expect(view.getByText('downloading')).toBeTruthy());
  });

  it('deletes a downloaded episode from the server only after confirming', async () => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPodcasts.list.mockResolvedValue([channel([episode('e1', { status: 'completed', playableStreamId: 'st1' })])]);
    mockPodcasts.deleteEpisode.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('episode-options'));
    await fireEvent.press(view.getByTestId('episode-option-delete'));
    expect(mockPodcasts.deleteEpisode).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    buttons.find(button => button.style === 'destructive')?.onPress?.();

    await waitFor(() => expect(mockPodcasts.deleteEpisode).toHaveBeenCalledWith('e1'));
    alert.mockRestore();
  });

  it('says so when the channel is gone', async () => {
    mockPodcasts.list.mockResolvedValue([]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('podcasts.notFound')).toBeTruthy());
  });
});
