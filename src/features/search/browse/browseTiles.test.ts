import type { Album } from '@/domain/entities/Album'
import { albumsForTile, browseTilesFor, MIN_ALBUMS_PER_TILE } from './browseTiles'

const album = (
  title: string,
  tags: { genres?: string[]; moods?: string[]; art?: boolean } = {}
) =>
  ({
    nativeId: title,
    title,
    genres: tags.genres ?? [],
    moods: tags.moods,
    cover: tags.art ? { kind: 'navidrome', coverArtId: title } : { kind: 'none' },
  }) as unknown as Album

describe('browseTilesFor', () => {
  it('ranks tags by how much of the library sits behind them', () => {
    const albums = [
      album('a', { genres: ['Jazz'] }),
      album('b', { genres: ['Jazz'] }),
      album('c', { genres: ['Jazz'] }),
      album('d', { genres: ['Rock'] }),
      album('e', { genres: ['Rock'] }),
    ]

    expect(browseTilesFor(albums, 'genre').map(t => [t.label, t.albumCount])).toEqual([
      ['Jazz', 3],
      ['Rock', 2],
    ])
  })

  it('breaks ties alphabetically rather than by catalogue order', () => {
    const albums = [
      album('a', { genres: ['Rock'] }),
      album('b', { genres: ['Rock'] }),
      album('c', { genres: ['Ambient'] }),
      album('d', { genres: ['Ambient'] }),
    ]

    expect(browseTilesFor(albums, 'genre').map(t => t.label)).toEqual(['Ambient', 'Rock'])
  })

  /**
   * A tag on one album is that album, not a category — and it is the long tail
   * of these that made the old alphabetical genre list unusable.
   */
  it('leaves out a tag with too little behind it', () => {
    const albums = [album('a', { genres: ['Jazz'] }), album('b', { genres: ['Axo-slaxen electronic music'] })]

    expect(browseTilesFor(albums, 'genre')).toEqual([])
    expect(MIN_ALBUMS_PER_TILE).toBe(2)
  })

  it('counts an album under every tag it carries', () => {
    const albums = [
      album('a', { genres: ['Jazz', 'Fusion'] }),
      album('b', { genres: ['Jazz', 'Fusion'] }),
    ]

    expect(browseTilesFor(albums, 'genre').map(t => t.label).sort()).toEqual(['Fusion', 'Jazz'])
  })

  it('shows a tag exactly as the library spells it', () => {
    const albums = [
      album('a', { genres: ['Axo-slaxen electronic music'] }),
      album('b', { genres: ['  Axo-slaxen electronic music  '] }),
    ]

    expect(browseTilesFor(albums, 'genre')).toMatchObject([
      { label: 'Axo-slaxen electronic music', albumCount: 2 },
    ])
  })

  it('takes art from the albums behind the tile, skipping those without', () => {
    const albums = [
      album('a', { genres: ['Jazz'] }),
      album('b', { genres: ['Jazz'], art: true }),
      album('c', { genres: ['Jazz'], art: true }),
    ]

    expect(browseTilesFor(albums, 'genre')[0].covers).toHaveLength(2)
  })

  /**
   * The rule the whole browse screen rests on: a library that carries no mood
   * tags is offered no moods, rather than a guess at them.
   */
  it('offers no moods for a library that is not mood-tagged', () => {
    const albums = [album('a', { genres: ['Jazz'] }), album('b', { genres: ['Jazz'] })]

    expect(browseTilesFor(albums, 'mood')).toEqual([])
  })

  it('offers moods where the files carry them', () => {
    const albums = [
      album('a', { moods: ['Melancholy'] }),
      album('b', { moods: ['Melancholy'] }),
    ]

    expect(browseTilesFor(albums, 'mood')).toMatchObject([{ label: 'Melancholy', albumCount: 2 }])
  })
})

describe('albumsForTile', () => {
  it('returns the albums the tile stands for', () => {
    const albums = [
      album('a', { genres: ['Jazz'] }),
      album('b', { genres: ['Rock'] }),
      album('c', { genres: ['Jazz', 'Rock'] }),
    ]

    expect(albumsForTile(albums, 'genre', 'Jazz').map(a => a.title)).toEqual(['a', 'c'])
  })

  it('matches a mood the same way', () => {
    const albums = [album('a', { moods: ['Calm'] }), album('b', { moods: ['Frantic'] })]

    expect(albumsForTile(albums, 'mood', 'Calm').map(a => a.title)).toEqual(['a'])
  })

  it('is empty for a tag nothing carries', () => {
    expect(albumsForTile([album('a', { genres: ['Jazz'] })], 'genre', 'Techno')).toEqual([])
  })
})

/**
 * Tags overlap heavily in a real library, and taking each tile's art from the
 * front of its own list gave "Hip Hop", "Trap" and "Pop Rap" the identical
 * four covers on screen.
 */
describe('telling tiles apart', () => {
  const overlapping = Array.from({ length: 20 }, (_, i) =>
    album(`a${i}`, { genres: ['Hip Hop', 'Trap', 'Pop Rap'], art: true })
  )

  it('gives overlapping tags different art', () => {
    const tiles = browseTilesFor(overlapping, 'genre')
    const fronts = tiles.map(t => (t.covers[0] as { coverArtId: string }).coverArtId)

    expect(new Set(fronts).size).toBe(tiles.length)
  })

  it('keeps a tag’s art stable across rebuilds', () => {
    const once = browseTilesFor(overlapping, 'genre')
    const twice = browseTilesFor(overlapping, 'genre')

    expect(twice).toEqual(once)
  })

  it('still shows what little art there is when a tag has few albums', () => {
    const few = [
      album('x', { genres: ['Ambient'], art: true }),
      album('y', { genres: ['Ambient'], art: true }),
    ]

    expect(browseTilesFor(few, 'genre')[0].covers).toHaveLength(2)
  })
})
