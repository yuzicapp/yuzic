import React from 'react';
import { render } from '@testing-library/react-native';

import Settings from './';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '0.0.0' } } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-redux', () => ({ useSelector: () => ({ type: 'navidrome', username: 'tester', serverUrl: 'https://example.test' }) }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: { background: '#000', muted: '#222', secondary: '#fff', subtext: '#aaa' } }) }));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ pill: 999 }) }));
jest.mock('@/features/theme/useScrollClearance', () => ({ useScrollClearance: () => 24 }));
jest.mock('../components/Header', () => () => null);
jest.mock('../components/SettingsCard', () => {
  const SettingsCard = ({ children }: any) => <>{children}</>;
  return SettingsCard;
});
jest.mock('../components/SettingsDivider', () => () => null);
jest.mock('../components/SettingsRow', () => {
  const { Text } = require('react-native');
  const SettingsRow = ({ label }: any) => <Text>{label}</Text>;
  return SettingsRow;
});
jest.mock('@/components/Touchable', () => {
  const Touchable = ({ children }: any) => <>{children}</>;
  return Touchable;
});
jest.mock('@/components/UserAvatar', () => () => null);

describe('Settings home', () => {
  it('separates discovery controls from the general card', async () => {
    const view = await render(<Settings />);

    expect(view.getByText('settings.sections.general')).toBeTruthy();
    expect(view.getByText('settings.sections.discovery')).toBeTruthy();
    expect(view.getByText('settings.metadata.title')).toBeTruthy();
    expect(view.getByText('settings.home.title')).toBeTruthy();
    expect(view.getByText('settings.pages.title')).toBeTruthy();
    expect(view.getByText('settings.search.title')).toBeTruthy();
    expect(view.getByText('settings.scrobbling.title')).toBeTruthy();
  });

  /**
   * Downloads is a way of browsing what you have, so it belongs on the
   * Library tab with the others. Settings had a second entry to the same
   * screen, under Connections — it configured nothing, and a settings screen
   * that is really a link is a second place to look for one thing.
   */
  it('does not offer a way into the Downloads screen, which lives in the library', async () => {
    const view = await render(<Settings />);

    expect(view.queryByText('downloads.title')).toBeNull();
  });

  /**
   * The screen says which version you are running; About is where it can also
   * say what that version brought, and where the app lives. Both open on the
   * web, beside the policy links that already do.
   */
  it('offers the release notes and the site next to the version', async () => {
    const view = await render(<Settings />);

    expect(view.getByText('settings.rows.changelog')).toBeTruthy();
    expect(view.getByText('settings.rows.website')).toBeTruthy();
  });

  it('organises outside sources by purpose, with no page per company and no separate Lyrics page', async () => {
    const view = await render(<Settings />);

    expect(view.queryByText('settings.sources.title')).toBeNull();
    expect(view.queryByText('settings.lyrics.title')).toBeNull();
  });
});
