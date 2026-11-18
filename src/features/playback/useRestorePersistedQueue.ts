import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useSelector } from 'react-redux';

import type { Song } from '@/domain/entities/Song';
import { useTracks } from '@/features/song/useTracks';
import { getBackend } from '@/features/player/activeBackend';
import {
  selectPersistedPlaybackActiveServerId,
  selectPersistedPlaybackCurrentIndex,
  selectPersistedPlaybackPositionMs,
  selectPersistedPlaybackQueue,
  selectPersistedPlaybackQueueContexts,
  selectPersistedPlaybackRepeatMode,
  selectPersistedPlaybackShuffleMode,
} from '@/state/redux/selectors/playbackSelectors';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import type { PlaybackSession } from './playbackSession';
import type { PlayableResource } from './playableResource';
import { segmentsFromContexts } from './playingQueue';
import { buildRestoredQueue, decideRestore } from './restoreQueue';
import type { LoadQueue } from './usePlaybackEngine';
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

/**
 * Puts back what was playing when the app last closed, once, for the active
 * server — loaded paused at the remembered position. The listener asked the
 * app to remember where they were, not to start playing on launch.
 *
 * The persisted slice is the source of truth on every server; the server-side
 * queue mirror is only offered when there is nothing local to restore.
 */
export function useRestorePersistedQueue(
  session: PlaybackSession,
  resolve: MutableRefObject<(song: Song) => PlayableResource | null>,
  loadQueue: MutableRefObject<LoadQueue>
): void {
  const persistedIds = useSelector(selectPersistedPlaybackQueue);
  const persistedContexts = useSelector(selectPersistedPlaybackQueueContexts);
  const persistedIndex = useSelector(selectPersistedPlaybackCurrentIndex);
  const persistedPositionMs = useSelector(selectPersistedPlaybackPositionMs);
  const persistedRepeatMode = useSelector(selectPersistedPlaybackRepeatMode);
  const persistedShuffleMode = useSelector(selectPersistedPlaybackShuffleMode);
  const persistedServerId = useSelector(selectPersistedPlaybackActiveServerId);
  const activeServerId = useSelector(selectActiveServerId);
  const { tracks: libraryTracks } = useTracks();
  const doneRef = useRef(false);
  // State, so the decision below runs again once the engine has been asked.
  const [engineQueueKnown, setEngineQueueKnown] = useState(() => getBackend().engineQueueKnown());
  useEffect(() => {
    if (engineQueueKnown) return;
    const unsubscribe = getBackend().addListener(event => {
      if (event.type === 'engineQueueKnown') setEngineQueueKnown(true);
    });
    // Asked again after subscribing, in case the answer landed in between.
    if (getBackend().engineQueueKnown()) setEngineQueueKnown(true);
    return unsubscribe;
  }, [engineQueueKnown]);
  // The last skip reason logged, so a reason that holds across many state
  // changes is reported once rather than on each of them.
  const reportedSkipRef = useRef<string | null>(null);

  useEffect(() => {
    if (doneRef.current) return;

    const decision = decideRestore({
      activeServerId,
      persistedCount: persistedIds.length,
      persistedServerId,
      // The player's queue counts too: one the car started natively is a queue
      // the listener chose, even before the app's own copy has caught up.
      queueLoaded: session.queue().length > 0 || getBackend().getQueue().length > 0,
      engineQueueKnown,
      libraryHydrated: libraryTracks.length > 0,
    });
    if (decision.kind === 'skip') {
      if (decision.final) doneRef.current = true;
      if (decision.report && reportedSkipRef.current !== decision.reason) {
        reportedSkipRef.current = decision.reason;
        log.playback.info('not restoring the persisted queue', { reason: decision.reason });
      }
      return;
    }

    doneRef.current = true;
    const { queue, contexts, index } = buildRestoredQueue({
      persistedIds,
      persistedContexts,
      persistedIndex,
      libraryTracks,
      resolve: resolve.current,
    });
    const active = queue[index];
    if (!active) return;

    // Modes first: loading the queue hands the repeat mode to the player.
    session.setRepeatMode(persistedRepeatMode);
    session.setShuffleMode(persistedShuffleMode);
    session.setQueue(queue);
    // Rebuilt from what each track was queued from, so the rest of a playlist
    // heard after a relaunch still counts as playing that playlist.
    session.setSegments(segmentsFromContexts(contexts, 'restored'));
    session.setActive(index, active);
    loadQueue.current(queue, index, false, Math.floor(persistedPositionMs / 1000)).catch(error => {
      log.playback.warn('restoring the persisted queue failed', { detail: detailOf(error) });
    });
  }, [
    activeServerId,
    engineQueueKnown,
    libraryTracks,
    loadQueue,
    persistedContexts,
    persistedIds,
    persistedIndex,
    persistedPositionMs,
    persistedRepeatMode,
    persistedServerId,
    persistedShuffleMode,
    resolve,
    session,
  ]);
}
