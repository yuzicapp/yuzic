import React from 'react';
import { Alert, Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { InternetRadioStation } from '@/providers/contracts/ServerAdapter';
import RadioScreen from './RadioScreen';

const mockRadio = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };
const mockPlaySong = jest.fn();
let mockReachable = true;

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : () => null) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});
jest.mock('react-redux', () => ({ useSelector: () => ({ id: 'srv' }) }));
jest.mock('@/providers/registry/useApi', () => ({ useApi: () => ({ radio: mockRadio }) }));
jest.mock('@/features/connectivity/useServerReachable', () => ({ useServerReachable: () => mockReachable }));
jest.mock('@/features/playback/PlayingContext', () => ({ usePlayingActions: () => ({ playSong: mockPlaySong }) }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ thumb: 6 }) }));
jest.mock('@/features/theme/useScrollClearance', () => ({ useScrollClearance: () => 0 }));
jest.mock('@/components/haptics', () => ({ __esModule: true, default: { primary: jest.fn() } }));
jest.mock('@/components/toast', () => ({ notify: { error: jest.fn() } }));
jest.mock('@/components/SkeletonListRow', () => 'SkeletonListRow');
jest.mock('@/components/DetailHeader', () => {
  const { Text, View } = require('react-native');
  return {
    DetailHeaderBar: ({ title, subtitle, rightAction }: any) => (
      <View><Text>{title}</Text>{subtitle ? <Text>{subtitle}</Text> : null}{rightAction}</View>
    ),
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
    default: ({ title, subtitle, onPress, trailing, testID }: any) => (
      <View testID={testID}>
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
jest.mock('@/components/FormSheet', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    FormSheet: ({ children, canSubmit, onSubmit, title }: any) => (
      <View testID="station-editor">
        <Text>{title}</Text>
        {children}
        <Text testID="station-save" onPress={canSubmit ? onSubmit : undefined}>save</Text>
      </View>
    ),
    FormSheetField: ({ label, value, onChangeText }: any) => (
      <TextInput testID={`field-${label}`} value={value} onChangeText={onChangeText} />
    ),
  };
});
// The sheets themselves are covered where they live; here they stand in as
// their actions, so what this file tests is the screen's wiring.
jest.mock('@/components/options/RadioOptions', () => {
  const { Text, View } = require('react-native');
  return {
    RadioStationOptions: ({ station, onPlay, onEdit, onOpenHomepage, onDelete }: any) => (
      <View testID="station-options">
        <Text testID="radio-option-play" onPress={onPlay}>play</Text>
        <Text testID="radio-option-edit" onPress={onEdit}>edit</Text>
        {station.homepageUrl
          ? <Text testID="radio-option-homepage" onPress={onOpenHomepage}>homepage</Text>
          : null}
        <Text testID="radio-option-delete" onPress={onDelete}>delete</Text>
      </View>
    ),
    RadioListOptions: ({ onAdd, onRefresh }: any) => (
      <View testID="list-options">
        <Text testID="radio-option-add" onPress={onAdd}>add</Text>
        <Text testID="radio-option-refresh" onPress={onRefresh}>refresh</Text>
      </View>
    ),
  };
});

const station: InternetRadioStation = {
  id: 'r1',
  name: 'Radio Paradise',
  streamUrl: 'https://stream.example/aac',
  homepageUrl: 'https://radioparadise.com',
};

let client: QueryClient;

async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RadioScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  Object.values(mockRadio).forEach(fn => fn.mockReset());
  mockPlaySong.mockReset();
  mockReachable = true;
});

afterEach(() => {
  client?.clear();
  jest.restoreAllMocks();
});

describe('RadioScreen', () => {
  it('lists stations and plays one from its row', async () => {
    mockRadio.list.mockResolvedValue([station]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Radio Paradise')).toBeTruthy());
    expect(view.getByText('library.count.stations:{"count":1}')).toBeTruthy();

    await fireEvent.press(view.getByText('Radio Paradise'));
    expect(mockPlaySong).toHaveBeenCalledWith(expect.objectContaining({ title: 'Radio Paradise' }));
  });

  it("opens a station's options from its row rather than bare icons", async () => {
    mockRadio.list.mockResolvedValue([station]);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('radio-station-options'));
    expect(view.getByTestId('station-options')).toBeTruthy();
  });

  it('opens the station homepage', async () => {
    mockRadio.list.mockResolvedValue([station]);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('radio-station-options'));
    await fireEvent.press(view.getByTestId('radio-option-homepage'));

    expect(openURL).toHaveBeenCalledWith('https://radioparadise.com');
  });

  it('offers no homepage row for a station without one', async () => {
    mockRadio.list.mockResolvedValue([{ ...station, homepageUrl: undefined }]);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('radio-station-options'));
    expect(view.queryByTestId('radio-option-homepage')).toBeNull();
  });

  it('edits a station with the homepage it was saved with, and keeps it', async () => {
    mockRadio.list.mockResolvedValue([station]);
    mockRadio.update.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('radio-station-options'));
    await fireEvent.press(view.getByTestId('radio-option-edit'));

    // The regression this covers: the homepage came back from the server under
    // a different name, so the field opened empty and saving wiped it.
    expect(view.getByTestId('field-radio.field.homepage').props.value).toBe('https://radioparadise.com');

    await fireEvent.press(view.getByTestId('station-save'));

    await waitFor(() => expect(mockRadio.update).toHaveBeenCalledWith({
      id: 'r1',
      name: 'Radio Paradise',
      streamUrl: 'https://stream.example/aac',
      homepageUrl: 'https://radioparadise.com',
    }));
  });

  it('sends an emptied homepage, so clearing one sticks', async () => {
    mockRadio.list.mockResolvedValue([station]);
    mockRadio.update.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('radio-station-options'));
    await fireEvent.press(view.getByTestId('radio-option-edit'));
    await fireEvent.changeText(view.getByTestId('field-radio.field.homepage'), '');
    await fireEvent.press(view.getByTestId('station-save'));

    await waitFor(() => expect(mockRadio.update).toHaveBeenCalledWith(
      expect.objectContaining({ homepageUrl: '' })
    ));
  });

  it('adds a station with its homepage from the list options', async () => {
    mockRadio.list.mockResolvedValue([station]);
    mockRadio.create.mockResolvedValue(undefined);
    const view = await renderScreen();

    await fireEvent.press(await view.findByLabelText('a11y.common.moreOptions'));
    await fireEvent.press(view.getByTestId('radio-option-add'));
    await fireEvent.changeText(view.getByTestId('field-radio.field.name'), 'SomaFM');
    await fireEvent.changeText(view.getByTestId('field-radio.field.streamUrl'), 'https://ice.somafm.com/groovesalad');
    await fireEvent.changeText(view.getByTestId('field-radio.field.homepage'), ' https://somafm.com ');
    await fireEvent.press(view.getByTestId('station-save'));

    await waitFor(() => expect(mockRadio.create).toHaveBeenCalledWith({
      name: 'SomaFM',
      streamUrl: 'https://ice.somafm.com/groovesalad',
      homepageUrl: 'https://somafm.com',
    }));
  });

  it('deletes a station only after confirming', async () => {
    mockRadio.list.mockResolvedValue([station]);
    mockRadio.remove.mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderScreen();

    await fireEvent.press(await view.findByTestId('radio-station-options'));
    await fireEvent.press(view.getByTestId('radio-option-delete'));
    expect(mockRadio.remove).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    buttons.find(button => button.style === 'destructive')?.onPress?.();

    await waitFor(() => expect(mockRadio.remove).toHaveBeenCalledWith('r1'));
  });

  it('says there are none yet, and adds one from the empty state', async () => {
    mockRadio.list.mockResolvedValue([]);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('radio.empty')).toBeTruthy());
    await fireEvent.press(view.getByText('radio.add'));
    expect(view.getByTestId('station-editor')).toBeTruthy();
  });

  it('offers a retry for a load that failed', async () => {
    mockRadio.list.mockRejectedValue(new Error('Network request failed'));
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('common.loadFailed')).toBeTruthy());
    expect(view.getByText('common.retry')).toBeTruthy();
  });

  it('says stations live on the server when it cannot be reached', async () => {
    mockReachable = false;
    const view = await renderScreen();

    expect(view.getByText('common.offline.serverOnlyFeature')).toBeTruthy();
    expect(mockRadio.list).not.toHaveBeenCalled();
  });
});
