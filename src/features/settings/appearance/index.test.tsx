import React, { type ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import AppearanceSettings from './';
import { AppearanceSection, APPEARANCE_SECTIONS, type AppearanceSectionId } from './AppearanceSection';
import settingsAppearanceReducer, { selectActiveTheme, selectTranslucentDock } from './state';
import settingsPlaybackReducer from '@/features/settings/playback/state';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
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
// The toast host draws with the gesture handler; the background card only calls it on a failed pick.
jest.mock('@/components/toast', () => ({ notify: { error: jest.fn() } }));
jest.mock('@/features/theme/backgroundImage', () => ({ pickBackgroundImage: jest.fn(), removeBackgroundImage: jest.fn() }));
jest.mock('@/features/playback/PlayingContext', () => ({ usePlayingState: () => ({ currentSong: null }) }));

function makeStore() {
  return configureStore({
    reducer: {
      settingsAppearance: settingsAppearanceReducer,
      settingsPlayback: settingsPlaybackReducer,
    },
  });
}

type Store = ReturnType<typeof makeStore>;

async function renderWith(store: Store, ui: React.ReactElement) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestStoreWrapper';
  return render(ui, { wrapper: Wrapper });
}

const renderSection = (store: Store, section: AppearanceSectionId) =>
  renderWith(store, <AppearanceSection section={section} />);

type View = Awaited<ReturnType<typeof renderSection>>;

/** The switch a label names; every switch carries its row's label. */
function switchFor(view: View, label: string) {
  const found = view.getAllByRole('switch').find(s => s.props.accessibilityLabel === label);
  expect(found).toBeTruthy();
  return found!;
}

describe('the appearance index', () => {
  it('lists a row per page and opens the one tapped', async () => {
    const view = await renderWith(makeStore(), <AppearanceSettings />);
    for (const section of APPEARANCE_SECTIONS) {
      expect(view.getByText(`settings.appearance.sections.${section}`)).toBeTruthy();
    }
    await fireEvent.press(view.getByText('settings.appearance.sections.player'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/settings/appearanceSectionView', params: { section: 'player' } });
  });
});

describe('the appearance pages', () => {
  it('reflects the stored value on each switch', async () => {
    const player = await renderSection(makeStore(), 'player');
    expect(switchFor(player, 'settings.appearance.showQualityBadge').props.value).toBe(false);
    expect(switchFor(player, 'settings.player.showPlaybackSpeed').props.value).toBe(false);
    const dock = await renderSection(makeStore(), 'dock');
    expect(switchFor(dock, 'settings.appearance.haptics').props.value).toBe(true);
  });

  it('writes the quality badge and source headers to appearance settings', async () => {
    const store = makeStore();
    const player = await renderSection(store, 'player');
    await fireEvent(switchFor(player, 'settings.appearance.showQualityBadge'), 'valueChange', true);
    const layout = await renderSection(store, 'layout');
    await fireEvent(switchFor(layout, 'settings.appearance.showSourceHeaders'), 'valueChange', false);

    expect(store.getState().settingsAppearance.showQualityBadge).toBe(true);
    expect(store.getState().settingsAppearance.showSourceHeaders).toBe(false);
  });

  it('writes which player controls are drawn to playback settings', async () => {
    const store = makeStore();
    const view = await renderSection(store, 'player');

    await fireEvent(switchFor(view, 'settings.player.showPlaybackSpeed'), 'valueChange', true);
    await fireEvent(switchFor(view, 'settings.player.showVolumeSlider'), 'valueChange', true);

    expect(store.getState().settingsPlayback.showPlaybackSpeed).toBe(true);
    expect(store.getState().settingsPlayback.showVolumeSlider).toBe(true);
  });

  it('writes the feel switches', async () => {
    const store = makeStore();
    const view = await renderSection(store, 'dock');

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

  it('writes the dock shape and tab labels to the theme', async () => {
    const store = makeStore();
    const view = await renderSection(store, 'dock');

    await fireEvent(switchFor(view, 'settings.appearance.floatingDock'), 'valueChange', true);
    await fireEvent(switchFor(view, 'settings.appearance.tabLabels'), 'valueChange', true);

    expect(selectActiveTheme(store.getState()).components).toMatchObject({ dockShape: 'floating', tabLabels: true });
  });
});
