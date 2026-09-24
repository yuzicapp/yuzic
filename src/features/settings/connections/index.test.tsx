import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ConnectionsView from './';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The shared settings chrome draws with the theme, which this test does not set up.
jest.mock('@/features/theme/useActiveTheme', () => ({
  useActiveTheme: () => jest.requireActual('@/features/theme/presets').DEFAULT_THEME,
}));

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  // The screen asks for every declared integration's connected state at once;
  // the shared settings chrome asks for things this test does not set up.
  useSelector: (selector: (state: unknown) => unknown) => {
    try { return selector({}); } catch { return undefined; }
  },
}));

jest.mock('@/state/redux/selectors/listenbrainzSelectors', () => ({
  selectListenBrainzAuthenticated: () => false,
}));

jest.mock('@/state/redux/selectors/audiomuseSelectors', () => ({
  selectAudiomuseEnabled: () => true,
  selectAudiomuseAuthenticated: () => true,
}));

jest.mock('@/features/downloaders/registry', () => ({
  useDownloaderStates: () => [
    { def: { id: 'lidarr', settingsRoute: '/settings/lidarrView' }, isConnected: true },
    { def: { id: 'slskd', settingsRoute: '/settings/slskdView' }, isConnected: false },
    { def: { id: 'soulsync', settingsRoute: '/settings/soulsyncView' }, isConnected: false },
  ],
}));

describe('ConnectionsView', () => {
  it('lists only managed integrations and downloaders, not feature-source toggles', async () => {
    const view = await render(<ConnectionsView />);

    expect(view.queryByText('Deezer')).toBeNull();
    expect(view.queryByText('MusicBrainz')).toBeNull();
    expect(view.queryByText('Last.fm')).toBeNull();

    expect(view.getByText('ListenBrainz')).toBeTruthy();
    expect(view.getByText('AudioMuse-AI')).toBeTruthy();

    // Downloaders (formerly the Downloaders hub) — labelled via i18n keys,
    // which the mocked i18n instance echoes back as the key itself.
    expect(view.getByText('settings.downloaders.lidarr.title')).toBeTruthy();
    expect(view.getByText('settings.downloaders.slskd.title')).toBeTruthy();
    expect(view.getByText('settings.downloaders.soulsync.title')).toBeTruthy();
    expect(view.getAllByText('settings.connections.status.ready')).toHaveLength(2);
    expect(view.getAllByText('settings.connections.status.notSetUp')).toHaveLength(2);

    fireEvent.press(view.getByText('AudioMuse-AI'));
    expect(mockPush).toHaveBeenCalledWith('/settings/audiomuseView');

    fireEvent.press(view.getByText('settings.downloaders.lidarr.title'));
    expect(mockPush).toHaveBeenCalledWith('/settings/lidarrView');
  });
});
