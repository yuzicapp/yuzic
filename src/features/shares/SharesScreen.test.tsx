import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ServerFeatureUnavailableError, type Share } from '@/providers/contracts/ServerAdapter';
import SharesScreen from './SharesScreen';

const mockShares = { list: jest.fn(), remove: jest.fn(), update: jest.fn() };
let mockReachable = true;
const mockShareItem = jest.fn();

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : () => null) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ shares: mockShares }) }));
jest.mock('@/features/connectivity/useServerReachable', () => ({ useServerReachable: () => mockReachable }));
jest.mock('@/features/shares/share', () => ({ shareItem: (...args: unknown[]) => mockShareItem(...args) }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@/features/theme/useScrollClearance', () => ({ useScrollClearance: () => 0 }));
jest.mock('@/features/theme/useListDensity', () => ({ useListDensity: () => ({ rowPadding: 0 }) }));
jest.mock('@/components/toast', () => ({ notify: { error: jest.fn() } }));
jest.mock('@/components/SkeletonListRow', () => 'SkeletonListRow');
jest.mock('@/components/DetailHeader', () => {
  const { Text } = require('react-native');
  return { DetailHeaderBar: ({ title }: any) => <Text>{title}</Text> };
});
jest.mock('@/components/Touchable', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('@/components/options/RadioMark', () => 'RadioMark');
// The sheet is covered where it lives; here it stands in as its actions.
jest.mock('@/components/options/ShareLinkOptions', () => {
  const { Text, View } = require('react-native');
  return {
    ShareLinkOptions: ({ onShare, onEdit, onRevoke }: any) => (
      <View testID="share-options-sheet">
        <Text testID="share-option-share" onPress={onShare}>share</Text>
        <Text testID="share-option-edit" onPress={onEdit}>edit</Text>
        <Text testID="share-option-revoke" onPress={onRevoke}>revoke</Text>
      </View>
    ),
  };
});
jest.mock('@/components/FormSheet', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    FormSheet: ({ children, canSubmit, onSubmit }: any) => (
      <View testID="edit-share-sheet">
        {children}
        <Text testID="edit-share-save" onPress={canSubmit ? onSubmit : undefined}>save</Text>
      </View>
    ),
    FormSheetField: ({ value, onChangeText }: any) => (
      <TextInput testID="share-description" value={value} onChangeText={onChangeText} />
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

const share: Share = {
  id: 's1',
  url: 'https://music.example/share/abc',
  description: 'Road trip',
  expires: undefined,
  visitCount: 3,
};

let client: QueryClient;

async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SharesScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockShares.list.mockReset();
  mockShares.remove.mockReset();
  mockShareItem.mockReset();
  mockReachable = true;
});

afterEach(() => {
  client?.clear();
  jest.restoreAllMocks();
});

describe('SharesScreen', () => {
  it('lists each share with its link, expiry and visit count', async () => {
    mockShares.list.mockResolvedValue([share]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Road trip')).toBeTruthy());
    expect(view.getByText(share.url)).toBeTruthy();
    expect(view.getByText('shares.neverExpires · shares.visits:{"count":3}')).toBeTruthy();
  });

  it('reopens the share sheet for a share', async () => {
    mockShares.list.mockResolvedValue([share]);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('share-options'));
    await fireEvent.press(view.getByTestId('share-option-share'));

    expect(mockShareItem).toHaveBeenCalledWith(expect.objectContaining({ url: share.url }));
  });

  it('revokes a share only after confirming, then reloads the list', async () => {
    mockShares.list.mockResolvedValueOnce([share]).mockResolvedValueOnce([]);
    mockShares.remove.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('share-options'));
    await fireEvent.press(view.getByTestId('share-option-revoke'));
    expect(mockShares.remove).not.toHaveBeenCalled();

    const destructive = (alert.mock.calls[0][2] ?? []).find(button => button.style === 'destructive');
    destructive?.onPress?.();

    await waitFor(() => expect(view.getByText('shares.empty')).toBeTruthy());
    expect(mockShares.remove).toHaveBeenCalledWith('s1');
  });

  it("renames a share and clears its expiry without changing the link", async () => {
    mockShares.list.mockResolvedValue([{ ...share, expires: '2030-01-01T00:00:00Z' }]);
    mockShares.update.mockResolvedValue(undefined);
    const view = await render(
      <QueryClientProvider client={(client = new QueryClient({ defaultOptions: { queries: { retry: false } } }))}>
        <SharesScreen />
      </QueryClientProvider>
    );

    await fireEvent.press(await view.findByTestId('share-options'));
    await fireEvent.press(view.getByTestId('share-option-edit'));
    await fireEvent.changeText(view.getByTestId('share-description'), '  Summer trip ');
    await fireEvent.press(view.getByTestId('share-expiry-never'));
    await fireEvent.press(view.getByTestId('edit-share-save'));

    await waitFor(() => expect(mockShares.update).toHaveBeenCalledWith({
      id: 's1',
      description: 'Summer trip',
      expiresAtMs: null,
    }));
  });

  it('leaves the expiry alone unless one is chosen', async () => {
    mockShares.list.mockResolvedValue([share]);
    mockShares.update.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('share-options'));
    await fireEvent.press(view.getByTestId('share-option-edit'));
    await fireEvent.changeText(view.getByTestId('share-description'), 'New name');
    await fireEvent.press(view.getByTestId('edit-share-save'));

    await waitFor(() => expect(mockShares.update).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'New name', expiresAtMs: undefined })
    ));
  });

  it('says sharing is off on the server instead of offering a retry that cannot help', async () => {
    mockShares.list.mockRejectedValue(new ServerFeatureUnavailableError());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('shares.unavailable')).toBeTruthy());
    expect(view.queryByText('common.retry')).toBeNull();
  });

  it('offers a retry for a load that failed', async () => {
    // The screen asks once more by itself before it gives up.
    mockShares.list.mockRejectedValue(new Error('Network request failed'));
    const view = await renderScreen();

    const retry = await view.findByText('common.retry', {}, { timeout: 4000 });
    mockShares.list.mockResolvedValue([share]);
    fireEvent.press(retry);

    await waitFor(() => expect(view.getByText('Road trip')).toBeTruthy());
  });

  it('says shares live on the server when it cannot be reached', async () => {
    mockReachable = false;
    const view = await renderScreen();

    expect(view.getByText('common.offline.serverOnlyFeature')).toBeTruthy();
    expect(mockShares.list).not.toHaveBeenCalled();
  });
});
