import React, { type ReactNode } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { BackgroundSelector } from './BackgroundSelector';
import settingsAppearanceReducer, { editTheme, selectActiveTheme } from '../state';
import { ScreenBackground, useHasScreenBackground } from '@/features/theme/ScreenBackground';
import { pickBackgroundImage, removeBackgroundImage } from '@/features/theme/backgroundImage';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/toast', () => ({ notify: { error: jest.fn() } }));
jest.mock('@/features/theme/backgroundImage', () => ({
  pickBackgroundImage: jest.fn(),
  removeBackgroundImage: jest.fn(async () => {}),
}));
let mockSong: { cover: { kind: 'url'; url: string } } | null = null;
jest.mock('@/features/playback/PlayingContext', () => ({ usePlayingState: () => ({ currentSong: mockSong }) }));
jest.mock('@/providers/registry/covers', () => ({
  buildCover: (cover: { kind: string; url?: string }) => (cover.kind === 'url' ? cover.url : null),
}));

const pick = pickBackgroundImage as jest.MockedFunction<typeof pickBackgroundImage>;

function setup(ui: React.ReactElement) {
  const store = configureStore({ reducer: { settingsAppearance: settingsAppearanceReducer } });
  const Wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  Wrapper.displayName = 'TestStoreWrapper';
  return { store, view: render(ui, { wrapper: Wrapper }) };
}

const background = (store: ReturnType<typeof setup>['store']) => selectActiveTheme(store.getState()).surface.background;

beforeEach(() => {
  jest.clearAllMocks();
  mockSong = null;
});

describe('BackgroundSelector', () => {
  it('asks for a photo when Photo is chosen, and keeps it', async () => {
    pick.mockResolvedValueOnce('file:///docs/theme/background-1.jpg');
    const { store, view } = setup(<BackgroundSelector />);
    const screen = await view;

    await act(async () => { fireEvent.press(screen.getByText('settings.appearance.background.image')); });

    expect(background(store)).toEqual({ kind: 'image', uri: 'file:///docs/theme/background-1.jpg' });
    expect(screen.getByText('settings.appearance.background.changePhoto')).toBeTruthy();
  });

  it('stays plain when the picker is cancelled', async () => {
    pick.mockResolvedValueOnce(null);
    const { store, view } = setup(<BackgroundSelector />);
    const screen = await view;

    await act(async () => { fireEvent.press(screen.getByText('settings.appearance.background.image')); });

    expect(background(store)).toEqual({ kind: 'none' });
  });

  it('deletes the copied photo when it is no longer the background', async () => {
    const { store, view } = setup(<BackgroundSelector />);
    store.dispatch(editTheme({ surface: { background: { kind: 'image', uri: 'file:///docs/theme/background-1.jpg' } } }));
    const screen = await view;

    await act(async () => { fireEvent.press(screen.getByText('settings.appearance.background.cover')); });

    expect(background(store)).toEqual({ kind: 'cover' });
    expect(removeBackgroundImage).toHaveBeenCalledWith('file:///docs/theme/background-1.jpg');
  });

  it('shows the blur and dim sliders only when there is an image', async () => {
    const { store, view } = setup(<BackgroundSelector />);
    const screen = await view;
    expect(screen.queryByLabelText('settings.appearance.background.blur')).toBeNull();

    await act(async () => { store.dispatch(editTheme({ surface: { background: { kind: 'cover' } } })); });

    expect(screen.getByLabelText('settings.appearance.background.blur')).toBeTruthy();
    expect(screen.getByLabelText('settings.appearance.background.dim')).toBeTruthy();
  });
});

describe('ScreenBackground', () => {
  const Probe = ({ screen = 'home' }: { screen?: 'home' | 'search' }) => (
    <>{useHasScreenBackground(screen) ? <ScreenBackground screen={screen} /> : null}</>
  );

  it('draws nothing for a plain background', async () => {
    const { view } = setup(<Probe />);
    expect((await view).queryByTestId('screen-background')).toBeNull();
  });

  it('draws the cover of what is playing, and nothing when nothing is', async () => {
    const { store, view } = setup(<Probe />);
    store.dispatch(editTheme({ surface: { background: { kind: 'cover' } } }));
    const screen = await view;
    expect(screen.queryByTestId('screen-background')).toBeNull();

    mockSong = { cover: { kind: 'url', url: 'https://covers.test/1.jpg' } };
    await screen.rerender(<Probe />);
    expect(screen.getByTestId('screen-background')).toBeTruthy();
  });

  it('stays on Home unless it is set to go behind every tab', async () => {
    mockSong = { cover: { kind: 'url', url: 'https://covers.test/1.jpg' } };
    const { store, view } = setup(<Probe screen="search" />);
    store.dispatch(editTheme({ surface: { background: { kind: 'cover' } } }));
    const screen = await view;
    expect(screen.queryByTestId('screen-background')).toBeNull();

    await act(async () => { store.dispatch(editTheme({ surface: { backgroundScope: 'tabs' } })); });
    expect(screen.getByTestId('screen-background')).toBeTruthy();
  });
});
