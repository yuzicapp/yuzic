import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import LyricsPreviewCard from './LyricsPreviewCard';
import type { LyricsResult } from '@/providers/contracts/ServerAdapter';

/**
 * Lyrics with no timings have to be reachable (#316).
 *
 * They were fetched, scrubbed of nothing, stored, and rendered correctly by
 * `LyricsBottomSheet` — and no user could ever see them, because this card is
 * the only thing that opens that sheet and it was gated on `lyrics.synced`.
 * A comment beside the gate said unsynced lyrics "open in the sheet from the
 * player's own control instead"; no such control existed.
 *
 * So two things are asserted here: the card renders unsynced lines at all,
 * and it renders them without pretending one of them is current.
 */
jest.mock('@/features/theme/useRadius', () => ({ useRadius: () => ({ panel: 12 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ colors: { secondary: '#fff', subtext: '#aaa', border: '#333' }, isDarkMode: true }),
}));

const unsynced: LyricsResult = {
  synced: false,
  lines: [
    { startMs: 0, text: 'first line' },
    { startMs: 0, text: 'second line' },
    { startMs: 0, text: 'third line' },
  ],
};

const synced: LyricsResult = {
  synced: true,
  lines: [
    { startMs: 0, text: 'first line' },
    { startMs: 10_000, text: 'second line' },
    { startMs: 20_000, text: 'third line' },
  ],
};

async function renderCard(lyrics: LyricsResult, position: number) {
  return await render(
    <LyricsPreviewCard
      lyrics={lyrics}
      position={position}
      contentWidth={320}
      onPress={() => {}}
    />
  );
}

/** The opacity each line was given, in order, however it was styled. */
function lineOpacities(): (number | undefined)[] {
  return screen.getAllByText(/line$/).map(node => {
    const style = node.props.style as unknown;
    const flat = (Array.isArray(style) ? style : [style]).filter(Boolean) as Record<string, unknown>[];
    const withOpacity = flat.reverse().find(s => typeof s?.opacity === 'number');
    return withOpacity?.opacity as number | undefined;
  });
}

describe('lyrics with no timings', () => {
  it('shows every line', async () => {
    await renderCard(unsynced, 0);

    expect(screen.getByText('first line')).toBeTruthy();
    expect(screen.getByText('second line')).toBeTruthy();
    expect(screen.getByText('third line')).toBeTruthy();
  });

  it('dims none of them, since none of them is "now"', async () => {
    await renderCard(unsynced, 0);

    // Not a fixed number: the point is that no line is singled out.
    expect(new Set(lineOpacities()).size).toBe(1);
  });

  it('does not single out the last line once the track is playing', async () => {
    // The regression this guards: every unsynced line carries `startMs: 0`,
    // so a position-based lookup calls the *last* line current from the
    // first second onward.
    await renderCard(unsynced, 90);

    expect(new Set(lineOpacities()).size).toBe(1);
  });
});

describe('lyrics with timings still follow the track', () => {
  it('singles out exactly one line', async () => {
    await renderCard(synced, 12);

    const opacities = lineOpacities();
    expect(opacities.filter(o => o === 1)).toHaveLength(1);
    expect(new Set(opacities).size).toBeGreaterThan(1);
  });
});

describe('the player screen does not gate the card on timings', () => {
  it('renders the card for any lyrics it has', () => {
    const playingScreen = readFileSync(join(__dirname, '..', 'PlayingScreen.tsx'), 'utf8');

    // The card is the only caller of `openLyricsSheet`, so a `synced` test
    // here is unsynced lyrics becoming unreachable again.
    expect(playingScreen).toMatch(/\{lyricsAvailable && lyrics && \(\s*<LyricsPreviewCardResolver/);
    expect(playingScreen).not.toMatch(/lyrics\?\.synced && \(/);
  });
});

/**
 * The other half of the unsynced mode: no autoscroll.
 *
 * I wrote this off as needing the ScrollView ref and therefore untestable.
 * `scrollTo` is on `ScrollView.prototype`, and the card's effect runs off
 * layout events the test can fire, so it is neither.
 *
 * The effect needs a measured line and a content height before it will scroll
 * at all, which is why both are fired here.
 */
describe('following the track by scrolling', () => {
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollTo.mockRestore();
  });

  /** Measure the nth line and give the content a height, as layout would. */
  const measure = (index: number) => {
    const line = screen.getAllByText(/line$/)[index];
    if (!line) throw new Error(`no line at ${index}`);
    fireEvent(line, 'layout', { nativeEvent: { layout: { y: 300, height: 20 } } });
    // Fired at the line: `fireEvent` walks up for a handler, and the only
    // `onContentSizeChange` above it is the card's ScrollView.
    fireEvent(line, 'contentSizeChange', 320, 600);
  };

  it('scrolls to the line that is playing', async () => {
    await renderCard(synced, 12);

    await act(async () => { measure(1); });

    expect(scrollTo).toHaveBeenCalled();
    const [{ y }] = scrollTo.mock.calls[scrollTo.mock.calls.length - 1] as [{ y: number }];
    expect(y).toBeGreaterThan(0);
  });

  it('does not scroll at all without timings', async () => {
    // The regression: every unsynced line carries `startMs: 0`, so a
    // position lookup would call the last line current and the card would
    // open scrolled to the end of the song's words.
    await renderCard(unsynced, 90);

    await act(async () => { measure(2); });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
