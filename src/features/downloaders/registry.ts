import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import type { Href } from 'expo-router'
import * as lidarr from '@/providers/integration/lidarr'
import * as slskd from '@/providers/integration/slskd'
import * as soulsync from '@/providers/integration/soulsync'
import type { SlskdSearchPreferences } from '@/providers/integration/slskd'
import type { DownloaderId } from '@/state/redux/slices/downloadersSlice'
import type { LidarrConfig } from '@/providers/integration/lidarr/config'
import type { Album } from '@/domain/entities/Album'
import { selectDownloadersForActiveServer, downloaderCredentialScope } from '@/state/redux/selectors/downloadersSelectors'
import { selectActiveServerId, selectCredentialsHydrated } from '@/state/redux/selectors/serversSelectors'
import { getCredentials } from '@/state/credentialCache'
import type { AuthDescriptor, Health } from '@/providers/contracts/Provider'
import type { DownloaderQueueItem } from './queueItem'

export { downloadErrorKey } from './errorKeys'

export type { DownloaderId }

/**
 * Common shape every downloader accepts. `preferences` is optional and
 * downloader-specific — slskd reads its own search settings from it, other
 * downloaders ignore it. Kept untyped at this layer so a new downloader with
 * its own preferences shape doesn't have to widen this file.
 */
type DownloaderConfig = {
  serverUrl: string
  apiKey: string
  preferences?: Record<string, unknown>
}

type DownloadResult =
  | { success: true }
  | { success: false; code?: string; message: string }

/**
 * Per-call knobs a downloader may honor for one Get, without changing any
 * saved default. Only Lidarr album downloads currently read
 * `qualityProfileId` — every other downloader ignores this bag entirely.
 */
type DownloadOptions = {
  qualityProfileId?: number
}

/** One of a downloader's named quality settings, chosen by id per Get. */
export type QualityProfile = { id: number; name: string }

/**
 * The whole browsed album, not just its title and artist: Lidarr resolves the
 * release by MBID/Deezer id where available, and collapsing it to two strings
 * here would put it back on fuzzy name matching.
 */
type AlbumDownloadRequest = Album
type TrackDownloadRequest = { title: string; artist: string }
/**
 * An artist to follow, rather than a release to fetch. The MBID is what
 * actually identifies them where the catalogue supplied one; the name is the
 * fallback and the thing a lookup is spelled with.
 */
type ArtistMonitorRequest = { name: string; mbid?: string }

/**
 * What a downloader is and what it can do — the one place either is declared.
 *
 * Acquisition is not a broker capability. It was declared as one once, as a
 * thinner copy of the methods below that nothing called: it could carry no
 * per-call options (Lidarr's quality profile), no error codes, and no queue.
 * Every download flow — the Get sheet, the auto-downloader, batch requests —
 * calls these definitions directly.
 */
type DownloaderDefinition = {
  label: string
  auth: AuthDescriptor
  testConnection(config: unknown): Promise<Health>
  // Narrows the id back to the closed downloader-id
  // union so every existing consumer keyed on `DownloaderId` still compiles.
  id: DownloaderId
  descriptionKey: string
  albumAddedKey: string
  trackAddedKey?: string
  /** Confirms an artist is now followed. Present exactly when `monitorArtist` is. */
  artistMonitoredKey?: string
  settingsRoute: Href
  /**
   * Both units are optional, because a downloader gets to have a natural one.
   * Lidarr is album-oriented and can't fetch a single file; SoulSync's request
   * pipeline is track-oriented and has no album endpoint at all; slskd does
   * both. Callers presence-check the unit they need rather than assuming an
   * album is always on offer — `downloadAlbum` used to be required, which was
   * Lidarr's shape written into the contract for everyone.
   */
  downloadAlbum?(config: DownloaderConfig, req: AlbumDownloadRequest, options?: DownloadOptions): Promise<DownloadResult>
  downloadTrack?(config: DownloaderConfig, req: TrackDownloadRequest): Promise<DownloadResult>
  /**
   * Follow an artist, so what they release from now on is picked up.
   *
   * A third unit alongside the two above, and optional for the same reason:
   * only a collection manager has any concept of an artist it watches. A
   * transfer tool fetches a named file and has nothing to be told about a
   * person, which is why an artist want with none of these connected stays a
   * bookmark rather than showing a Get that would do nothing.
   */
  monitorArtist?(config: DownloaderConfig, req: ArtistMonitorRequest): Promise<DownloadResult>
  /**
   * The quality profiles an album Get can pick from, passed back as
   * `options.qualityProfileId`. Absent where a downloader has no such setting,
   * which is how the Get sheet knows not to offer one.
   */
  getQualityProfiles?(config: DownloaderConfig): Promise<QualityProfile[]>
  /**
   * Read the transfer queue, in the one shape every surface understands.
   *
   * Normalising here rather than at each reader is the point. This used to
   * returned the downloader's own records, typed
   * `T extends { id: string }` and reached through two `as any` casts — so
   * everything downstream either knew all three record shapes or knew none of
   * them, and the surfaces that needed detail chose the former.
   *
   * Diffing moved out with the types: comparing two reads by id needs nothing
   * downloader-specific, and it was being done three times, once per record
   * shape. See `finishedSince`.
   *
   * Downloader-operational, not a product capability: it is how a downloader
   * reports progress on units it already fills, not a unit of its own — nobody
   * asks "who can poll a queue".
   */
  fetchQueue(config: DownloaderConfig): Promise<DownloaderQueueItem[]>
  /**
   * Stop a queued transfer. Absent where the downloader offers no way to.
   *
   * Takes the normalised item rather than the downloader's own record, and
   * reads `transferIds` and `peer` back out of it — which is all any of the
   * three needed. Before this, cancelling was wired up at the screen, inside a
   * three-way `if (id === ...)` that also chose the fetch and the row renderer;
   * a fourth downloader meant a fourth branch in a file about layout.
   */
  cancelQueueItem?(config: DownloaderConfig, item: DownloaderQueueItem): Promise<void>
}

/** All three downloaders authenticate the same way: a server URL plus an API key. */
const apiKeyAuth = { tier: 'apiKey' as const, configKeys: ['serverUrl', 'apiKey'] }

function lidarrConfigOf(config: DownloaderConfig): LidarrConfig {
  return { serverUrl: config.serverUrl, apiKey: config.apiKey }
}

const lidarrDownloadAlbum = (
  config: DownloaderConfig,
  album: AlbumDownloadRequest,
  options?: DownloadOptions
) =>
  lidarr.downloadAlbum(config, lidarr.albumRequestFromExternal(album), {
    qualityProfileId: options?.qualityProfileId,
  })

const lidarrMonitorArtist = async (
  config: DownloaderConfig,
  req: ArtistMonitorRequest
): Promise<DownloadResult> => {
  const result = await lidarr.monitorArtist(lidarrConfigOf(config), req)
  return result.success ? { success: true } : { success: false, code: result.code, message: result.message }
}

const lidarrDownloader: DownloaderDefinition = {
  id: 'lidarr',
  label: 'Lidarr',
  descriptionKey: 'externalAlbum.download.lidarrDesc',
  albumAddedKey: 'externalAlbum.download.addedToLidarr',
  artistMonitoredKey: 'externalAlbum.download.monitoringOnLidarr',
  settingsRoute: '/settings/lidarrView',
  auth: apiKeyAuth,
  // Lidarr is album-only — no `downloadTrack`.
  downloadAlbum: lidarrDownloadAlbum,
  // ...and the only one that follows an artist: it is a collection manager,
  // where the other two are transfer tools with nobody to watch.
  monitorArtist: lidarrMonitorArtist,
  getQualityProfiles: (config) => lidarr.getQualityProfiles(lidarrConfigOf(config)),
  fetchQueue: async (config) => (await lidarr.fetchQueue(lidarrConfigOf(config))).map(record => ({
    id: record.id,
    percentComplete: record.percentComplete,
    title: record.albumTitle,
    artistName: record.artistName,
    trackCount: record.trackCount,
    warnings: record.statusMessages?.map(message => message.title),
    // One row is an album's worth of Lidarr queue entries, and cancelling the
    // row means cancelling all of them.
    transferIds: record.rawIds.map(String),
    // Lidarr keeps a finished import in the queue while it moves the files,
    // and `trackedDownloadState` is what says so — `status` alone stays
    // "completed" through the import that has not happened yet.
    active: (record.trackedDownloadState ?? '').toLowerCase() !== 'imported',
    // It resolved the album by MBID or id before it ever queued anything.
    identity: 'exact' as const,
  })),
  cancelQueueItem: (config, item) =>
    lidarr.cancelQueueItem(lidarrConfigOf(config), { rawIds: item.transferIds.map(Number) }),
  testConnection: async (config: unknown): Promise<Health> => {
    const ok = await lidarr.testConnection(lidarrConfigOf(config as DownloaderConfig))
    return { ok: Boolean(ok) }
  },
}

function soulsyncConfigOf(config: DownloaderConfig): soulsync.SoulSyncConfig {
  return { serverUrl: config.serverUrl, apiKey: config.apiKey }
}

function slskdConfigOf(config: DownloaderConfig): slskd.SlskdConfig {
  return {
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
    preferences: config.preferences as SlskdSearchPreferences | undefined,
  }
}

const slskdDownloadAlbum = (config: DownloaderConfig, album: AlbumDownloadRequest) =>
  slskd.downloadAlbum(slskdConfigOf(config), {
    title: album.title,
    artist: album.artist.name,
    // Preserve any MBID the resolver captured — the slskd side uses it to
    // pull canonical strings from MusicBrainz before searching Soulseek.
    mbid: album.externalIds.mbid ?? null,
  })

const slskdDownloadTrack = (config: DownloaderConfig, req: TrackDownloadRequest) =>
  slskd.downloadTrack(slskdConfigOf(config), {
    title: req.title,
    artist: req.artist,
  })

const slskdDownloader: DownloaderDefinition = {
  id: 'slskd',
  // Named for the server the listener runs, like Lidarr and SoulSync.
  // "Soulseek" is the network, and copy uses it only where the network is
  // what failed (nobody sharing a release, a search timing out).
  label: 'slskd',
  descriptionKey: 'externalAlbum.download.slskdDesc',
  albumAddedKey: 'externalAlbum.download.addedToSlskd',
  trackAddedKey: 'externalAlbum.download.addedTrackToSlskd',
  settingsRoute: '/settings/slskdView',
  auth: apiKeyAuth,
  // slskd does both units.
  downloadAlbum: slskdDownloadAlbum,
  downloadTrack: slskdDownloadTrack,
  fetchQueue: async (config) => (await slskd.fetchQueue(slskdConfigOf(config))).map(record => ({
    id: record.id,
    percentComplete: record.percentComplete,
    title: record.title,
    artistName: record.artistName,
    fileCount: record.fileCount,
    sizeBytes: record.size,
    speedBytesPerSec: record.averageSpeed,
    peer: record.username,
    transferIds: record.fileIds,
    active: record.state.toLowerCase() !== 'completed',
    // Soulseek has no album identity — the title came off a remote path.
    identity: 'loose' as const,
  })),
  cancelQueueItem: (config, item) =>
    slskd.cancelQueueItem(slskdConfigOf(config), {
      username: item.peer ?? '',
      fileIds: item.transferIds,
    }),
  testConnection: async (config: unknown): Promise<Health> => {
    const ok = await slskd.testConnection(slskdConfigOf(config as DownloaderConfig))
    return { ok }
  },
}

/**
 * SoulSync takes a track and nothing else. Its public entry point is a single
 * free-text request that runs its own search-match-download pipeline, and it
 * exposes no album endpoint — so this is the first downloader with no
 * `downloadAlbum`, and the reason that field became optional.
 */
const soulsyncDownloadTrack = async (config: DownloaderConfig, req: TrackDownloadRequest): Promise<DownloadResult> => {
  try {
    await soulsync.downloadTrack(soulsyncConfigOf(config), req)
    return { success: true }
  } catch (error) {
    const code = error instanceof soulsync.SoulSyncError ? error.code : undefined
    return { success: false, code, message: (error as Error)?.message ?? 'SoulSync request failed' }
  }
}

const soulsyncDownloader: DownloaderDefinition = {
  id: 'soulsync',
  label: 'SoulSync',
  descriptionKey: 'externalAlbum.download.soulsyncDesc',
  albumAddedKey: 'externalAlbum.download.addedToSoulsync',
  trackAddedKey: 'externalAlbum.download.addedTrackToSoulsync',
  settingsRoute: '/settings/soulsyncView',
  auth: apiKeyAuth,
  // SoulSync is track-only — no `downloadAlbum`.
  downloadTrack: soulsyncDownloadTrack,
  fetchQueue: async (config) => (await soulsync.fetchQueue(soulsyncConfigOf(config))).map(record => ({
    id: record.id,
    percentComplete: record.progress,
    // The album, not the track: this is matched against an album the listener
    // is looking at, and a single track's name would never match one.
    title: record.album || record.title,
    artistName: record.artist,
    albumTitle: record.album || undefined,
    peer: record.username,
    transferIds: [record.id],
    active: record.status.toLowerCase() !== 'completed',
    // SoulSync searches by name, so what it found is a best effort too.
    identity: 'loose' as const,
  })),
  cancelQueueItem: (config, item) =>
    soulsync.cancelDownload(soulsyncConfigOf(config), {
      id: item.id,
      username: item.peer ?? '',
    }),
  testConnection: async (config: unknown): Promise<Health> => {
    const ok = await soulsync.testConnection(soulsyncConfigOf(config as DownloaderConfig))
    return { ok }
  },
}

export const ALL_DOWNLOADERS: DownloaderDefinition[] = [
  lidarrDownloader,
  slskdDownloader,
  soulsyncDownloader,
]

export type DownloaderState = {
  def: DownloaderDefinition
  config: DownloaderConfig
  isConnected: boolean
}

export function useDownloaderStates(): DownloaderState[] {
  const entry = useSelector(selectDownloadersForActiveServer)
  const serverId = useSelector(selectActiveServerId)
  // Not read directly — see `ServersState.credentialsHydrated`. Its only job
  // is to be a dependency that changes once the startup keystore read lands,
  // so `config.apiKey` (below) is recomputed from real values.
  const credentialsHydrated = useSelector(selectCredentialsHydrated)
  // Memoized on `entry`: callers use the returned array as an effect
  // dependency, and a fresh array every render turns those effects into
  // render loops.
  return useMemo(() => ALL_DOWNLOADERS.map((def) => {
    const connection = entry[def.id]
    const apiKey = serverId ? getCredentials(downloaderCredentialScope(def.id, serverId)).apiKey ?? '' : ''
    return {
      def,
      config: {
        serverUrl: connection?.serverUrl ?? '',
        apiKey,
        // Bundling preferences into the config here means every download-time
        // call site — the sheet, the auto-downloader, batch flows — carries
        // them without having to know they exist.
        preferences: connection?.preferences,
      },
      isConnected: connection?.isAuthenticated === true,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- credentialsHydrated is the recompute trigger described above, not a value read here
  }), [entry, serverId, credentialsHydrated])
}

export function useAnyDownloaderConnected(): boolean {
  return useDownloaderStates().some((d) => d.isConnected)
}

export function useAnyTrackDownloaderConnected(): boolean {
  return useDownloaderStates().some((d) => d.isConnected && !!d.def.downloadTrack)
}

/**
 * Somewhere to send a whole album. A downloader with no album endpoint still
 * counts: the Get sheet sends it the album as its tracks (`albumByTracks`), so
 * a listener with only SoulSync connected is offered Get on an album too.
 */
export function useAnyAlbumDownloaderConnected(): boolean {
  return useDownloaderStates().some((d) => d.isConnected && !!(d.def.downloadAlbum || d.def.downloadTrack))
}

/**
 * Somewhere to send an artist. Unlike an album, there is no standing-in for
 * this: an artist cannot be followed as a list of tracks, so a want for one
 * stays a bookmark until something that watches artists is connected.
 */
export function useAnyArtistDownloaderConnected(): boolean {
  return useDownloaderStates().some((d) => d.isConnected && !!d.def.monitorArtist)
}

/** The connected downloaders that can take this unit, in registry order. */
export function useDownloadersForUnit(unit: 'album' | 'track' | 'artist'): DownloaderState[] {
  const states = useDownloaderStates()
  return useMemo(() => states.filter((d) => {
    if (!d.isConnected) return false
    if (unit === 'artist') return !!d.def.monitorArtist
    if (unit === 'track') return !!d.def.downloadTrack
    return !!(d.def.downloadAlbum || d.def.downloadTrack)
  }), [states, unit])
}
