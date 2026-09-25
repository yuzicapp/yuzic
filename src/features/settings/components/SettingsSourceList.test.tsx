import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SettingsSourceList from './SettingsSourceList';

jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { themeColor: '#7c3aed', secondary: '#111', subtext: '#666', border: '#ddd', background: '#fff' } }),
}));
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ pill: 999 }) }));

jest.mock('react-native-reorderable-list', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');

  const MockNestedList = ({ data, renderItem, onReorder }: any) => (
    <View testID="draggable-source-list">
      {data.map((item: any) => (
        <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
      ))}
      {/* A drag of the first row to the end, which for the two-source fixture
          is the same reversal the old mock produced. */}
      <View
        testID="complete-source-reorder"
        onTouchEnd={() => onReorder({ from: 0, to: data.length - 1 })}
      />
    </View>
  );

  return {
    NestedReorderableList: MockNestedList,
    ScrollViewContainer: ScrollView,
    // The real one, so the test exercises the reordering rather than asserting
    // against a second implementation of it.
    reorderItems: (items: any[], from: number, to: number) => {
      const next = [...items];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    },
    useReorderableDrag: () => jest.fn(),
    useIsActive: () => false,
  };
});

describe('SettingsSourceList', () => {
  const sources = [
    { id: 'deezer', label: 'Deezer', subtext: 'Artwork', enabled: true, onEnabledChange: jest.fn() },
    { id: 'coverartarchive', label: 'Cover Art Archive', subtext: 'Artwork', enabled: true, onEnabledChange: jest.fn() },
  ];

  it('keeps the server source visibly first and persists a drag reorder', async () => {
    const onOrderChange = jest.fn();
    const view = await render(
      <SettingsSourceList
        pinnedSource={{ label: 'Your server', subtext: 'Always checked first' }}
        sources={sources}
        onOrderChange={onOrderChange}
      />
    );

    expect(view.getByText('Your server')).toBeTruthy();
    expect(view.getByText('settings.sources.alwaysFirst')).toBeTruthy();
    fireEvent(view.getByTestId('complete-source-reorder'), 'touchEnd');
    expect(onOrderChange).toHaveBeenCalledWith(['coverartarchive', 'deezer']);
  });

  it('uses the drag handle without repeating positions as text', async () => {
    const view = await render(
      <SettingsSourceList sources={sources} onOrderChange={jest.fn()} />
    );

    expect(view.getByTestId('source-drag-deezer')).toBeTruthy();
    expect(view.getByTestId('source-drag-coverartarchive')).toBeTruthy();
    expect(view.queryByText('1')).toBeNull();
    expect(view.queryByText('2')).toBeNull();
  });

  it('can omit repetitive row descriptions in compact editors', async () => {
    const view = await render(
      <SettingsSourceList sources={sources} onOrderChange={jest.fn()} showSubtext={false} />
    );

    expect(view.queryByText('Artwork')).toBeNull();
  });

  it('does not expose a drag affordance until two enabled sources can be reordered', async () => {
    const view = await render(
      <SettingsSourceList
        sources={[{ ...sources[0], enabled: false }]}
        onOrderChange={jest.fn()}
      />
    );

    expect(view.queryByTestId('source-drag-deezer')).toBeNull();
  });
});
