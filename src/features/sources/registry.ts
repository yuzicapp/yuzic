import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { QueryKeys } from '@/state/query/queryKeys'
import {
  resolveDeezerAlbum,
  resolveDeezerArtistByName,
  getDeezerAlbum,
  getDeezerArtist,
  getDeezerArtistAlbums,
  getDeezerArtistTopTracks,
  getDeezerRelatedArtists,
  searchDeezerArtists,
  searchDeezerAlbums,
} from '@/providers/integration/deezer'
import { selectEnabledSourcesFor } from '@/features/settings/sources/state';
import { currentMusicbrainzClient } from '@/providers/registry/musicbrainz'
import { mapAlbum as mapMbAlbum } from '@/providers/integration/musicbrainz/mapAlbum'
import { mapArtist as mapMbArtist } from '@/providers/integration/musicbrainz/mapArtist'
import { mapSong as mapMbSong } from '@/providers/integration/musicbrainz/mapSong'
import type { MbArtist, MbReleaseGroup } from '@/providers/integration/musicbrainz'
import type { Album } from '@/domain/entities/Album'
import type { ExternalIds } from '@/domain/identity/ExternalIds'
import type { Artist } from '@/domain/entities/Artist'
import type { Song } from '@/domain/entities/Song'
import type { AlbumDetail } from '@/domain/entities/Detail'
import { makeLocalId } from '@/domain/identity/LocalId'
import { integrationProvenance } from '@/domain/identity/Provenance'
import { artistCoverSubject, missingCover, type CoverSource } from '@/domain/entities/Cover'
import { buildCover } from '@/providers/registry/covers'
import { sourceColor } from '@/constants/design'
import type { AuthDescriptor, Health } from '@/providers/contracts/Provider'

export type SourceId = 'deezer' | 'musicbrainz'

export type SourceResolvedArtist = {
  source: SourceId
  id: string
  name: string
  coverUrl?: string
  /** What tells this one apart from a namesake, where the source says. */
  detail?: string
}

export type SourceResolvedAlbum = {
  source: SourceId
  id: string
  title: string
  artist: string
  coverUrl?: string
  year?: number
}

/** Which entity kinds a free-text search should ask a source for. */
type SourceSearchWants = {
  artists: boolean
  albums: boolean
}

/**
 * One source's contribution to a free-text search, already provenance-tagged
 * (`source`) so a caller never has to know which source it came from to
 * label it. `subtitle` is deliberately generic rather than "artist name" —
 * Deezer's is the album's artist, MusicBrainz's is a release year, and
 * neither is meaningful to the other.
 */
type SourceSearchArtist = {
  source: SourceId
  id: string
  name: string
  subtitle: string
  cover: CoverSource
  externalIds?: { deezerId?: string; mbid?: string }
}

type SourceSearchAlbum = {
  source: SourceId
  id: string
  title: string
  subtitle: string
  cover: CoverSource
  externalIds?: { deezerId?: string; artistDeezerId?: string; mbid?: string; upc?: string }
}

type SourceSearchResults = {
  artists: SourceSearchArtist[]
  albums: SourceSearchAlbum[]
}

/**
 * The bundle `fetchArtist` returns: the artist entity plus everything an
 * artist screen wants alongside it. Not a domain type — `Artist` itself
 * carries no `topTracks`/`similarArtists` fields, because those are
 * relations a caller asks for, not properties of the entity — so this is a
 * source-layer aggregate, the same shape as `AlbumDetail` plays for albums.
 */
type SourceArtistDetail = {
  artist: Artist
  topTracks: Song[]
  albums: Album[]
  singles: Album[]
  similarArtists: Artist[]
}

type SourceDefinition = {
  label: string
  auth: AuthDescriptor
  testConnection(config: unknown): Promise<Health>
  // Narrows the id back to the closed source-id
  // union so every existing consumer keyed on `SourceId` still compiles.
  id: SourceId
  color: string
  /**
   * Resolution is this registry's own job, not a broker capability:
   * ExternalResolutionProvider, useMatchedNavigation and the Home/Search
   * source headers call these directly, and nothing else resolves names.
   */
  resolveArtist(name: string): Promise<SourceResolvedArtist | null>
  /**
   * The best few matches for a name, best first, for the picker to offer
   * when the first one is the wrong artist. `resolveArtist` is the first of
   * these without the extra results.
   */
  resolveArtistCandidates(name: string, limit: number): Promise<SourceResolvedArtist[]>
  /** The id this source knows an artist by, from the ids a record carries. */
  artistIdOf(ids: ExternalIds): string | undefined
  resolveAlbum(artist: string, title: string): Promise<SourceResolvedAlbum | null>
  /** As `resolveArtistCandidates`, for an album. */
  resolveAlbumCandidates(artist: string, title: string, limit: number): Promise<SourceResolvedAlbum[]>
  fetchAlbum(id: string): Promise<AlbumDetail | null>
  fetchArtist(id: string, mbid?: string | null): Promise<SourceArtistDetail | null>
  fetchArtistAlbums(artistId: string, limit: number, artistName?: string): Promise<Album[]>
  /**
   * Free-text search, for Search's "Other sources" scope. The only place a
   * search feature should ever name a source: it iterates `ALL_SOURCES` and
   * calls this generically, rather than branching on which source it is.
   */
  search(query: string, wants: SourceSearchWants): Promise<SourceSearchResults>
}

/**
 * Both sources are keyless public APIs — no credentials, no server URL, no
 * account. `'none'` still leaks query contents to the provider,
 * so it isn't "no auth model", just the weakest tier.
 */
const noAuth = { tier: 'none' as const }

/**
 * There is nothing to authenticate for a keyless public source — it is
 * reachable by construction. "Enabled" is a plain user setting
 * (the source's search switch in `settingsSources`), not a
 * connection, so this deliberately does not perform a network ping.
 */
const trivialTestConnection = async (): Promise<Health> => ({ ok: true })


function urlFromCover(cover: CoverSource): string | undefined {
  return cover.kind === 'url' ? cover.url : undefined
}

/**
 * A stand-in `Artist` for `getDeezerArtistAlbums`' fallback parameter, built
 * from just the id/name a caller already has (an artist screen navigated to
 * before the full artist has been fetched). Only ever used to fill in an
 * album's artist reference when Deezer's albums-by-artist endpoint omits the
 * embedded artist object — never returned to a caller as a real artist.
 */
function stubDeezerArtist(artistId: string, artistName: string): Artist {
  const provenance = integrationProvenance('deezer')
  return {
    localId: makeLocalId('artist', provenance, artistId),
    nativeId: artistId,
    provenance,
    externalIds: artistId ? { deezerId: artistId } : {},
    name: artistName,
    cover: missingCover(artistCoverSubject(artistName)),
    tags: [],
    albumIds: [],
  }
}

const deezerSource: SourceDefinition = {
  id: 'deezer',
  artistIdOf: ids => ids.deezerId,
  label: 'Deezer',
  color: sourceColor.deezer,
  auth: noAuth,
  testConnection: trivialTestConnection,
  // Deezer resolves names to its own ids (resolveArtist/resolveAlbum) and
  // backs browsing things the library doesn't have: external album and artist
  // screens and search results. Home's Deezer shelves fetch on their own.

  async resolveArtist(name) {
    const artist = await resolveDeezerArtistByName(name)
    if (!artist) return null
    return { source: 'deezer', id: artist.nativeId, name: artist.name, coverUrl: urlFromCover(artist.cover) }
  },

  async resolveArtistCandidates(name, limit) {
    const artists = await searchDeezerArtists(name, limit)
    return artists.map(artist => ({
      source: 'deezer',
      id: artist.nativeId,
      name: artist.name,
      coverUrl: urlFromCover(artist.cover),
    }))
  },

  async resolveAlbum(artist, title) {
    const album = await resolveDeezerAlbum(artist, title)
    if (!album) return null
    return { source: 'deezer', id: album.nativeId, title: album.title, artist: album.artist.name, coverUrl: urlFromCover(album.cover) }
  },

  async resolveAlbumCandidates(artist, title, limit) {
    // The precise query first, as `resolveAlbum` does, then the loose one to
    // make up the numbers: the precise one misses on any spelling difference.
    const precise = await searchDeezerAlbums(`artist:"${artist}" album:"${title}"`, limit)
    const loose = precise.length < limit ? await searchDeezerAlbums(`${artist} ${title}`, limit) : []
    const seen = new Set<string>()
    return [...precise, ...loose]
      .filter(album => !seen.has(album.nativeId) && Boolean(seen.add(album.nativeId)))
      .slice(0, limit)
      .map(album => ({
        source: 'deezer' as const,
        id: album.nativeId,
        title: album.title,
        artist: album.artist.name,
        coverUrl: urlFromCover(album.cover),
        year: album.year,
      }))
  },

  async fetchAlbum(id) {
    return getDeezerAlbum(id)
  },

  async fetchArtistAlbums(artistId, limit, artistName) {
    const fallback = artistName ? stubDeezerArtist(artistId, artistName) : null
    return getDeezerArtistAlbums(artistId, limit, fallback)
  },

  async fetchArtist(id, mbid) {
    const base = await getDeezerArtist(id)
    if (!base) return null
    const [albums, topTracks, similarArtists] = await Promise.all([
      getDeezerArtistAlbums(id, 80, base),
      getDeezerArtistTopTracks(id, 10),
      getDeezerRelatedArtists(id, 8),
    ])
    const resolvedMbid = mbid ?? base.externalIds.mbid
    return {
      artist: {
        ...base,
        externalIds: resolvedMbid ? { ...base.externalIds, mbid: resolvedMbid } : base.externalIds,
      },
      topTracks,
      albums: albums.filter(a => a.releaseType !== 'single'),
      singles: albums.filter(a => a.releaseType === 'single'),
      similarArtists,
    }
  },

  async search(query, wants) {
    const [artists, albums] = await Promise.all([
      wants.artists ? searchDeezerArtists(query, 4) : Promise.resolve([]),
      wants.albums ? searchDeezerAlbums(query, 6) : Promise.resolve([]),
    ])
    return {
      artists: artists.map(artist => ({
        source: 'deezer',
        id: artist.nativeId,
        name: artist.name,
        subtitle: '',
        cover: artist.cover,
        externalIds: { deezerId: artist.externalIds.deezerId },
      })),
      albums: albums.map(album => ({
        source: 'deezer',
        id: album.nativeId,
        title: album.title,
        subtitle: album.artist.name,
        cover: album.cover,
        externalIds: {
          deezerId: album.externalIds.deezerId,
          artistDeezerId: album.artist.externalIds.deezerId,
          upc: album.externalIds.upc,
        },
      })),
    }
  },
}

const MB_PROVENANCE = integrationProvenance('musicbrainz')

/**
 * An artist's release groups, credited to that artist.
 *
 * The artist lookup's release groups come back with no `artist-credit`, so
 * every album on a MusicBrainz artist page was by "Unknown Artist" with no id,
 * and opening one searched for it under that name. The page knows whose
 * albums these are; it says so.
 */
function creditedTo(artist: MbArtist): MbReleaseGroup[] {
  return (artist['release-groups'] ?? []).map(rg => (
    rg['artist-credit']?.length
      ? rg
      : { ...rg, 'artist-credit': [{ name: artist.name, artist: { id: artist.id, name: artist.name } }] }
  ))
}

const musicbrainzSource: SourceDefinition = {
  id: 'musicbrainz',
  artistIdOf: ids => ids.mbid,
  label: 'MusicBrainz',
  color: sourceColor.musicbrainz,
  auth: noAuth,
  testConnection: trivialTestConnection,
  // MusicBrainz resolves names to canonical ids (resolveArtist/resolveAlbum)
  // and backs browsing things the library doesn't have: external album and
  // artist screens and search results. It has no Home shelf.

  async resolveArtist(name) {
    const results = await currentMusicbrainzClient().searchArtist(name, 5)
    const best = results[0]
    if (!best) return null
    const artist = mapMbArtist(best, MB_PROVENANCE)
    return { source: 'musicbrainz', id: artist.nativeId, name: artist.name }
  },

  async resolveArtistCandidates(name, limit) {
    const results = await currentMusicbrainzClient().searchArtist(name, limit)
    return results.map(dto => {
      const artist = mapMbArtist(dto, MB_PROVENANCE)
      return { source: 'musicbrainz', id: artist.nativeId, name: artist.name, detail: dto.disambiguation || undefined }
    })
  },

  async resolveAlbumCandidates(artist, title, limit) {
    const results = await currentMusicbrainzClient().searchReleaseGroup(artist, title, limit)
    return results.map(rg => {
      const album = mapMbAlbum(rg, { provenance: MB_PROVENANCE })
      return {
        source: 'musicbrainz',
        id: album.nativeId,
        title: album.title,
        // The credit on the match, not the name that was asked about: two
        // candidates by different artists are the case the picker is for.
        artist: rg['artist-credit']?.length ? album.artist.name : artist,
        coverUrl: buildCover(album.cover, 'grid') ?? undefined,
        year: album.year,
      }
    })
  },

  async resolveAlbum(artist, title) {
    const results = await currentMusicbrainzClient().searchReleaseGroup(artist, title, 5)
    const best = results[0]
    if (!best) return null
    const album = mapMbAlbum(best, { provenance: MB_PROVENANCE })
    return {
      source: 'musicbrainz',
      id: album.nativeId,
      title: album.title,
      artist,
      coverUrl: buildCover(album.cover, 'grid') ?? undefined,
    }
  },

  async fetchAlbum(id) {
    const [rg, tracks] = await Promise.all([
      currentMusicbrainzClient().getReleaseGroup(id),
      currentMusicbrainzClient().getTracksForReleaseGroup(id),
    ])
    const songs = tracks.map(track => mapMbSong(track, { provenance: MB_PROVENANCE, releaseGroup: rg }))
    const album = mapMbAlbum(rg, { provenance: MB_PROVENANCE, songIds: songs.map(s => s.localId) })
    return { album, songs }
  },

  async fetchArtistAlbums(artistId, limit) {
    const artist = await currentMusicbrainzClient().getArtistWithReleases(artistId)
    const rgs = creditedTo(artist)
    return rgs.slice(0, limit).map(rg => mapMbAlbum(rg, { provenance: MB_PROVENANCE }))
  },

  async fetchArtist(id) {
    const dto = await currentMusicbrainzClient().getArtistWithReleases(id)
    const rgs = creditedTo(dto)
    const albums = rgs
      .filter(rg => !rg['primary-type'] || rg['primary-type'] === 'Album')
      .map(rg => mapMbAlbum(rg, { provenance: MB_PROVENANCE }))
    const singles = rgs
      .filter(rg => rg['primary-type'] === 'Single' || rg['primary-type'] === 'EP')
      .map(rg => mapMbAlbum(rg, { provenance: MB_PROVENANCE }))
    return {
      artist: mapMbArtist(dto, MB_PROVENANCE),
      topTracks: [],
      albums,
      singles,
      similarArtists: [],
    }
  },

  async search(query, wants) {
    const [artists, releaseGroups] = await Promise.all([
      wants.artists ? currentMusicbrainzClient().searchArtist(query, 4) : Promise.resolve([]),
      wants.albums ? currentMusicbrainzClient().searchReleaseGroupByTitle(query, 6) : Promise.resolve([]),
    ])
    return {
      artists: artists.map(artist => ({
        source: 'musicbrainz',
        id: artist.id,
        name: artist.name,
        subtitle: '',
        cover: missingCover(artistCoverSubject(artist.name, { mbid: artist.id })),
      })),
      albums: releaseGroups.map(rg => ({
        source: 'musicbrainz',
        id: rg.id,
        title: rg.title,
        subtitle: rg['first-release-date']?.slice(0, 4) ?? '',
        cover: { kind: 'coverartarchive', mbid: rg.id, mbidType: 'release-group' },
        externalIds: { mbid: rg.id },
      })),
    }
  },
}

export const ALL_SOURCES: SourceDefinition[] = [deezerSource, musicbrainzSource]

export function getSourceMeta(id: string): Pick<SourceDefinition, 'label' | 'color'> | null {
  return ALL_SOURCES.find(s => s.id === id) ?? null
}

export function useEnabledExternalSources(): SourceDefinition[] {
  const enabled = useSelector(selectEnabledSourcesFor('search'))
  return ALL_SOURCES.filter(s => enabled.includes(s.id))
}

type ExternalArtistLookupInput = { enabled: boolean; source?: string; artistId: string | null; mbid: string | null; name: string | null }

/** Resolves one external artist: direct source+id, then mbid (MusicBrainz,
 *  if enabled), then a name search (Deezer, if enabled) — the artist
 *  screen's identity fallback chain, kept here so naming a source by id
 *  stays inside this registry. */
export function useExternalArtistLookup(input: ExternalArtistLookupInput) {
  const { enabled, source, artistId, mbid, name } = input
  const enabledSearch = useSelector(selectEnabledSourcesFor('search'))
  const musicbrainzEnabled = enabledSearch.includes('musicbrainz')
  const deezerEnabled = enabledSearch.includes('deezer')

  return useQuery({
    queryKey: [QueryKeys.ExternalArtist, source ?? 'unknown', artistId ?? mbid ?? name ?? ''],
    enabled,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<SourceArtistDetail | null> => {
      const sourceDef = ALL_SOURCES.find(s => s.id === source)
      if (sourceDef && artistId) return sourceDef.fetchArtist(artistId, mbid)

      if (mbid && musicbrainzEnabled) {
        const mb = ALL_SOURCES.find(s => s.id === 'musicbrainz')
        if (mb) return mb.fetchArtist(mbid, mbid)
      }

      if (name && deezerEnabled) {
        const deezer = ALL_SOURCES.find(s => s.id === 'deezer')
        if (deezer) {
          const resolved = await deezer.resolveArtist(name)
          if (resolved) return deezer.fetchArtist(resolved.id, mbid)
        }
      }

      throw new Error(`Unable to resolve artist "${name ?? artistId ?? 'unknown'}"`)
    },
  })
}
