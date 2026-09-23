import { accentFromCover } from './useLiveCoverAccent';
import { contrast } from './color';

jest.mock('react-native-image-colors', () => ({ getColors: jest.fn() }));
jest.mock('@/features/playback/PlayingContext', () => ({ usePlayingState: () => ({ currentSong: null }) }));

describe('accentFromCover', () => {
  it('takes the most colourful swatch', () => {
    expect(accentFromCover({ platform: 'android', vibrant: '#1e88e5', muted: '#777777' }, '#ff7f7f')).toBe('#1e88e5');
  });

  it('darkens a pale swatch until white text reads on it, as the accent carries white text', () => {
    const accent = accentFromCover({ platform: 'ios', primary: '#ffe9a8' }, '#ff7f7f');
    expect(contrast(accent, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(accent).toMatch(/^#[0-9a-f]{6}$/);
  });
});
