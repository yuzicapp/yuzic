import { textScaleFromPersisted } from './startupTextScale';

/** What redux-persist writes: each key of the slice as its own JSON string. */
const persisted = (theme: unknown) => JSON.stringify({ theme: JSON.stringify(theme), themeMode: '"system"' });

describe('textScaleFromPersisted', () => {
  it('reads the size saved on the theme', () => {
    expect(textScaleFromPersisted(persisted({ shape: { textScale: 1.3 } }))).toBe(1.3);
  });

  it('is the default size with nothing saved yet', () => {
    expect(textScaleFromPersisted(null)).toBe(1);
    expect(textScaleFromPersisted(persisted({ shape: {} }))).toBe(1);
  });

  it('refuses a size it does not offer, or a blob it cannot read, rather than guessing', () => {
    expect(textScaleFromPersisted(persisted({ shape: { textScale: 7 } }))).toBe(1);
    expect(textScaleFromPersisted('{not json')).toBe(1);
  });
});
