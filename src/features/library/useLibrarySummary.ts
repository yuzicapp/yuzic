import { useMemo } from 'react'
import { useSelector } from 'react-redux'

import { useAlbums } from '@/features/album/useAlbums'
import { useArtists } from '@/features/artist/useArtists'
import { usePlaylists } from '@/features/playlist/usePlaylists'
import { useTracks } from '@/features/song/useTracks'
import { useDownload } from '@/features/offline/DownloadContext'
import { useGenres } from '@/features/genre/useGenres'
import { selectWantCountForActiveServer, selectWantsForActiveServer } from '@/state/redux/selectors/wantsSelectors'
import { buildGenreRows } from '@/features/genre/genreList'
import type { CoverSource } from '@/domain/entities/Cover'

export type LibraryEntryKey =
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'tracks'
  | 'genres'
  | 'downloaded'
  | 'downloads'
  | 'wants'
  | 'radio'
  | 'podcasts'
  | 'shares'

type LibraryEntrySummary = {
  /** How much sits behind the entry point. */
  count?: number
  /** Art for the row, most-representative first. Fewer than `MOSAIC_COVERS`
   * where the library doesn't have that many with art on them. */
  covers: CoverSource[]
}

/** A mosaic is four covers or it is one — three-quarters of a grid reads as a
 * loading state rather than a design. */
export const MOSAIC_COVERS = 4

/**
 * Whether a cover will actually resolve to a picture.
 *
 * A letter tile or an empty cover is the fallback the row already has, drawn
 * smaller and four times over, so it is worth nothing here.
 */
function hasArt(cover: CoverSource | undefined): cover is CoverSource {
  return !!cover && cover.kind !== 'none'
}

function coversOf(items: { cover: CoverSource }[]): CoverSource[] {
  const covers: CoverSource[] = []
  for (const item of items) {
    if (!hasArt(item.cover)) continue
    covers.push(item.cover)
    if (covers.length === MOSAIC_COVERS) break
  }
  return covers
}

/**
 * What each library entry point holds, and what it looks like.
 *
 * The index used to be seven identical grey icon wells over a screen of empty
 * black, which said nothing about the library behind them — the same screen
 * whether you owned four albums or six hundred. The counts and the covers are
 * the part that is actually about *your* library, so both are read here, from
 * one place, off the data the rows already needed.
 */
export function useLibrarySummary(): Record<LibraryEntryKey, LibraryEntrySummary> {
  const { albums } = useAlbums()
  const { artists } = useArtists()
  const { playlists } = usePlaylists()
  const { tracks } = useTracks()
  const { getAllDownloadedCollections } = useDownload()
  const { genres } = useGenres()
  const wantCount = useSelector(selectWantCountForActiveServer)
  const wants = useSelector(selectWantsForActiveServer)

  return useMemo(() => {
    const genreRows = buildGenreRows(genres, albums)

    // One album per genre, in the order the genres screen lists them, so the
    // row's art is the art of the screen it opens.
    const genreCovers: CoverSource[] = []
    for (const row of genreRows) {
      const album = albums.find(
        a => a.genres?.includes(row.genre) && hasArt(a.cover)
      )
      if (album) genreCovers.push(album.cover)
      if (genreCovers.length === MOSAIC_COVERS) break
    }

    // Counted the way the downloaded screen builds its list, so the number on
    // the row matches what opening it shows — a collection whose album has
    // since left the library is not on that screen either.
    // `downloadedIds` is the id `downloadAlbumById`/`downloadPlaylistById`
    // were called with, which they hand straight to `api.albums.get`/
    // `api.playlists.get` — i.e. `nativeId`.
    const downloadedIds = new Set(getAllDownloadedCollections().map(c => c.id))
    const downloaded = [
      ...albums.filter(a => downloadedIds.has(a.nativeId)),
      ...playlists.filter(p => downloadedIds.has(p.nativeId)),
    ]

    // Deduped by album, or four songs off one record give four copies of the
    // same square. Equality between loaded entities, so `localId`.
    const seenAlbums = new Set<string>()
    const trackCovers: CoverSource[] = []
    for (const track of tracks) {
      const key = track.album.localId || track.localId
      if (seenAlbums.has(key) || !hasArt(track.cover)) continue
      seenAlbums.add(key)
      trackCovers.push(track.cover)
      if (trackCovers.length === MOSAIC_COVERS) break
    }

    return {
      playlists: { count: playlists.length, covers: coversOf(playlists) },
      albums: { count: albums.length, covers: coversOf(albums) },
      artists: { count: artists.length, covers: coversOf(artists) },
      tracks: { count: tracks.length, covers: trackCovers },
      genres: { count: genreRows.length, covers: genreCovers },
      downloaded: { count: downloaded.length, covers: coversOf(downloaded) },
      // The unified Downloads screen (offline + connected downloaders) has
      // no single count worth summarizing here — it's two different kinds
      // of activity, not one collection size — so it goes uncounted, same
      // as Radio below.
      downloads: { count: undefined, covers: [] },
      // A wishlist of things no server has — but each want saves the cover
      // its source gave it, or the gap naming who it is of, so the row's
      // mosaic resolves through the same picture rule as every other row
      // here. It showed no art at all while wants stored no cover.
      wants: { count: wantCount, covers: coversOf(wants.filter(w => !!w.cover).map(w => ({ cover: w.cover! }))) },
      // Radio has no count summary here — the list lives on the server, and
      // fetching it just to say "3 stations" on a row people don't click yet
      // isn't worth the request. The screen itself fetches on open.
      radio: { count: undefined, covers: [] },
      podcasts: { count: undefined, covers: [] },
      shares: { count: undefined, covers: [] },
    }
  }, [albums, artists, playlists, tracks, genres, getAllDownloadedCollections, wantCount, wants])
}
