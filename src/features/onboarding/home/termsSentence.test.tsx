import React from 'react';
import { render } from '@testing-library/react-native';

import en from '@/locales/en.json';
import ja from '@/locales/ja.json';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn(), useSelector: () => null }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: { themeColor: '#f50' } }) }));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ md: 8, pill: 999 }) }));
jest.mock('@/features/layout/useWindowLayout', () => ({ useWindowLayout: () => ({ width: 390, height: 844 }) }));
jest.mock('@/features/settings/onboarding/state', () => ({
  setHasSeenGetStarted: jest.fn(),
  selectHasSeenGetStarted: () => true,
}));

/** Swapped per test, so one locale's word order can be checked against another's. */
let mockDictionary: Record<string, string> = {};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const raw = mockDictionary[key] ?? key;
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, value),
        raw
      );
    },
  }),
}));

import Onboarding from './index';

const flatten = (node: unknown, prefix = ''): Record<string, string> =>
  Object.entries(node as Record<string, unknown>).reduce((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...out, [path]: value }
      : { ...out, ...flatten(value, path) };
  }, {});

/**
 * The terms line is the one sentence a person is asked to agree to, so the
 * two documents in it are links rather than words about links. It is built by
 * interpolating sentinels into the translated string and splitting on them,
 * which is what lets a translator put the placeholders where their grammar
 * wants them — so the test that matters is the one in another language.
 */
describe('the terms line', () => {
  it('renders the two documents as link roles', async () => {
    mockDictionary = flatten(en);

    const view = await render(<Onboarding />);
    const links = view.getAllByRole('link');

    expect(links.map(l => l.props.children)).toEqual(['Terms', 'Privacy Policy']);
  });

  it('underlines them, which is what marks a link without spending a colour', async () => {
    mockDictionary = flatten(en);

    const view = await render(<Onboarding />);
    const [terms] = view.getAllByRole('link');

    expect(terms.props.style).toEqual(
      expect.objectContaining({ textDecorationLine: 'underline' })
    );
  });

  it('keeps the sentence around them', async () => {
    mockDictionary = flatten(en);

    const view = await render(<Onboarding />);

    expect(view.getByText(/By continuing you confirm/)).toBeTruthy();
  });

  it('follows the order the language puts them in, not English word order', async () => {
    mockDictionary = flatten(ja);

    const view = await render(<Onboarding />);
    const links = view.getAllByRole('link');

    expect(links.map(l => l.props.children)).toEqual(['利用規約', 'プライバシーポリシー']);
  });

  it('opens the real documents', async () => {
    mockDictionary = flatten(en);

    const view = await render(<Onboarding />);
    const links = view.getAllByRole('link');

    expect(links).toHaveLength(2);
    links.forEach(link => expect(typeof link.props.onPress).toBe('function'));
  });
});
