import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import settingsPlaybackReducer, { setEqualizerEnabled, setEqualizerGains } from '@/features/settings/playback/state';
import { usePlayerSetup } from './usePlayerSetup';

/* eslint-disable no-var -- hoisted for the jest.mock factory below */
var mockBackend = {
  setup: jest.fn(),
  setCommands: jest.fn(),
  setCrossfade: jest.fn(),
  setEqualizer: jest.fn(),
  setLoudness: jest.fn(),
};
/* eslint-enable no-var */
jest.mock('@/features/player/activeBackend', () => ({ getBackend: () => mockBackend }));

const gainsSent = () => mockBackend.setEqualizer.mock.calls.at(-1)?.[0].map((band: { gainDb: number }) => band.gainDb);

/**
 * Off is something the engine hears, not only something the settings screen
 * shows (#307): it gets a flat curve, which it bypasses, while the stored
 * curve waits for the switch to come back on.
 */
describe('usePlayerSetup equalizer', () => {
  it('sends a flat curve while the equalizer is off, and the stored one when it is on', async () => {
    const store = configureStore({ reducer: { settingsPlayback: settingsPlaybackReducer } });
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    const curve = [4, 0, 0, 0, 0, 0, 0, 0, 0, 2];

    await renderHook(() => usePlayerSetup(), { wrapper });
    await act(async () => { store.dispatch(setEqualizerGains(curve)); });
    expect(gainsSent()).toEqual(curve);

    await act(async () => { store.dispatch(setEqualizerEnabled(false)); });
    expect(gainsSent()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    await act(async () => { store.dispatch(setEqualizerEnabled(true)); });
    expect(gainsSent()).toEqual(curve);
  });
});
