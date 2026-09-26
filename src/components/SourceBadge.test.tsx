import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import SourceBadge from './SourceBadge';
import { TextScaleProvider } from '@/features/theme/textScale';

let mockTextScale = 1;
jest.mock('@/features/theme/useActiveTheme', () => ({
  useActiveTheme: () => ({ shape: { textScale: mockTextScale, radius: 'default' } }),
}));

async function renderAt(scale: number) {
  mockTextScale = scale;
  return render(
    <TextScaleProvider>
      <SourceBadge letter="D" color="#ff0000" />
    </TextScaleProvider>,
  );
}

describe('SourceBadge', () => {
  it('grows its letter with the text size', async () => {
    const small = StyleSheet.flatten((await renderAt(1)).getByText('D').props.style) as { fontSize: number };
    const large = StyleSheet.flatten((await renderAt(1.3)).getByText('D').props.style) as { fontSize: number };
    expect(large.fontSize).toBeGreaterThan(small.fontSize);
  });

  it('is bounded by a minimum rather than a fixed square, so the letter is never clipped', async () => {
    // The six copies this replaced were all `width: 20, height: 20`. With the
    // text size applying while the app runs, a fixed box crops its own letter.
    const view = await renderAt(1.3);
    const box = StyleSheet.flatten(view.getByText('D').parent?.props.style) as Record<string, unknown>;
    expect(box.minHeight).toBe(20);
    expect(box.height).toBeUndefined();
    expect(box.width).toBeUndefined();
  });
});
