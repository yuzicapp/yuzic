import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { Text } from './Text';
import { TextScaleProvider } from '@/features/theme/textScale';

let mockTextScale = 1;
jest.mock('@/features/theme/useActiveTheme', () => ({
  useActiveTheme: () => ({ shape: { textScale: mockTextScale } }),
}));

/**
 * The in-app text size, which used to be multiplied into the type roles at
 * startup and is now applied here as text is drawn. These pin the two halves
 * of that: it reaches ordinary text, and it stops short of the surfaces built
 * around a fixed height.
 */
function sizeOf(node: { props: { style?: unknown } }) {
  return StyleSheet.flatten(node.props.style as never) as { fontSize?: number; lineHeight?: number };
}

async function renderAt(scale: number, element: React.ReactElement) {
  mockTextScale = scale;
  return render(<TextScaleProvider>{element}</TextScaleProvider>);
}

describe('the in-app text size', () => {
  it('enlarges text, size and leading together', async () => {
    const view = await renderAt(1.3, <Text style={{ fontSize: 16, lineHeight: 20 }}>Title</Text>);
    expect(sizeOf(view.getByText('Title'))).toMatchObject({
      fontSize: Math.round(16 * 1.3),
      lineHeight: Math.round(20 * 1.3),
    });
  });

  it('shrinks it too', async () => {
    const view = await renderAt(0.9, <Text style={{ fontSize: 16 }}>Title</Text>);
    expect(sizeOf(view.getByText('Title')).fontSize).toBe(Math.round(16 * 0.9));
  });

  it('changes nothing at the default size', async () => {
    const view = await renderAt(1, <Text style={{ fontSize: 16, lineHeight: 20 }}>Title</Text>);
    expect(sizeOf(view.getByText('Title'))).toMatchObject({ fontSize: 16, lineHeight: 20 });
  });

  it('leaves text in fixed-height controls alone', async () => {
    // The dock's labels and the playing bar: growing those moves the floor
    // every screen is measured against, not the text on one screen.
    const view = await renderAt(1.3, <Text appScaling={false} style={{ fontSize: 16 }}>Home</Text>);
    expect(sizeOf(view.getByText('Home')).fontSize).toBe(16);
  });

  it('does not scale text that inherits its size, which the parent already scaled', async () => {
    const view = await renderAt(1.3, <Text>Inherited</Text>);
    expect(sizeOf(view.getByText('Inherited'))?.fontSize).toBeUndefined();
  });

  it('keeps an array style, so callers can keep composing', async () => {
    const styles = StyleSheet.create({ base: { fontSize: 10 } });
    const view = await renderAt(1.15, <Text style={[styles.base, { color: '#fff' }]}>Composed</Text>);
    const flat = sizeOf(view.getByText('Composed')) as { fontSize?: number; color?: string };
    expect(flat.fontSize).toBe(Math.round(10 * 1.15));
    expect(flat.color).toBe('#fff');
  });
});
