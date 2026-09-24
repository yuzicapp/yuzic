import { contrast, ensureContrast, isDark, mix, parseColor, withAlpha } from './color';

describe('parseColor', () => {
  it('reads the forms the palettes are written in', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#FF3B30')).toEqual({ r: 255, g: 59, b: 48, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 1);
    expect(parseColor('rgba(255,69,58,0.12)')).toEqual({ r: 255, g: 69, b: 58, a: 0.12 });
  });

  it('refuses anything else rather than guessing', () => {
    expect(parseColor('red')).toBeNull();
    expect(parseColor('#12')).toBeNull();
  });
});

describe('mix and withAlpha', () => {
  it('mixes as six-digit hex, which tinted() and the picker expect', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#000', '#fff', 0)).toBe('#000000');
  });

  it('writes an opacity as rgba', () => {
    expect(withAlpha('#0b1020', 0.82)).toBe('rgba(11,16,32,0.82)');
  });
});

describe('contrast', () => {
  it('matches the WCAG extremes', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 0);
    expect(contrast('#777', '#777')).toBe(1);
  });

  it('tells a dark background from a light one', () => {
    expect(isDark('#121212')).toBe(true);
    expect(isDark('#f6f1e7')).toBe(false);
  });
});

describe('ensureContrast', () => {
  it('leaves a colour that already reads exactly as picked', () => {
    expect(ensureContrast('#000000', ['#ffffff'], 4.5)).toBe('#000000');
  });

  it('pushes pale grey on pale grey until it reads', () => {
    const fixed = ensureContrast('#dddddd', ['#eeeeee'], 4.5);
    expect(contrast(fixed, '#eeeeee')).toBeGreaterThanOrEqual(4.5);
  });

  it('pushes toward white on a dark background, not darker', () => {
    const fixed = ensureContrast('#333333', ['#222222'], 4.5);
    expect(isDark(fixed)).toBe(false);
  });

  it('satisfies every background it is given, not just the first', () => {
    const fixed = ensureContrast('#888888', ['#ffffff', '#dddddd'], 4.5);
    expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fixed, '#dddddd')).toBeGreaterThanOrEqual(4.5);
  });
});
