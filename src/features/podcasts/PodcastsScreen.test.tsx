import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ServerFeatureUnavailableError, type PodcastChannel } from '@/providers/contracts/ServerAdapter';
import PodcastsScreen from './PodcastsScreen';

const mockPodcasts = {
  list: jest.fn(),
  newestEpisodes: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  refreshAll: jest.fn(),
};
const mockPush = jest.fn();

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : () => null) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ push: mockPush }) }));
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ podcasts: mockPodcasts }) }));
jest.mock('@/features/connectivity/useServerReachable', () => ({ useServerReachable: () => true }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@/features/theme/useScrollClearance', () => ({ useScrollClearance: () => 0 }));
jest.mock('@/components/toast', () => ({ notify: { error: jest.fn(), info: jest.fn() } }));
jest.mock('@/components/SkeletonListRow', () => 'SkeletonListRow');
jest.mock('@/components/SpinningLoaderCircle', () => 'SpinningLoaderCircle');
jest.mock('@/components/DetailHeader', () => {
  const { View, Text } = require('react-native');
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
jest.mock('@/components/MediaListRow', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, subtitle, onPress, trailing }: any) => (
      <View>
        <Text onPress={onPress}>{title}</Text>
        <Text>{subtitle}</Text>
        {trailing}
      </View>
    ),
  };
});
jest.mock('@/components/EmptyState', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ message, action }: any) => (
      <View>
        <Text>{message}</Text>
        {action && <Text onPress={action.onPress}>{action.label}</Text>}
      </View>
    ),
  };
});
jest.mock('@/components/options/PodcastOptions', () => {
  const { Text, View } = require('react-native');
  return {
    PodcastListOptions: ({ onAdd, onRefresh }: any) => (
      <View testID="podcast-list-options-sheet">
        <Text testID="podcast-option-add" onPress={onAdd}>add</Text>
        <Text testID="podcast-option-refresh" onPress={onRefresh}>refresh</Text>
      </View>
    ),
    PodcastChannelOptions: ({ onUnsubscribe }: any) => (
      <View testID="podcast-channel-options-sheet">
        <Text testID="podcast-option-unsubscribe" onPress={onUnsubscribe}>unsubscribe</Text>
      </View>
    ),
  };
});
jest.mock('@/components/FormSheet', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    FormSheet: ({ children, submitLabel, canSubmit, onSubmit }: any) => (
      <View testID="subscribe-sheet">
        {children}
        <Text testID="subscribe-submit" onPress={canSubmit ? onSubmit : undefined}>{submitLabel}</Text>
      </View>
    ),
    FormSheetField: ({ value, onChangeText }: any) => (
      <TextInput testID="feed-url" value={value} onChangeText={onChangeText} />
    ),
  };
});

const channel = (id: string, extra: Partial<PodcastChannel> = {}): PodcastChannel => ({
  id,
  url: `https://feeds.example/${id}.xml`,
  title: `Show ${id}`,
  description: 'About the show',
  cover: { kind: 'none' },
  status: 'completed',
  episodes: [],
  ...extra,
});

let client: QueryClient;

async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PodcastsScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  Object.values(mockPodcasts).forEach(fn => fn.mockReset());
  mockPush.mockReset();
});

afterEach(() => {
  client?.clear();
  jest.restoreAllMocks();
});

describe('PodcastsScreen', () => {
  it("lists channels, shows a broken feed's error, and opens a channel", async () => {
    mockPodcasts.list.mockResolvedValue([
      channel('a'),
      channel('b', { errorMessage: 'Feed returned 404' }),
    ]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Show a')).toBeTruthy());
    expect(view.getByText('Feed returned 404')).toBeTruthy();

    fireEvent.press(view.getByText('Show a'));
    expect(mockPush).toHaveBeenCalledWith('podcastChannel', { channelId: 'a' });
  });

  it("lists the latest episodes across shows, named by their show, and opens an episode's show", async () => {
    mockPodcasts.list.mockResolvedValue([channel('a'), channel('b')]);
    mockPodcasts.newestEpisodes.mockResolvedValue([
      { id: 'e9', channelId: 'b', title: 'Brand new', status: 'new', streamId: null, playableStreamId: null, cover: { kind: 'none' } },
    ]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('podcasts.latest')).toBeTruthy());
    expect(mockPodcasts.newestEpisodes).toHaveBeenCalledWith(5);
    expect(view.getAllByText('Show b').length).toBeGreaterThan(1);

    fireEvent.press(view.getByText('Brand new'));
    expect(mockPush).toHaveBeenCalledWith('podcastChannel', { channelId: 'b' });
  });

  it('leaves the latest-episodes section out when there are none', async () => {
    mockPodcasts.list.mockResolvedValue([channel('a')]);
    mockPodcasts.newestEpisodes.mockResolvedValue([]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Show a')).toBeTruthy());
    expect(view.queryByText('podcasts.latest')).toBeNull();
  });

  it('unsubscribes only after confirming', async () => {
    mockPodcasts.list.mockResolvedValue([channel('a')]);
    mockPodcasts.unsubscribe.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('podcast-channel-options'));
    await fireEvent.press(view.getByTestId('podcast-option-unsubscribe'));
    expect(mockPodcasts.unsubscribe).not.toHaveBeenCalled();

    const destructive = (alert.mock.calls[0][2] ?? []).find(button => button.style === 'destructive');
    destructive?.onPress?.();

    await waitFor(() => expect(mockPodcasts.unsubscribe).toHaveBeenCalledWith('a'));
  });

  it('subscribes to a feed from the empty state, and only to an http(s) address', async () => {
    mockPodcasts.list.mockResolvedValue([]);
    mockPodcasts.subscribe.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByText('podcasts.add'));
    await fireEvent.changeText(await view.findByTestId('feed-url'), 'not a url');
    await fireEvent.press(view.getByTestId('subscribe-submit'));
    expect(mockPodcasts.subscribe).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByTestId('feed-url'), ' https://feeds.example/new.xml ');
    await fireEvent.press(view.getByTestId('subscribe-submit'));

    await waitFor(() => expect(mockPodcasts.subscribe).toHaveBeenCalledWith('https://feeds.example/new.xml'));
  });

  it('asks the server to refresh every feed', async () => {
    mockPodcasts.list.mockResolvedValue([channel('a')]);
    mockPodcasts.refreshAll.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByLabelText('a11y.common.moreOptions'));
    await fireEvent.press(view.getByTestId('podcast-option-refresh'));

    await waitFor(() => expect(mockPodcasts.refreshAll).toHaveBeenCalledTimes(1));
  });

  it('subscribes from the list options', async () => {
    mockPodcasts.list.mockResolvedValue([channel('a')]);
    mockPodcasts.subscribe.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByLabelText('a11y.common.moreOptions'));
    await fireEvent.press(view.getByTestId('podcast-option-add'));
    await fireEvent.changeText(await view.findByTestId('feed-url'), 'https://feeds.example/new.xml');
    await fireEvent.press(view.getByTestId('subscribe-submit'));

    await waitFor(() => expect(mockPodcasts.subscribe).toHaveBeenCalledWith('https://feeds.example/new.xml'));
  });

  it('says the server has no podcasts rather than offering a retry', async () => {
    mockPodcasts.list.mockRejectedValue(new ServerFeatureUnavailableError());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('podcasts.unavailable')).toBeTruthy());
    expect(view.queryByText('common.retry')).toBeNull();
  });
});
