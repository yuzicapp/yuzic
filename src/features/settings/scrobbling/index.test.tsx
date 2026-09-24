import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ScrobblingSettings from './';

const mockDispatch = jest.fn();
let mockLastfmRoute: string = 'through-server';
let mockListenBrainzRoute: string = 'through-server';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// Pulls in react-native-reanimated transitively via SpinningLoaderCircle,
// which doesn't transform in this jest environment — same reason
// api/listenbrainz is mocked in scrobbleRouting.test.tsx. Not under test
// here; SettingsSelectCard's own loading branch isn't exercised by this
// screen (it's never given `isLoading`).
jest.mock('@/components/SpinningLoaderCircle', () => 'SpinningLoaderCircle');

jest.mock('@/providers/registry/useApi', () => ({
  useApi: () => ({ songs: { scrobbleKind: 'scrobble' } }),
}));

// The shared settings chrome draws with the theme, which this test does not set up.
jest.mock('@/features/theme/useActiveTheme', () => ({
  useActiveTheme: () => jest.requireActual('@/features/theme/presets').DEFAULT_THEME,
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: string) => {
    switch (selector) {
      case 'activeServer':
        return { id: 'srv-1', type: 'navidrome' };
      case 'lastfmRoute':
        return mockLastfmRoute;
      case 'listenBrainzRoute':
        return mockListenBrainzRoute;
      default:
        return undefined;
    }
  },
}));

jest.mock('@/state/redux/selectors/serversSelectors', () => ({
  selectActiveServer: 'activeServer',
}));

jest.mock('@/state/redux/selectors/scrobbleRoutingSelectors', () => ({
  selectLastfmScrobbleRoute: 'lastfmRoute',
  selectListenBrainzScrobbleRoute: 'listenBrainzRoute',
}));

jest.mock('@/features/settings/scrobbling/state', () => ({
  setScrobbleRoute: (payload: unknown) => ({ type: 'settings/setScrobbleRoute', payload }),
}));

describe('ScrobblingSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastfmRoute = 'through-server';
    mockListenBrainzRoute = 'through-server';
  });

  it('offers only Disabled/Through-server for Last.fm — no Direct option this cut', async () => {
    const view = await render(<ScrobblingSettings />);
    // Two Last.fm rows (disabled, through-server) plus three for ListenBrainz
    // (disabled, through-server, direct) — five selectable route rows total.
    expect(view.getByText('settings.scrobbling.routeDirect')).toBeTruthy();
    // Only one "routeDisabled" label rendered per card, so both cards' rows
    // exist; the absence of a second Direct row for Last.fm is what this
    // test actually pins — there is exactly one Direct row in the tree.
    expect(view.getAllByText('settings.scrobbling.routeDirect')).toHaveLength(1);
  });

  it('dispatches a per-destination route change scoped to the active server', async () => {
    const view = await render(<ScrobblingSettings />);
    fireEvent.press(view.getByText('settings.scrobbling.routeDirect'));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'settings/setScrobbleRoute',
      payload: { serverId: 'srv-1', destination: 'listenbrainz', route: 'direct' },
    });
  });

  it('shows the duplicate-scrobble risk note when a destination routes through-server', async () => {
    const view = await render(<ScrobblingSettings />);
    expect(view.getByTestId('scrobbling-duplicate-risk-note')).toBeTruthy();
    expect(view.getByText('settings.scrobbling.duplicateRiskNote')).toBeTruthy();
  });

  it('hides the risk note when nothing routes through the server', async () => {
    mockLastfmRoute = 'disabled';
    mockListenBrainzRoute = 'direct';
    const view = await render(<ScrobblingSettings />);
    expect(view.queryByTestId('scrobbling-duplicate-risk-note')).toBeNull();
  });
});
