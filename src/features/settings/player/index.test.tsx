import React, { type ReactNode } from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PlayerSettings from './';
import settingsPlaybackReducer from '@/features/settings/playback/state';
import serversReducer from '@/state/redux/slices/serversSlice';
import audiomuseReducer from '@/state/redux/slices/audiomuseSlice';
import settingsAppearanceReducer from '@/features/settings/appearance/state';

// Boundaries only. Everything below the screen — the settings components, the
// real slices, the real selectors — renders for real, so this test fails when
// a control stops writing what it claims to write.
// The real rule, on a platform the test chooses: Opus is only offered where
// something can decode it, and the jest preset runs as iOS.
let mockPlatform = 'android';
jest.mock('@/features/playback/playableFormat', () => {
  const actual = jest.requireActual('@/features/playback/playableFormat');
  return {
    ...actual,
    playableCodec: (codec: string) => actual.playableCodec(codec, mockPlatform),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('@/components/toast', () => ({
  notify: { success: jest.fn(), error: jest.fn() },
}));

// The native player.
jest.mock('@/features/player/activeBackend', () => ({
  getBackend: () => ({ clearCache: mockClearCache }),
}));

// The server adapter — HTTP.
jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({ songs: { streamableCodecs: mockStreamableCodecs, transcodes: mockTranscodes } }),
}));

// Whether the server really has loudness to level towards. Mocked rather than
// exercised: the hook asks the server through react-query and has its own
// tests — see `useServerLoudness.test`. What this screen owes is rendering the
// switch on that answer rather than on the adapter's declaration (#314).
jest.mock('@/features/library/useServerLoudness', () => ({
  useServerLoudness: () => mockServerHasLoudness,
}));

/* eslint-disable no-var -- hoisted for the jest.mock factories above */
var mockPush = jest.fn();
var mockClearCache = jest.fn();
var mockStreamableCodecs: string[] = ['mp3'];
var mockServerHasLoudness = true;
var mockTranscodes = true;
/* eslint-enable no-var */

import { notify } from '@/components/toast';

function makeStore() {
  return configureStore({
    reducer: {
      settingsPlayback: settingsPlaybackReducer,
      servers: serversReducer,
      audiomuse: audiomuseReducer,
      // The real components read the theme rather than being stubbed away.
      settingsAppearance: settingsAppearanceReducer,
    },
  });
}

async function renderScreen(store: ReturnType<typeof makeStore>) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestStoreWrapper';
  return render(<PlayerSettings />, { wrapper: Wrapper });
}

type View = Awaited<ReturnType<typeof renderScreen>>;

/**
 * The switch beside a toggle row. Autoplay and long-track resume are one
 * group rendered in declaration order, and the Opus switch, when the adapter
 * offers it, precedes them — so the pair is the last two on the screen.
 */
function switchFor(view: View, label: 'settings.player.autoplay' | 'settings.player.resumeLongTracks') {
  const switches = view.getAllByRole('switch');
  const index = ['settings.player.autoplay', 'settings.player.resumeLongTracks'].indexOf(label);
  expect(view.getByText(label)).toBeTruthy();
  return switches[switches.length - 2 + index];
}

describe('PlayerSettings', () => {
  beforeEach(() => {
    mockStreamableCodecs = ['mp3'];
    mockServerHasLoudness = true;
    mockTranscodes = true;
    mockPush.mockClear();
    mockClearCache.mockClear();
    (notify.success as jest.Mock).mockClear();
    (notify.error as jest.Mock).mockClear();
    jest.restoreAllMocks();
  });

  it('writes autoplay to the store when the switch is turned off', async () => {
    const store = makeStore();
    expect(store.getState().settingsPlayback.autoplayEnabled).toBe(true);

    const view = await renderScreen(store);
    fireEvent(switchFor(view, 'settings.player.autoplay'), 'valueChange', false);

    expect(store.getState().settingsPlayback.autoplayEnabled).toBe(false);
  });

  it('writes long-track resume to the store when the switch is turned off', async () => {
    const store = makeStore();
    expect(store.getState().settingsPlayback.resumeLongTracksEnabled).toBe(true);

    const view = await renderScreen(store);
    fireEvent(switchFor(view, 'settings.player.resumeLongTracks'), 'valueChange', false);

    expect(store.getState().settingsPlayback.resumeLongTracksEnabled).toBe(false);
  });

  // It rendered for every provider while only Navidrome reported a gain, so
  // four adapters out of five offered a switch that corrected against nothing.
  // Now it renders on what the server answered: a Jellyfin that declares
  // loudness but has measured none still gets no switch.
  it('hides loudness normalisation where the server has none to level towards', async () => {
    mockServerHasLoudness = false;
    const view = await renderScreen(makeStore());

    expect(view.queryByText('settings.player.loudness.label')).toBeNull();
  });

  it('offers loudness normalisation once the server confirms it has some', async () => {
    mockServerHasLoudness = true;
    const view = await renderScreen(makeStore());

    expect(view.queryByText('settings.player.loudness.label')).not.toBeNull();
  });

  // Plex drops the quality it is handed and direct-plays the part, so the two
  // rows implied a data saver that never changed what arrived.
  it('hides the streaming-quality rows when the adapter ignores quality', async () => {
    mockTranscodes = false;
    const view = await renderScreen(makeStore());

    expect(view.queryByText('settings.player.streamingQuality.wifi')).toBeNull();
    expect(view.queryByText('settings.player.streamingQuality.cellular')).toBeNull();
  });

  it('offers the streaming-quality rows when the adapter transcodes', async () => {
    mockTranscodes = true;
    const view = await renderScreen(makeStore());

    expect(view.queryByText('settings.player.streamingQuality.wifi')).not.toBeNull();
    expect(view.queryByText('settings.player.streamingQuality.cellular')).not.toBeNull();
  });

  it('hides the Opus switch when the active adapter does not stream Opus', async () => {
    mockStreamableCodecs = ['mp3'];
    const view = await renderScreen(makeStore());

    expect(view.queryByText('settings.player.opusCodec')).toBeNull();
  });

  // Core Audio has no Opus decoder, so the switch would offer a setting whose
  // only effect is silence.
  it('hides the Opus switch on a platform that cannot decode it', async () => {
    mockStreamableCodecs = ['mp3', 'opus'];
    mockPlatform = 'ios';
    const view = await renderScreen(makeStore());

    expect(view.queryByText('settings.player.opusCodec')).toBeNull();
  });

  it('offers Opus, and selects it, when the adapter declares it', async () => {
    mockStreamableCodecs = ['mp3', 'opus'];
    mockPlatform = 'android';
    const store = makeStore();
    const view = await renderScreen(store);

    expect(view.getByText('settings.player.opusCodec')).toBeTruthy();
    const opusSwitch = view.getAllByRole('switch')[0];
    fireEvent(opusSwitch, 'valueChange', true);

    expect(store.getState().settingsPlayback.preferredCodec).toBe('opus');
  });

  it('opens the equalizer on its own screen rather than inline', async () => {
    const view = await renderScreen(makeStore());
    fireEvent.press(view.getByText('settings.player.equalizer.title'));

    expect(mockPush).toHaveBeenCalledWith('/settings/equalizerView');
  });

  it('empties the stream cache through the backend once the user confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderScreen(makeStore());

    fireEvent.press(view.getByText('settings.player.clearCache'));

    // Destructive, so it asks first and does nothing until the user agrees.
    expect(alert).toHaveBeenCalled();
    expect(mockClearCache).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    const confirm = buttons.find(b => b.style === 'destructive');
    expect(confirm).toBeDefined();
    confirm!.onPress!();

    expect(mockClearCache).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith('settings.player.clearCacheDone');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('reports a failed cache clear instead of claiming success', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockClearCache.mockImplementation(() => { throw new Error('backend gone'); });
    const view = await renderScreen(makeStore());

    fireEvent.press(view.getByText('settings.player.clearCache'));
    const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    buttons.find(b => b.style === 'destructive')!.onPress!();

    expect(notify.error).toHaveBeenCalledWith('common.error.unexpected');
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('does not render the dev-only engine smoke-test panel', async () => {
    const view = await renderScreen(makeStore());

    expect(view.queryByText('yuzic-engine (dev)')).toBeNull();
  });
});
