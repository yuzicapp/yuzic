import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import UserAvatar from './UserAvatar';
import { controlSize } from '@/constants/design';

const mockAvatarUrl = jest.fn();
let appStateHandler: ((state: AppStateStatus) => void) | undefined;

jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({ user: { avatarUrl: mockAvatarUrl } }),
}));

jest.mock('react-redux', () => ({
  useSelector: () => 'server-1',
}));

jest.mock('@/features/theme/useActiveTheme', () => {
  const { DEFAULT_THEME } = jest.requireActual('@/features/theme/presets');
  return { useActiveTheme: () => ({ ...DEFAULT_THEME, accent: '#123456' }) };
});

jest.mock('@/features/settings/appearance/state', () => ({
  selectThemeMode: 'themeMode',
}));

jest.mock('@/state/redux/selectors/serversSelectors', () => ({
  selectActiveServerId: 'activeServerId',
}));

const foreground = async () => {
  (AppState as any).currentState = 'active';
  await act(async () => appStateHandler?.('active' as AppStateStatus));
};

const background = async () => {
  (AppState as any).currentState = 'background';
  await act(async () => appStateHandler?.('background' as AppStateStatus));
};

describe('UserAvatar', () => {
  beforeEach(() => {
    appStateHandler = undefined;
    (AppState as any).currentState = 'active';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler: (state: AppStateStatus) => void) => {
        appStateHandler = handler;
        return { remove: jest.fn() } as any;
      });
    mockAvatarUrl.mockReset()
      .mockReturnValue('https://music.example/avatar.png');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reloads a stable avatar URL when the app returns to the foreground', async () => {
    const view = await render(<UserAvatar username="Zack" size={controlSize.avatarTabHeader} borderRadius={16} />);

    expect(view.getByTestId('user-avatar-image').props.source).toEqual({
      uri: 'https://music.example/avatar.png',
      cache: 'default',
    });

    await background();
    await foreground();

    // The URL is reused rather than rebuilt: regenerating Navidrome's signed
    // URL would defeat its cache.
    expect(mockAvatarUrl).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('user-avatar-image').props.source).toEqual({
      uri: 'https://music.example/avatar.png',
      cache: 'reload',
    });
  });

  it('keeps the image mounted across a refresh so it does not flicker', async () => {
    const view = await render(<UserAvatar username="Zack" size={controlSize.avatarTabHeader} borderRadius={16} />);
    const before = view.getByTestId('user-avatar-image');

    await background();
    await foreground();

    // Same element instance means React reused the node rather than tearing it
    // down. The key is the URL alone; folding the reload generation into it
    // remounts the picture and exposes the fallback letter mid-transition,
    // which is the flicker this guards against. `key` itself is not readable
    // from the rendered tree, so identity is what detects that remount — it
    // goes false the moment the generation re-enters the key.
    expect(view.getByTestId('user-avatar-image')).toBe(before);
  });

  it('does not reload while the app merely stays in the foreground', async () => {
    const view = await render(<UserAvatar username="Zack" size={controlSize.avatarTabHeader} borderRadius={16} />);

    // A tab switch does not change AppState, so nothing here should invalidate
    // the image — that repeated invalidation was the original flicker.
    await foreground();
    await foreground();

    expect(view.getByTestId('user-avatar-image').props.source).toEqual({
      uri: 'https://music.example/avatar.png',
      cache: 'default',
    });
  });

  it('falls back to the initial when no avatar URL is available', async () => {
    mockAvatarUrl.mockReturnValue(null);

    const view = await render(<UserAvatar username="Zack" size={controlSize.avatarTabHeader} borderRadius={16} />);

    expect(view.queryByTestId('user-avatar-image')).toBeNull();
    expect(view.getByText('Z')).toBeTruthy();
  });
});
