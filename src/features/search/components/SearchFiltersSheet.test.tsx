import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SearchFiltersSheet from './SearchFiltersSheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { name?: string }) => options?.name ? `${key}:${options.name}` : key }),
}));
jest.mock('@/features/settings/sources/sourceUsePrompt', () => ({
  promptSourceUse: (...args: unknown[]) => mockPrompt(...args),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = require('react-native');
  const Pass = ({ children }: any) => <View>{children}</View>;
  return { BottomSheetModal: Pass, BottomSheetScrollView: Pass };
});
jest.mock('@/components/BottomSheetBackdrop', () => ({ renderBackdrop: () => null }));
jest.mock('@/features/theme/useTheme', () => ({ useTheme: () => ({ colors: { border: '#333', secondary: '#fff', subtext: '#aaa', themeColor: '#f00' } }) }));
jest.mock('@/components/options/OptionSheetPrimitives', () => {
  const { Text, View } = require('react-native');
  return {
    OptionSheetDivider: () => null,
    OptionSheetSectionLabel: ({ label }: any) => <Text>{label}</Text>,
    OptionSheetRow: ({ label, description, onPress, trailing, testID }: any) => (
      <View testID={testID}>
        <Text onPress={onPress}>{label}</Text>
        {description ? <Text>{description}</Text> : null}
        {trailing}
      </View>
    ),
    optionSheetStyles: {},
    useOptionSheetBackground: () => ({}),
    useOptionSheetContentStyle: () => ({}),
  };
});
jest.mock('@/features/sources/registry', () => ({
  ALL_SOURCES: [{ id: 'deezer' }, { id: 'musicbrainz' }],
  getSourceMeta: (id: string) => ({ label: id === 'deezer' ? 'Deezer' : 'MusicBrainz', color: '#000' }),
}));

async function renderSheet(props: Partial<React.ComponentProps<typeof SearchFiltersSheet>> = {}) {
  const onToggleSource = jest.fn();
  const view = await render(
    <SearchFiltersSheet
      resultScope="other"
      onChangeScope={jest.fn()}
      availableSourceIds={[]}
      selectedSourceIds={[]}
      onToggleSource={onToggleSource}
      selectedEntityTypes={['album', 'artist']}
      onToggleEntityType={jest.fn()}
      {...props}
    />
  );
  return { view, onToggleSource };
}

/* eslint-disable no-var -- hoisted for the jest.mock factory above */
var mockPrompt = jest.fn();
/* eslint-enable no-var */

/**
 * "Other sources" with nothing turned on used to be a dead end: a line
 * telling you to leave the search and go find a setting. Then it was a switch,
 * then a "Turn on" action, and each made the row change shape once it was on.
 */
describe('SearchFiltersSheet sources', () => {
  beforeEach(() => mockPrompt.mockReset());

  it('lists every source as the same kind of row, saying which are off and what they would be sent', async () => {
    const { view } = await renderSheet({ availableSourceIds: ['deezer'], selectedSourceIds: ['deezer'] });

    expect(view.getByTestId('search-filters-source-deezer')).toBeTruthy();
    expect(view.getByTestId('search-filters-source-musicbrainz')).toBeTruthy();
    expect(view.queryByText('search.filters.sourceOff:Deezer')).toBeNull();
    expect(view.getByText('search.filters.sourceOff:MusicBrainz')).toBeTruthy();
    expect(view.getByText('search.filters.alsoInSettings')).toBeTruthy();
    expect(view.queryByText('settings.sources.turnOn')).toBeNull();
    expect(view.queryAllByRole('switch')).toHaveLength(0);
  });

  it('asks before sending searches to a source that is off, and includes it once turned on', async () => {
    const { view, onToggleSource } = await renderSheet();

    fireEvent.press(view.getByText('Deezer'));

    expect(mockPrompt).toHaveBeenCalledWith('deezer.search', expect.objectContaining({ onTurnOn: expect.any(Function) }));
    expect(onToggleSource).not.toHaveBeenCalled();

    mockPrompt.mock.calls[0][1].onTurnOn();
    expect(onToggleSource).toHaveBeenCalledWith('deezer');
  });

  it('includes or leaves out a source that is on without asking', async () => {
    const { view, onToggleSource } = await renderSheet({ availableSourceIds: ['deezer'] });

    fireEvent.press(view.getByText('Deezer'));

    expect(onToggleSource).toHaveBeenCalledWith('deezer');
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('has no settings note once every source is on', async () => {
    const { view } = await renderSheet({ availableSourceIds: ['deezer', 'musicbrainz'] });

    expect(view.queryByText(/search\.filters\.sourceOff/)).toBeNull();
    expect(view.queryByText('search.filters.alsoInSettings')).toBeNull();
  });
});
