import React, { type ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import AppearanceSettings from './';
import settingsAppearanceReducer, { selectTranslucentDock } from './state';
import settingsPlaybackReducer from '@/features/settings/playback/state';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: jest.fn() } }),
}));

// Native widgets with no JS fallback. The switches under test are plain
// React Native switches and render for real.
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('reanimated-color-picker', () => {
  const ColorPicker = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: ColorPicker, Panel1: () => null, HueSlider: () => null };
});
// The playing-bar actions pull in the player; the selector's list is not what
// this screen's test is about.
jest.mock('@/features/player/playingBar/actions/Actions', () => ({ PLAYING_BAR_ACTIONS: [] }));
// Whether the rating switch is offered depends on the connected server, which
// means `useApi`, which means every adapter and the native modules under them.
// The switch's own behaviour is the appearance screen's business; which
// servers have ratings is pinned in `adapterCapabilities.test.ts`.
jest.mock('@/features/ratings/useRatingsAvailable', () => ({ useRatingsAvailable: () => true }));

function makeStore() {
  return configureStore({
    reducer: {
      settingsAppearance: settingsAppearanceReducer,
      settingsPlayback: settingsPlaybackReducer,
    },
  });
}

type Store = ReturnType<typeof makeStore>;

async function renderScreen(store: Store) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestStoreWrapper';
  return render(<AppearanceSettings />, { wrapper: Wrapper });
}

/** Every switch on the screen, in the order the screen declares its toggle groups. */
const SWITCH_ORDER = [
  'settings.appearance.showQualityBadge',
  'settings.player.showPlaybackSpeed',
  'settings.player.showJumpButtons',
  'settings.player.showVolumeSlider',
  // Last in the player group, and only present because the mocked adapter
  // above says this server has ratings.
  'settings.player.showRating',
  'settings.appearance.showSourceHeaders',
  'settings.appearance.coverAccent',
  'settings.appearance.translucentDock',
  'settings.appearance.haptics',
  'settings.appearance.respectReducedMotion',
] as const;

type View = Awaited<ReturnType<typeof renderScreen>>;

function switchFor(view: View, label: (typeof SWITCH_ORDER)[number]) {
  expect(view.getByText(label)).toBeTruthy();
  const switches = view.getAllByRole('switch');
  expect(switches).toHaveLength(SWITCH_ORDER.length);
  return switches[SWITCH_ORDER.indexOf(label)];
}

describe('AppearanceSettings', () => {
  it('reflects the stored value on each switch', async () => {
    const view = await renderScreen(makeStore());

    expect(switchFor(view, 'settings.appearance.showQualityBadge').props.value).toBe(false);
    expect(switchFor(view, 'settings.player.showPlaybackSpeed').props.value).toBe(false);
    expect(switchFor(view, 'settings.appearance.haptics').props.value).toBe(true);
  });

  it('writes the quality badge and source headers to appearance settings', async () => {
    const store = makeStore();
    const view = await renderScreen(store);

    await fireEvent(switchFor(view, 'settings.appearance.showQualityBadge'), 'valueChange', true);
    await fireEvent(switchFor(view, 'settings.appearance.showSourceHeaders'), 'valueChange', false);

    expect(store.getState().settingsAppearance.showQualityBadge).toBe(true);
    expect(store.getState().settingsAppearance.showSourceHeaders).toBe(false);
  });

  it('writes which player controls are drawn to playback settings', async () => {
    const store = makeStore();
    const view = await renderScreen(store);

    await fireEvent(switchFor(view, 'settings.player.showPlaybackSpeed'), 'valueChange', true);
    await fireEvent(switchFor(view, 'settings.player.showVolumeSlider'), 'valueChange', true);

    expect(store.getState().settingsPlayback.showPlaybackSpeed).toBe(true);
    expect(store.getState().settingsPlayback.showVolumeSlider).toBe(true);
  });

  it('writes the feel switches', async () => {
    const store = makeStore();
    const view = await renderScreen(store);

    await fireEvent(switchFor(view, 'settings.appearance.translucentDock'), 'valueChange', true);
    await fireEvent(switchFor(view, 'settings.appearance.haptics'), 'valueChange', false);
    await fireEvent(switchFor(view, 'settings.appearance.respectReducedMotion'), 'valueChange', false);

    expect(store.getState().settingsAppearance).toMatchObject({
      hapticsEnabled: false,
      respectReducedMotion: false,
    });
    // The dock is part of the theme now, so the switch edits the active theme.
    expect(selectTranslucentDock(store.getState())).toBe(true);
  });
});
