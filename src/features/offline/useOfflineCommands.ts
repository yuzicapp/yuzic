import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { notify } from '@/components/toast';
import type { Song } from '@/domain/entities/Song';
import { getBackend } from '@/features/player/activeBackend';
import { useApi } from '@/providers/registry/useApi';
import type { DownloadProviderScope } from './downloadProvider';
import type { DownloadedCollectionEntry } from './downloadStore';
import { deleteDownloadedFiles } from './filesystem';
import type { OfflineDownloader } from './offlineDownloader';
import type { OfflineStore } from './offlineStore';
import {
  collectionsWithoutTracks,
  evictFromPlayerCache,
  jobMatchesCollectionId,
  jobsOutsideScope,
  trackIdsOfJobs,
  tracksInCollectionRemoval,
  tracksInScope,
  tracksWithout,
} from './removal';
import type { LocalDownloadedTrackEntry } from './restore';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/** What the app can ask of offline storage. Stable for the life of the provider. */
export type DownloadActionsType = {
  downloadTrack: (track: Song, collectionId?: string) => Promise<void>;
  /** Queues a batch of standalone tracks as one job. */
  downloadTracks: (tracks: Song[]) => Promise<void>;
  downloadAlbumById: (albumId: string, songs?: Song[]) => Promise<void>;
  downloadPlaylistById: (playlistId: string, songs?: Song[]) => Promise<void>;
  cancelCollectionDownloads: (collectionId: string) => Promise<void>;
  /** Track ids are `localId`s. */
  removeDownloadByCollectionId: (id: string, trackIds: string[], scope?: DownloadProviderScope) => Promise<void>;
  deleteDownloadedTrack: (trackId: string) => Promise<void>;
  clearDownloadsForProvider: (scope?: DownloadProviderScope) => Promise<void>;
  /** The playable file for a track, by `localId`. Safe to call while resolving playback. */
  getLocalPath: (trackId: string) => string | null;
};

/**
 * The offline commands: what to queue, what to cancel, what to delete.
 *
 * Every track is named by its `localId`, the key the store, the queue and the
 * engine all use. Several of these used to name tracks by the server's own id
 * against an index keyed by `localId`, so a finished album announced that it
 * had failed and a batch never saw the tracks it already had.
 */
export function useOfflineCommands(store: OfflineStore, downloader: OfflineDownloader): DownloadActionsType {
  const { t } = useTranslation();
  const api = useApi();

  const downloadTrack = useCallback((track: Song, collectionId?: string) =>
    downloader.enqueue({ id: `track:${track.localId}`, type: 'track', collectionId, tracks: [track] }), [downloader]);

  const downloadTracks = useCallback(async (tracks: Song[]) => {
    const pending = tracks.filter(track => !store.isDownloaded(track.localId));
    if (!pending.length) return;
    await downloader.enqueue({ id: `tracks:${Date.now()}`, type: 'track', tracks: pending });
  }, [downloader, store]);

  const downloadCollection = useCallback(async (
    collectionId: string,
    type: DownloadedCollectionEntry['type'],
    tracks: Song[],
    label: string,
  ) => {
    store.updateCollections(collections => [
      ...collections.filter(collection => collection.id !== collectionId),
      { id: collectionId, type, trackIds: tracks.map(track => track.localId), downloadedAt: Date.now() },
    ]);
    try {
      await downloader.enqueue({ id: `${type}:${collectionId}`, type, collectionId, tracks });
      // Checked against what actually landed: the queue settles every track,
      // failures included, so "complete" is only said when it is true.
      const landed = tracks.filter(track => store.isDownloaded(track.localId)).length;
      if (landed === tracks.length) {
        notify.success(t('settings.downloaders.downloadComplete'));
      } else {
        log.downloads.warn('download incomplete', { label, landed, expected: tracks.length });
        notify.error(t('externalAlbum.download.failed'));
      }
    } catch (error) {
      log.downloads.error('download failed', { label, detail: detailOf(error) });
      notify.error(t('externalAlbum.download.failed'));
    }
  }, [downloader, store, t]);

  const downloadAlbumById = useCallback(async (albumId: string, songs?: Song[]) => {
    const tracks = songs?.length ? songs : (await api.albums.get(albumId)).songs;
    if (tracks.length) await downloadCollection(albumId, 'album', tracks, 'Album');
  }, [api, downloadCollection]);

  const downloadPlaylistById = useCallback(async (playlistId: string, songs?: Song[]) => {
    const tracks = songs?.length ? songs : (await api.playlists.get(playlistId)).songs;
    if (tracks.length) await downloadCollection(playlistId, 'playlist', tracks, 'Playlist');
  }, [api, downloadCollection]);

  const cancelCollectionDownloads = useCallback(async (collectionId: string) => {
    const cancelled = trackIdsOfJobs(store.jobs().filter(job => jobMatchesCollectionId(job, collectionId)));
    store.updateJobs(jobs => jobs.filter(job => !jobMatchesCollectionId(job, collectionId)));
    await downloader.cancelOrphaned(cancelled);
  }, [downloader, store]);

  /**
   * Every deletion goes through here, and so does the engine eviction: a track
   * is only really gone once the engine's cached copy is gone with it.
   */
  const removeTracks = useCallback(async (tracks: LocalDownloadedTrackEntry[]) => {
    await deleteDownloadedFiles(tracks.map(track => track.localPath));
    evictFromPlayerCache(tracks, mediaId => getBackend().evict(mediaId));
    const removed = new Set(tracks.map(track => track.trackId));
    store.updateTracks(current => tracksWithout(current, removed));
    return removed;
  }, [store]);

  const deleteDownloadedTrack = useCallback(async (trackId: string) => {
    const removed = await removeTracks(store.tracks().filter(track => track.trackId === trackId));
    store.updateCollections(collections => collectionsWithoutTracks(collections, removed.size ? removed : new Set([trackId])));
  }, [removeTracks, store]);

  const removeDownloadByCollectionId = useCallback(async (id: string, trackIds: string[], scope?: DownloadProviderScope) => {
    await removeTracks(tracksInCollectionRemoval(store.tracks(), trackIds, scope));
    store.updateCollections(collections => collections.filter(collection => collection.id !== id));
    store.updateJobs(jobs => jobs.filter(job => !jobMatchesCollectionId(job, id)));
    await downloader.cancelOrphaned(trackIds);
  }, [downloader, removeTracks, store]);

  const clearDownloadsForProvider = useCallback(async (scope?: DownloadProviderScope) => {
    const removed = await removeTracks(tracksInScope(store.tracks(), scope));
    store.updateCollections(collections => collectionsWithoutTracks(collections, removed));
    store.updateJobs(jobs => jobsOutsideScope(jobs, scope));
  }, [removeTracks, store]);

  return useMemo(() => ({
    downloadTrack,
    downloadTracks,
    downloadAlbumById,
    downloadPlaylistById,
    cancelCollectionDownloads,
    removeDownloadByCollectionId,
    deleteDownloadedTrack,
    clearDownloadsForProvider,
    getLocalPath: store.localPath,
  }), [
    cancelCollectionDownloads,
    clearDownloadsForProvider,
    deleteDownloadedTrack,
    downloadAlbumById,
    downloadPlaylistById,
    downloadTrack,
    downloadTracks,
    removeDownloadByCollectionId,
    store,
  ]);
}
