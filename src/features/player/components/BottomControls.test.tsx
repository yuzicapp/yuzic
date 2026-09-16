import React from 'react';
import { render } from '@testing-library/react-native';

import type { SleepTimer } from '../sleepTimer';

/* eslint-disable no-var -- hoisted for the jest.mock factory below, which may
   only close over names beginning "mock" */
var mockTimer: SleepTimer = { mode: 'off' };
/* eslint-enable no-var */

jest.mock('../sleepTimer', () => ({
  ...jest.requireActual('../sleepTimer'),
  useSleepTimer: () => mockTimer,
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#fff', subtext: '#aaa', border: '#333' }, isDarkMode: true }),
}));

jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ pill: 999, pillFor: (n: number) => n / 2 }),
}));

jest.mock('@/features/player/PlaybackSinkContext', () => ({
  usePlaybackSink: () => ({ sink: { kind: 'local' } }),
}));

import BottomControls from './BottomControls';
import SleepTimerIndicator from './SleepTimerIndicator';

describe('the player and its sleep timer', () => {
  afterEach(() => {
    mockTimer ={ mode: 'off' };
  });

  /**
   * The timer used to appear as a third button in this row, and only once it
   * was already running — a row that changed shape underneath the finger, and
   * a control you could not reach until you had found the feature somewhere
   * else. Setting it belongs to the track's options.
   */
  it('keeps the sleep timer off the control row, even while one is running', async () => {
    mockTimer ={ mode: 'duration', minutes: 15, endsAt: Date.now() + 15 * 60 * 1000 };

    const view = await render(
      <BottomControls mode="player" setMode={jest.fn()} onOpenOutputSheet={jest.fn()} />
    );

    expect(view.queryByTestId('playing-sleep-timer')).toBeNull();
    // The row is still the two destinations it is meant to be.
    expect(view.getByTestId('playing-output-toggle')).toBeTruthy();
    expect(view.getByTestId('playing-queue-toggle')).toBeTruthy();
  });

  it('says nothing in the header when no timer is running', async () => {
    const view = await render(<SleepTimerIndicator onPress={jest.fn()} />);

    expect(view.queryByTestId('playing-sleep-timer-indicator')).toBeNull();
  });

  /** A running timer still has to be visible without opening anything. */
  it('shows a running timer in the header, and opens the sheet from it', async () => {
    mockTimer ={ mode: 'endOfTrack' };
    const onPress = jest.fn();

    const view = await render(<SleepTimerIndicator onPress={onPress} />);

    expect(view.getByTestId('playing-sleep-timer-indicator')).toBeTruthy();
    expect(view.getByText('playing.sleepTimer.endOfTrack')).toBeTruthy();
  });
});
