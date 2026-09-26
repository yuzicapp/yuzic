import React from 'react';
import { Text } from '@/components/Text';
import { act, fireEvent, render } from '@testing-library/react-native';

import { ErrorBoundary } from './ErrorBoundary';

const mockRestart = jest.fn();
jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ thumb: 6, md: 8, card: 12, lg: 16, panel: 24, pill: 999, pillFor: (n: number) => n / 2 }),
}));
jest.mock('react-native-restart', () => ({ __esModule: true, default: { Restart: () => mockRestart() } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: {}, isDarkMode: true }) }));

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('bad row data');
  return <Text>recovered</Text>;
}

beforeEach(() => {
  shouldThrow = true;
  mockRestart.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows a translated crash screen with the error, not hard-coded English', async () => {
    const view = await render(<ErrorBoundary><Flaky /></ErrorBoundary>);

    expect(view.getByText('common.error.crashTitle')).toBeTruthy();
    expect(view.getByText('bad row data')).toBeTruthy();
  });

  it('renders the children again from Try again, without restarting the app', async () => {
    const view = await render(<ErrorBoundary><Flaky /></ErrorBoundary>);

    shouldThrow = false;
    await act(async () => {
      fireEvent.press(view.getByTestId('screen-error-retry'));
    });

    expect(view.getByText('recovered')).toBeTruthy();
    expect(mockRestart).not.toHaveBeenCalled();
  });

  it('still offers a restart', async () => {
    const view = await render(<ErrorBoundary><Flaky /></ErrorBoundary>);

    fireEvent.press(view.getByTestId('screen-error-restart'));

    expect(mockRestart).toHaveBeenCalled();
  });
});
