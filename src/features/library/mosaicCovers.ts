import type { CoverSource } from '@/domain/entities/Cover'

/**
 * How a collection of things gets a face.
 *
 * Extracted from `useLibrarySummary`, which had it privately, because the
 * Search screen's browse tiles need the same answer and a second copy of the
 * rule would drift from this one. `CoverMosaic` reads the count from here too,
 * rather than from a hook it has no other business importing.
 */

/** A mosaic is four covers or it is one — three-quarters of a grid reads as a
 *  loading state rather than a design. */
export const MOSAIC_COVERS = 4

/**
 * Whether a cover will actually resolve to a picture.
 *
 * A letter tile or an empty cover is the fallback the tile already has, drawn
 * smaller and four times over, so it is worth nothing here.
 */
export function hasArt(cover: CoverSource | undefined): cover is CoverSource {
  return !!cover && cover.kind !== 'none'
}

/** The first few covers with real art on them, in the order given. */
export function coversOf(items: { cover: CoverSource }[]): CoverSource[] {
  const covers: CoverSource[] = []
  for (const item of items) {
    if (!hasArt(item.cover)) continue
    covers.push(item.cover)
    if (covers.length === MOSAIC_COVERS) break
  }
  return covers
}
