import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import EmptyState from './EmptyState';

let mockBottomOverlayHeight = 0;

jest.mock('@/features/theme/useRadius', () => ({
  useRadius: () => ({ thumb: 6, md: 8, card: 12, lg: 16, panel: 24, pill: 999, pillFor: (n: number) => n / 2 }),
}));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { subtext: '#666', border: '#333', text: '#fff' } }),
}));

jest.mock('@/features/theme/useScrollClearance', () => ({
  useBottomOverlayHeight: () => mockBottomOverlayHeight,
}));

describe('EmptyState', () => {
  it('removes an overlaying dock and playing bar from the centering area', async () => {
    mockBottomOverlayHeight = 144;
    const view = await render(<EmptyState message="Nothing here" />);

    expect(StyleSheet.flatten(view.getByTestId('empty-state').props.style)).toMatchObject({
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 144,
    });
  });

  it('adds no offset when the dock already participates in layout', async () => {
    mockBottomOverlayHeight = 0;
    const view = await render(<EmptyState message="Nothing here" />);

    expect(StyleSheet.flatten(view.getByTestId('empty-state').props.style).paddingBottom).toBe(0);
  });
});
