/**
 * The in-app text size against the caps on structural text.
 *
 * The cap bounds only the system multiplier, so a capped role built from the
 * already-enlarged scale reached both at once and overflowed the fixed box it
 * was capped to protect. These pin that the in-app size reaches ordinary text
 * and stops short of the capped roles.
 */
function typographyAt(textScale: number) {
  let mod: typeof import('./typography') | undefined;
  jest.isolateModules(() => {
    jest.doMock('./startupTextScale', () => ({ readStartupTextScale: () => textScale, TEXT_SCALES: [0.9, 1, 1.15, 1.3] }));
    mod = require('./typography');
  });
  return mod!;
}

describe('the in-app text size', () => {
  it('enlarges ordinary text, size and leading together', () => {
    const { typography } = typographyAt(1.3);
    expect(typography.rowTitle.fontSize).toBe(Math.round(16 * 1.3));
  });

  it('leaves text in fixed-height controls at the base size, for the system cap alone to grow', () => {
    const { cappedTypography } = typographyAt(1.3);
    expect(cappedTypography.control.rowTitle.fontSize).toBe(16);
    expect(cappedTypography.glyph.caption.fontSize).toBe(13);
  });

  it('changes nothing at the default size', () => {
    const { typography, cappedTypography } = typographyAt(1);
    expect(typography.rowTitle.fontSize).toBe(16);
    expect(cappedTypography.control.rowTitle.fontSize).toBe(16);
  });
});
