import * as FileSystem from 'expo-file-system/legacy';

import type { Song } from '@/domain/entities/Song';
import type { DownloadProgress } from './downloadProgress';
import type { PersistedDownloadJob, PersistedResumable } from './downloadStore';
import {
  BACKGROUND_FILE_OPTIONS,
  DOWNLOAD_DIR,
  FOREGROUND_FILE_OPTIONS,
  buildStagingPath,
  cleanupStagingFiles,
  ensureDownloadDir,
} from './filesystem';
import { createDownloadJobRunner } from './jobQueue';
import type { OfflineStore } from './offlineStore';
import { orphanedTrackIds } from './removal';
import {
  DOWNLOAD_SCHEMA_VERSION,
  extensionFromContentType,
  headerValue,
  sanitizeFileName,
  type LocalDownloadedTrackEntry,
} from './restore';
import {
  expiredResumables,
  findUsableResumable,
  removeResumable,
  stagingPathsToKeep,
  upsertResumable,
} from './resumeState';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

const MAX_JOB_ATTEMPTS = 5;
const CONCURRENT_TRACK_DOWNLOADS = 3;

/** A job as it is asked for; the queue stamps when. */
type NewDownloadJob = Omit<PersistedDownloadJob, 'createdAt' | 'updatedAt'>;

export type OfflineDownloader = ReturnType<typeof createOfflineDownloader>;

type OfflineDownloaderDeps = {
  store: OfflineStore;
  progress: DownloadProgress;
  /**
   * Looks the track up fresh and builds a URL to fetch it from right now. A
   * queued job can wait a long time (Wi-Fi only, backgrounded), and the URL is
   * credentialled and goes stale with the session, so it is never kept.
   */
  resolveTrack: (track: Song) => Promise<{ song: Song; streamUrl: string } | null>;
  /** Headers a protected server needs on the file download itself. */
  requestHeaders: (streamUrl: string) => Record<string, string> | undefined;
  /** The server downloads run against, for tracks whose provenance names none. */
  activeServer: () => { id?: string; type?: string } | null | undefined;
  /** Whether a transfer may start on this connection. */
  mayDownload: () => boolean;
  /** A job that kept failing and was given up on. */
  onJobDropped: (job: PersistedDownloadJob) => void;
};

/**
 * Moves bytes: runs the job queue, downloads each track to its staging file
 * and into place, and keeps interrupted transfers resumable.
 *
 * Built once per provider. Everything it needs that can change — the API, the
 * connection, the server — is read through `deps` when it acts.
 */
export function createOfflineDownloader(deps: OfflineDownloaderDeps) {
  const { store, progress } = deps;
  const runner = createDownloadJobRunner<Song, PersistedDownloadJob>();
  const active = new Map<string, FileSystem.DownloadResumable>();

  const setResumables = (next: PersistedResumable[]) => store.setResumables(next);

  // The server transcodes (format and bitrate ride on the stream URL), so one
  // direct download is the whole job.
  async function downloadTrack(track: Song, collectionId?: string): Promise<void> {
    const trackId = track.localId;
    if (store.isDownloaded(trackId) || store.isDownloading(trackId)) return;

    const resolved = await deps.resolveTrack(track);
    if (!resolved) throw new Error('Track stream URL unavailable');
    const { song: freshSong, streamUrl } = resolved;

    await ensureDownloadDir();
    store.setDownloading(trackId, true);
    const stagingPath = buildStagingPath(track);

    try {
      // Bytes already on disk from a run cut short — usable only against the
      // very same URL; see findUsableResumable.
      const saved = findUsableResumable(store.resumables(), trackId, streamUrl);
      const headers = deps.requestHeaders(streamUrl);

      const runWithSession = async (options: typeof BACKGROUND_FILE_OPTIONS) => {
        const resumable = FileSystem.createDownloadResumable(
          streamUrl,
          stagingPath,
          headers ? { ...options, headers } : options,
          ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
            progress.report(trackId, totalBytesWritten, totalBytesExpectedToWrite),
          saved?.resumeData,
        );
        active.set(trackId, resumable);
        return saved ? await resumable.resumeAsync() : await resumable.downloadAsync();
      };

      let result;
      try {
        result = await runWithSession(BACKGROUND_FILE_OPTIONS);
      } catch (error) {
        // Every task on a session whose daemon is unreachable fails the same
        // way, so retry once on a foreground session before giving up.
        log.downloads.warn('background download session failed, retrying in the foreground', { trackId, detail: detailOf(error) });
        result = await runWithSession(FOREGROUND_FILE_OPTIONS);
      }
      // Undefined when the transfer was cancelled or paused: nothing to record.
      if (!result) return;
      if (result.status < 200 || result.status >= 300) throw new Error(`Download failed (${result.status})`);

      const extension = extensionFromContentType(headerValue(result.headers, 'Content-Type'));
      const localPath = `${DOWNLOAD_DIR}${sanitizeFileName(trackId)}.${extension}`;
      await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
      await FileSystem.moveAsync({ from: stagingPath, to: localPath });
      const info = await FileSystem.getInfoAsync(localPath);

      // The fresh song's provenance is the truth about which server this came
      // from; the active server only fills in for a song that names none.
      const server = deps.activeServer();
      const serverId = (freshSong.provenance.origin === 'server' ? freshSong.provenance.serverId : undefined) ?? server?.id ?? '';
      const serverType = server?.type ?? '';
      const entry: LocalDownloadedTrackEntry = {
        trackId,
        localPath,
        fileSize: info.exists ? info.size : 0,
        downloadedAt: Date.now(),
        albumId: track.album.localId,
        artistId: track.artist.localId,
        serverId,
        serverType,
        coverKind: track.cover.kind,
        schemaVersion: DOWNLOAD_SCHEMA_VERSION,
        title: track.title,
        originalTrack: { id: trackId, extraPayload: { serverId, serverType, coverKind: track.cover.kind } },
      };

      // The file is whole and in place; there is nothing left to resume.
      setResumables(removeResumable(store.resumables(), trackId));
      store.updateTracks(tracks => [...tracks.filter(existing => existing.trackId !== trackId), entry]);
      if (collectionId) {
        store.updateCollections(collections => collections.map(collection => (
          collection.id === collectionId
            ? { ...collection, trackIds: [...new Set([...collection.trackIds, trackId])] }
            : collection
        )));
      }
    } finally {
      active.delete(trackId);
      progress.clear(trackId);
      // The staging file is scratch — unless this transfer was paused on
      // purpose and its state saved, in which case those bytes are the point.
      const held = store.resumables().some(entry => entry.trackId === trackId && entry.resumeData);
      if (!held) await FileSystem.deleteAsync(stagingPath, { idempotent: true }).catch(() => {});
      store.setDownloading(trackId, false);
    }
  }

  const removeJob = (jobId: string) => store.updateJobs(jobs => jobs.filter(job => job.id !== jobId));

  async function processQueue(): Promise<void> {
    // Downloads can run up a phone bill without anyone asking — auto-download
    // fires off a sync, not a tap. Held jobs stay persisted and drain once the
    // connection allows.
    if (!deps.mayDownload()) return;

    await runner.run({
      getJobs: store.jobs,
      downloadTrack,
      onJobComplete: job => removeJob(job.id),
      onJobRescheduled: (job, attempts) => {
        log.downloads.warn('download job queued for the next pass', { job: job.id, attempts, maxAttempts: MAX_JOB_ATTEMPTS });
        store.updateJobs(jobs => jobs.map(existing => (
          existing.id === job.id ? { ...existing, attempts, updatedAt: Date.now() } : existing
        )));
      },
      onJobDropped: (job, attempts) => {
        log.downloads.error('download job dropped', { job: job.id, attempts });
        removeJob(job.id);
        deps.onJobDropped(job);
      },
      prepare: async () => {
        await ensureDownloadDir();
        // Aged-out saved state goes first, so its staging file falls out of
        // `keep` and is collected in the same sweep.
        const stale = expiredResumables(store.resumables());
        if (stale.length) {
          setResumables(stale.reduce((list, entry) => removeResumable(list, entry.trackId), store.resumables()));
        }
        await cleanupStagingFiles(stagingPathsToKeep(store.resumables()));
      },
      concurrency: CONCURRENT_TRACK_DOWNLOADS,
      maxAttempts: MAX_JOB_ATTEMPTS,
    });
  }

  return {
    downloadTrack,
    processQueue,

    /** Adds or replaces a job — keeping when it was first asked for — and runs the queue. */
    async enqueue(job: NewDownloadJob): Promise<void> {
      const now = Date.now();
      store.updateJobs(jobs => {
        const existing = jobs.find(candidate => candidate.id === job.id);
        return [
          ...jobs.filter(candidate => candidate.id !== job.id),
          { ...job, createdAt: existing?.createdAt ?? now, updatedAt: now },
        ];
      });
      await processQueue();
    },

    /**
     * Writes down where every in-flight transfer had got to, so the next
     * launch continues from those bytes. Pausing resolves the transfer as
     * "nothing to record", which leaves its staging file in place.
     */
    async pauseActive(): Promise<void> {
      const entries = [...active.entries()];
      if (!entries.length) return;
      const saved = await Promise.all(entries.map(async ([trackId, resumable]): Promise<PersistedResumable | null> => {
        try {
          const state = await resumable.pauseAsync();
          if (!state.resumeData) return null;
          return { trackId, url: state.url, fileUri: state.fileUri, resumeData: state.resumeData, savedAt: Date.now() };
        } catch {
          // Already finished or failed: nothing to pause, so it starts over.
          return null;
        }
      }));
      setResumables(saved.filter((entry): entry is PersistedResumable => entry !== null).reduce(upsertResumable, store.resumables()));
    },

    /**
     * Stops transfers no remaining job still wants, and forgets their saved
     * state so their staging files are collected too.
     */
    async cancelOrphaned(candidateTrackIds: Iterable<string>): Promise<void> {
      const orphans = orphanedTrackIds(candidateTrackIds, store.jobs());
      await Promise.all(orphans.map(trackId => active.get(trackId)?.cancelAsync().catch(() => {})));
      if (orphans.length) setResumables(orphans.reduce(removeResumable, store.resumables()));
    },

    /** Deletes stray partials not held for resuming, unless a run is using them. */
    sweepStaging(): void {
      if (runner.isRunning()) return;
      cleanupStagingFiles(stagingPathsToKeep(store.resumables())).catch(() => {});
    },
  };
}
