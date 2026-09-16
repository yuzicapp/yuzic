import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useAlbums } from '@/features/album/useAlbums';
import { useArtists } from '@/features/artist/useArtists';
import { useIsOffline } from '@/features/connectivity/useIsOffline'
import { selectArtistPlayCounts } from '@/state/redux/selectors/statsSelectors'
import { useGenres } from '@/features/genre/useGenres'
import { HOME_SOURCE_TIERS } from '@/providers/registry/homeDiscovery'
import type { SourceId } from '@/providers/registry/sources'
import { presentableGenres } from '../genres'
import {
  buildLibrarySections,
  buildResumeSections,
  type SectionConfig,
} from '../homeLayout'

const BECAUSE_SEED_COUNT = 1
const BECAUSE_SEED_POOL_SIZE = 20
/** How many seeds the similar-artists shelf may try before it gives up. */
const SIMILAR_SEED_COUNT = 4
const GENRE_COUNT = 1

/** Cannot occur in an artist name, so joining and splitting round-trips. */
const SEED_KEY_SEPARATOR = '\u0000'
const splitSeedKey = (key: string): string[] => (key ? key.split(SEED_KEY_SEPARATOR) : [])

export function getDayKey(date = new Date()): string {
  return date.toDateString()
}

function dateToSeed(dateStr: string): number {
  let hash = 0
  for (const c of dateStr) hash = Math.imul(31, hash) + c.charCodeAt(0) | 0
  return Math.abs(hash)
}

export function getDailySeed(dayKey = getDayKey()): number {
  return dateToSeed(dayKey)
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = Math.imul(seed | 0, 0x9e3779b9) | 0 || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}


type HomeLayout = {
  /** What you were listening to. First, unlabelled. */
  resume: SectionConfig[]
  /** Your own collection, behind its own header. */
  library: SectionConfig[]
  /** Server-native discovery (random shelves, now-playing) — behind the
   * server source header. Independent of every outside source. */
  server: SectionConfig[]
  /** Each outside tier's shelves, by the source that fills it
   * (`HOME_SOURCE_TIERS`), each behind that source's header. */
  sources: Partial<Record<SourceId, SectionConfig[]>>
  isOffline: boolean
}

export function useDailyLayout(refreshKey = 0): HomeLayout {
  const isOffline = useIsOffline()
  const { albums: libraryAlbums } = useAlbums()
  const { artists: libraryArtists } = useArtists()
  const artistPlayCounts = useSelector(selectArtistPlayCounts)
  const { genres: libraryGenres } = useGenres()
  const dayKey = getDayKey()
  const dailySeed = getDailySeed(`${dayKey}:${refreshKey}`)

  const artistSeedPool = useMemo(() => {
    return seededShuffle(
      [...libraryArtists]
        .filter(a => a.name.trim() && a.name.toLowerCase() !== 'various artists')
        .sort((a, b) => (artistPlayCounts[b.nativeId] ?? 0) - (artistPlayCounts[a.nativeId] ?? 0))
        .slice(0, BECAUSE_SEED_POOL_SIZE),
      dailySeed
    )
  }, [dailySeed, libraryArtists, artistPlayCounts])

  // Kept by value, not by identity. The pool is re-sorted on every play-count
  // change — once per track change, from the scrobble — and almost never
  // changes which names are at the top. Rebuilt as new arrays anyway, they
  // changed `sources` and so re-rendered every shelf on Home at the end of
  // every song. The key only moves when the names do.
  const becauseKey = artistSeedPool.slice(0, BECAUSE_SEED_COUNT).map(a => a.name).join(SEED_KEY_SEPARATOR)
  const becauseSeeds = useMemo(() => splitSeedKey(becauseKey), [becauseKey])

  // Same pool, same order, so the first seed matches the "More like" shelf's.
  const similarKey = artistSeedPool.slice(0, SIMILAR_SEED_COUNT).map(a => a.name).join(SEED_KEY_SEPARATOR)
  const similarSeeds = useMemo(() => splitSeedKey(similarKey), [similarKey])

  const availableGenres = useMemo(() => {
    const genres: string[] = [...libraryGenres]
    // Supplement from album tags, but cap at 500 albums — scanning all 9000 for
    // a handful of genre seeds isn't worth it when the server genre list covers most cases.
    const scanLimit = Math.min(libraryAlbums.length, 500)
    for (let i = 0; i < scanLimit; i++) {
      const albumGenres = libraryAlbums[i].genres
      if (albumGenres) genres.push(...albumGenres)
    }
    // Placeholder tags ("Unknown", "Other") are the biggest bucket in most
    // libraries, so a shuffle picks them far more often than a real genre —
    // and "More Unknown" is not a shelf anybody wants.
    return presentableGenres(genres)
  }, [libraryAlbums, libraryGenres])

  // By value for the same reason as the seeds above: `sources` depends on it,
  // and a fresh `[]` for "no genres" is a new identity on every recompute.
  const genreKey = availableGenres.length
    ? seededShuffle(availableGenres, dailySeed).slice(0, GENRE_COUNT).join(SEED_KEY_SEPARATOR)
    : ''
  const topGenres = useMemo(() => splitSeedKey(genreKey), [genreKey])

  const hasLibrary = libraryArtists.length > 0 || libraryAlbums.length > 0

  const resume = useMemo(() => buildResumeSections(), [])

  const library = useMemo(() => buildLibrarySections(hasLibrary), [hasLibrary])

  // Server-native tier — cheap, always-on when a library exists. Random
  // shelves keep Home changing day-to-day even for users with no outside
  // discovery configured; now-playing is opt-in visible when it has data.
  const server = useMemo<SectionConfig[]>(() => {
    if (isOffline || !hasLibrary) return []
    return [
      { key: 'serverRandom', type: 'serverRandom' },
      { key: 'serverNowPlaying', type: 'serverNowPlaying' },
      // Local-first daily mix: play-stats seed + server-native similarity,
      // zero external calls — so it lives in the server tier alongside the
      // other always-on shelves rather than behind an outside source's switch.
      { key: 'localMix', type: 'localMix' },
    ]
  }, [isOffline, hasLibrary])

  // Every outside tier builds its shelves from the same seeds; a catalogue
  // tier is reshuffled daily so its feed changes.
  const sources = useMemo(() => {
    const seeds = { isOffline, hasLibrary: libraryArtists.length > 0, becauseSeeds, similarSeeds, topGenres }
    const bySource: Partial<Record<SourceId, SectionConfig[]>> = {}
    for (const tier of HOME_SOURCE_TIERS) {
      const shelves = tier.build(seeds)
      bySource[tier.source] = tier.shuffleDaily ? seededShuffle(shelves, dailySeed) : shelves
    }
    return bySource
  }, [dailySeed, isOffline, libraryArtists.length, becauseSeeds, similarSeeds, topGenres])

  return useMemo(
    () => ({ resume, library, server, sources, isOffline }),
    [resume, library, server, sources, isOffline]
  )
}
