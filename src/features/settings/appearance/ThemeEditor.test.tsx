import React, { type ReactNode } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ThemeEditor from './ThemeEditor';
import { ThemeGallery } from './components/ThemeGallery';
import settingsAppearanceReducer, { selectActiveTheme, setActiveTheme } from './state';
import { contrast } from '@/features/theme/color';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

// Names in labels, so each card and colour row can be found by what it is.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));

// The picker is native drawing; what it reports is what matters here, so the
// stand-in hands back whatever colour a test passes through `mockPick`.
let mockPick: ((hex: string) => void) | null = null;
const pick = (hex: string) => act(async () => { mockPick!(hex); });
jest.mock('reanimated-color-picker', () => {
  const ColorPicker = ({ onCompleteJS, children }: { onCompleteJS: (c: { hex: string }) => void; children?: React.ReactNode }) => {
    mockPick = hex => onCompleteJS({ hex });
    return children ?? null;
  };
  return { __esModule: true, default: ColorPicker, Panel1: () => null, HueSlider: () => null };
});

function makeStore() {
  return configureStore({ reducer: { settingsAppearance: settingsAppearanceReducer } });
}

function renderWith(store: ReturnType<typeof makeStore>, ui: React.ReactElement) {
  const Wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  Wrapper.displayName = 'TestStoreWrapper';
  return render(ui, { wrapper: Wrapper });
}

beforeEach(() => {
  mockPick = null;
  jest.clearAllMocks();
});

describe('ThemeGallery', () => {
  it('offers every preset as one radio group and applies the one tapped', async () => {
    const store = makeStore();
    const view = await renderWith(store, <ThemeGallery />);

    const cards = view.getAllByRole('radio');
    expect(cards.length).toBeGreaterThan(1);
    expect(cards.filter(c => c.props.accessibilityState?.checked)).toHaveLength(1);

    await fireEvent.press(view.getByLabelText('a11y.settings.themeCard:Midnight'));
    expect(selectActiveTheme(store.getState()).id).toBe('midnight');
  });

  it('opens the editor from the customize row', async () => {
    const view = await renderWith(makeStore(), <ThemeGallery />);
    await fireEvent.press(view.getByText('settings.appearance.gallery.customize'));
    expect(mockPush).toHaveBeenCalledWith('/settings/themeEditorView');
  });
});

describe('ThemeEditor', () => {
  it('turns a colour change on a preset into a copy, and keeps its text readable', async () => {
    const store = makeStore();
    store.dispatch(setActiveTheme('forest'));
    const view = await renderWith(store, <ThemeEditor />);

    // Near-white text on a near-white background is what the guard is for.
    await fireEvent.press(view.getAllByLabelText('a11y.settings.editColor:settings.appearance.editor.background')[0]);
    await pick('#fafafa');
    await fireEvent.press(view.getAllByLabelText('a11y.settings.editColor:settings.appearance.editor.text')[0]);
    await pick('#f0f0f0');

    const theme = selectActiveTheme(store.getState());
    expect(theme.basedOn).toBe('forest');
    expect(theme.palettes.light.background).toBe('#fafafa');
    expect(contrast(theme.palettes.light.text, '#fafafa')).toBeGreaterThanOrEqual(4.5);
  });

  it('fixes a theme to one scheme and shows only that scheme\'s colours', async () => {
    const store = makeStore();
    const view = await renderWith(store, <ThemeEditor />);
    expect(view.getByText('settings.appearance.editor.colors.light')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('settings.appearance.editor.schemes.dark'));

    expect(selectActiveTheme(store.getState()).scheme).toBe('dark');
    expect(view.queryByText('settings.appearance.editor.colors.light')).toBeNull();
    expect(view.getByText('settings.appearance.editor.colors.dark')).toBeTruthy();
  });

  it('deletes a custom theme after asking, and goes back to its preset', async () => {
    const store = makeStore();
    store.dispatch(setActiveTheme('rose'));
    const view = await renderWith(store, <ThemeEditor />);
    await fireEvent.press(view.getByLabelText('a11y.settings.editColor:settings.appearance.editor.accent'));
    await pick('#123456');

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(view.getByText('settings.appearance.editor.delete'));
    const buttons = alert.mock.calls[0][2]!;
    buttons.find(b => b.style === 'destructive')!.onPress!();

    expect(store.getState().settingsAppearance.customThemes).toEqual([]);
    expect(selectActiveTheme(store.getState()).id).toBe('rose');
    expect(mockBack).toHaveBeenCalled();
  });

  it('offers no delete for a preset', async () => {
    const view = await renderWith(makeStore(), <ThemeEditor />);
    expect(view.queryByText('settings.appearance.editor.delete')).toBeNull();
  });
});
