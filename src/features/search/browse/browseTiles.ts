import type { Album } from '@/domain/entities/Album'
import type { CoverSource } from '@/domain/entities/Cover'
import { coversOf } from '@/features/library/mosaicCovers'

/**
 * What the Search screen offers when nothing has been typed.
 *
 * The tab used to open on an empty black screen for anyone who had not
 * searched before, and force the keyboard over it. Now it opens on ways in.
 *
 * Both kinds of tile are the library describing *itself*. A genre tile is the
 * tags the files carry; a mood tile is the mood tags they carry, which
 * OpenSubsonic reports and we had never read. Neither is inferred, and that is
 * the whole design rule here: no tile exists unless something told us it
 * should. A library with no mood tags is offered no moods rather than being
 * offered a guess at them.
 */

export type BrowseTileKind = 'genre' | 'mood'

export type BrowseTile = {
  /** Stable across renders and unique across both kinds. */
  key: string
  kind: BrowseTileKind
  /** The tag itself, shown as the library spells it. */
  label: string
  albumCount: number
  /** Art for the tile, for `CoverMosaic`; may be fewer than four, or none. */
  covers: CoverSource[]
}

/**
 * A tag needs this many albums behind it to earn a tile.
 *
 * One album is not a category, it is that album — and a big library's tag list
 * has a long tail of them, which is what made the existing genre list open on
 * an alphabetical wall. The tail stays reachable: the genre screen lists
 * everything, and this only decides what is worth a tile up front.
 */
export const MIN_ALBUMS_PER_TILE = 2

/** How many tiles of one kind to offer before the rest become "see all". */
export const MAX_TILES_PER_KIND = 12

const tagsOf = (album: Album, kind: BrowseTileKind): string[] =>
  (kind === 'genre' ? album.genres : album.moods) ?? []

/**
 * Tiles for one kind of tag, largest first.
 *
 * Ranked by how much of the library sits behind each, not alphabetically. A
 * browse screen is picked from by eye, so the tags worth seeing are the ones
 * with records behind them; the alphabet puts "Acid Jazz" first for no better
 * reason than its spelling.
 *
 * Ties break alphabetically, so the order is stable when two tags are level
 * rather than depending on which album the catalogue happened to list first.
 */
export function browseTilesFor(albums: readonly Album[], kind: BrowseTileKind): BrowseTile[] {
  const byTag = new Map<string, Album[]>()

  for (const album of albums) {
    for (const tag of tagsOf(album, kind)) {
      const label = tag.trim()
      if (!label) continue
      const existing = byTag.get(label)
      if (existing) existing.push(album)
      else byTag.set(label, [album])
    }
  }

  return [...byTag.entries()]
    .filter(([, tagged]) => tagged.length >= MIN_ALBUMS_PER_TILE)
    .map(([label, tagged]) => ({
      key: `${kind}:${label}`,
      kind,
      label,
      albumCount: tagged.length,
      covers: coversOf(tagged),
    }))
    .sort((a, b) => b.albumCount - a.albumCount || a.label.localeCompare(b.label))
}

/** The albums a tile stands for, which is what its screen lists. */
export function albumsForTile(
  albums: readonly Album[],
  kind: BrowseTileKind,
  label: string
): Album[] {
  return albums.filter(album => tagsOf(album, kind).some(tag => tag.trim() === label))
}
