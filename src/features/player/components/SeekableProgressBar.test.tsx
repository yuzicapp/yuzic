import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

/**
 * Dragging the seek bar has to seek (#305).
 *
 * The bar was a PanResponder inside the player's native drag-to-close pan.
 * A drag a few points long let that pan activate, which cancels the JS
 * responder: the bar was told it had been terminated and dropped the seek.
 * Only a tap — over before anything could claim the touch — ever moved
 * playback. These drive the bar's own gesture callbacks the way the gesture
 * handler does, including the ending where the touch is taken from it.
 */

type Handlers = Record<string, (...args: unknown[]) => void>;
/* eslint-disable no-var -- hoisted for the jest.mock factory below */
var mockHandlers: Record<string, Handlers> = {};
/* eslint-enable no-var */

jest.mock('react-native-gesture-handler', () => {
  // Records every callback a builder is handed, and answers any other link
  // in the chain (`activeOffsetX`, `failOffsetY`, …) with itself.
  const builder = (kind: string) => {
    const handlers: Handlers = {};
    mockHandlers[kind] = handlers;
    const chain: object = new Proxy({}, {
      get: (_target, prop: string) => (...args: unknown[]) => {
        if (typeof args[0] === 'function') handlers[prop] = args[0] as Handlers[string];
        return chain;
      },
    });
    return chain;
  };
  return {
    Gesture: { Pan: () => builder('pan'), Tap: () => builder('tap'), Race: () => ({}) },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ pill: 999 }) }));

import { SeekableProgressBar } from './SeekableProgressBar';

const WIDTH = 200;

async function bar(onSeek = jest.fn()) {
  mockHandlers = {};
  const view = await render(<SeekableProgressBar value={30} duration={300} onSeek={onSeek} />);
  await act(async () => {
    await fireEvent(view.getByTestId('seek-bar'), 'layout', { nativeEvent: { layout: { width: WIDTH } } });
  });
  return { onSeek, view };
}

describe('SeekableProgressBar', () => {
  it('seeks to where a drag lets go', async () => {
    const { onSeek } = await bar();
    const pan = mockHandlers.pan;

    await act(async () => {
      pan.onStart({ x: 20 });
      pan.onUpdate({ x: 80 });
      pan.onUpdate({ x: 150 });
    });
    // Nothing is sent mid-drag: scrubbing is a preview until the finger lifts.
    expect(onSeek).not.toHaveBeenCalled();

    await act(async () => { pan.onEnd({ x: 150 }, true); });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(225);
  });

  it('still seeks when the drag is cancelled by another gesture', async () => {
    const { onSeek } = await bar();
    const pan = mockHandlers.pan;

    await act(async () => {
      pan.onStart({ x: 10 });
      pan.onUpdate({ x: 100 });
      pan.onEnd({ x: 100 }, false);
    });
    expect(onSeek).toHaveBeenCalledWith(150);
  });

  it('seeks on a tap, clamped to the ends of the track', async () => {
    const { onSeek } = await bar();
    const tap = mockHandlers.tap;

    await act(async () => { tap.onEnd({ x: 50 }, true); });
    await act(async () => { tap.onEnd({ x: WIDTH + 40 }, true); });
    await act(async () => { tap.onEnd({ x: -10 }, true); });
    expect(onSeek.mock.calls).toEqual([[75], [300], [0]]);
  });

  it('ignores a tap that failed', async () => {
    const { onSeek } = await bar();
    await act(async () => { mockHandlers.tap.onEnd({ x: 50 }, false); });
    expect(onSeek).not.toHaveBeenCalled();
  });
});
