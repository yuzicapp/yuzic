import { coverPlaceholder, initialsFor, placeholderFor } from './coverPlaceholder';

describe('initialsFor', () => {
  it('takes the first and last word', () => {
    expect(initialsFor('Kind of Blue')).toBe('KB');
    expect(initialsFor('Dig Your Own Hole')).toBe('DH');
  });

  it('gives a single word one letter', () => {
    expect(initialsFor('Geogaddi')).toBe('G');
  });

  it('drops a leading article so a library does not bunch onto T', () => {
    expect(initialsFor('The Dark Side of the Moon')).toBe('DM');
    expect(initialsFor('A Love Supreme')).toBe('LS');
  });

  it('keeps the article when it is the whole name', () => {
    expect(initialsFor('The')).toBe('T');
  });

  it('ignores a trailing number rather than reading its first digit', () => {
    // Regression: these were S9, C7 and E7 — a letter plus an arbitrary digit.
    expect(initialsFor('Selected Ambient Works 85–92')).toBe('SW');
    expect(initialsFor('Cornell 5/8/77')).toBe('C');
    expect(initialsFor('Europe ’72')).toBe('E');
  });

  it('takes the first character of a non-Latin title', () => {
    expect(initialsFor('音楽図鑑')).toBe('音楽図鑑'.charAt(0));
  });

  it('is empty when there is nothing to draw', () => {
    expect(initialsFor('( )')).toBe('');
    expect(initialsFor('   ')).toBe('');
    expect(initialsFor('')).toBe('');
  });
});

describe('placeholderFor', () => {
  it('gives the same seed the same colour every time', () => {
    const once = placeholderFor('album:Miles Davis\u0000Kind of Blue', 'dark');
    const twice = placeholderFor('album:Miles Davis\u0000Kind of Blue', 'dark');
    expect(once).toEqual(twice);
  });

  it('separates albums by the same artist', () => {
    // The point of #290: four live records by one artist must not look alike.
    const seeds = [
      'album:Stevie Ray Vaughan\u0000Live at the El Mocambo',
      'album:Stevie Ray Vaughan\u0000Live at Carnegie Hall',
      'album:Stevie Ray Vaughan\u0000Texas Flood',
      'album:Stevie Ray Vaughan\u0000Couldn’t Stand the Weather',
    ];
    const colours = new Set(seeds.map(seed => placeholderFor(seed, 'dark').background));
    expect(colours.size).toBe(seeds.length);
  });

  it('spreads a realistic library across the wheel rather than clumping', () => {
    const hues = new Set<number>();
    for (let index = 0; index < 400; index += 1) {
      const background = placeholderFor(`album:Artist ${index}\u0000Record ${index}`, 'dark').background;
      const hue = Number(/hsl\((\d+)/.exec(background)?.[1]);
      hues.add(Math.floor(hue / 30));
    }
    // Twelve 30-degree buckets; every one should be reachable.
    expect(hues.size).toBe(12);
  });

  it('answers differently for light and dark', () => {
    const seed = 'album:Radiohead\u0000Kid A';
    expect(placeholderFor(seed, 'light').background).not.toBe(placeholderFor(seed, 'dark').background);
    expect(placeholderFor(seed, 'light').foreground).not.toBe(placeholderFor(seed, 'dark').foreground);
  });

  it('is one flat colour, not a gradient', () => {
    expect(typeof placeholderFor('anything', 'dark').background).toBe('string');
  });
});

describe('coverPlaceholder', () => {
  it('takes colour from the seed and letters from the name', () => {
    // Same album, retitled: the colour holds because the seed is the identity,
    // so a cover does not change shade when a tag is corrected.
    const seed = 'album:Boards of Canada\u0000Geogaddi';
    expect(coverPlaceholder(seed, 'Geogaddi', 'dark').background)
      .toBe(coverPlaceholder(seed, 'Geogaddi (Remastered)', 'dark').background);
    expect(coverPlaceholder(seed, 'Geogaddi (Remastered)', 'dark').initials).toBe('GR');
  });
});
