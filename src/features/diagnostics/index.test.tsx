import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.17.1' } },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { background: '#000', secondary: '#fff', subtext: '#888', card: '#111', border: '#222', muted: '#333', themeColor: '#f50' }, isDarkMode: true }),
}));
jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ thumb: 6, md: 8, card: 12, lg: 16, panel: 24, pill: 999, pillFor: (n: number) => n / 2 }),
}));
jest.mock('@/features/theme/useScrollClearance', () => ({
  useScrollClearance: () => 24,
  useBottomOverlayHeight: () => 0,
}));
jest.mock('react-redux', () => ({ useSelector: () => ({ type: 'navidrome' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));

const mockNotify = jest.fn();
jest.mock('@/components/toast', () => ({ notify: { info: (m: string) => mockNotify(m) } }));

import Diagnostics from './index';
import { log } from './log';

describe('Diagnostics screen', () => {
  beforeEach(() => {
    log.clear();
    log.setLevel('debug');
    mockNotify.mockReset();
  });

  it('says nothing has gone wrong when the log is empty', async () => {
    const view = await render(<Diagnostics />);

    expect(view.getByText('settings.diagnostics.empty')).toBeTruthy();
  });

  /**
   * The records are on screen, not only in the export. Sharing sends song
   * titles and failed endpoints somewhere the user chooses, possibly a public
   * issue, so the screen shows what the share will contain.
   */
  it('shows the records it holds', async () => {
    log.playback.error('playback failed', { code: 'PLAYBACK_FAILED', songId: '42' });

    const view = await render(<Diagnostics />);

    expect(view.getByText(/playback failed/)).toBeTruthy();
    expect(view.getByText(/code=PLAYBACK_FAILED/)).toBeTruthy();
  });

  it('shows newest first, the opposite of the export', async () => {
    log.app.info('older');
    log.app.info('newer');

    const view = await render(<Diagnostics />);
    const lines = view.getAllByText(/\[app\]/).map(node => node.props.children as string);

    expect(lines[0]).toContain('newer');
    expect(lines[1]).toContain('older');
  });

  it('hands the formatted log and the backend type to the share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    log.server.error('request failed', { operation: 'getSong' });

    const view = await render(<Diagnostics />);
    await act(async () => {
      fireEvent.press(view.getByTestId('diagnostics-share'));
    });

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('navidrome') })
    );
    expect(jest.mocked(share).mock.calls[0][0]).toMatchObject({
      message: expect.stringContaining('request failed'),
    });
    share.mockRestore();
  });

  it('empties the list and says so when cleared', async () => {
    log.app.info('something');

    const view = await render(<Diagnostics />);
    await act(async () => {
      fireEvent.press(view.getByTestId('diagnostics-clear'));
    });

    expect(view.getByText('settings.diagnostics.empty')).toBeTruthy();
    expect(log.records()).toEqual([]);
    expect(mockNotify).toHaveBeenCalledWith('settings.diagnostics.cleared');
  });

  it('survives a share the user dismisses', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    log.app.info('something');

    const view = await render(<Diagnostics />);
    await act(async () => {
      fireEvent.press(view.getByTestId('diagnostics-share'));
    });

    // Still there: a dismissed share is not a clear.
    expect(view.getByText(/something/)).toBeTruthy();
    share.mockRestore();
  });
});
