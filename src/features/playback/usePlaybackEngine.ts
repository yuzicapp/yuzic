import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { notify } from '@/components/toast';
import type { Song } from '@/domain/entities/Song';
import { getBackend } from '@/features/player/activeBackend';
import { usePlaybackSink } from '@/features/player/PlaybackSinkContext';
import { ownsPlayback } from '@/features/player/playbackSink';
import { usePlayerActiveItem } from '@/features/player/usePlayerState';
import { selectAutoplayEnabled, selectPlaybackSpeeds } from '@/features/settings/playback/state';
import { createAutoplayCoordinator } from './autoplayCoordinator';
import { useListenerModel } from '@/features/listening/useListenerModel';
import { createPlaybackCoordinator } from './playbackCoordinator';
import { createPlaybackEventHandlers } from './playbackEvents';
import { captureOutgoingScrobble, deferOffTrackChange } from './outgoingScrobble';
import type { PlaybackSession } from './playbackSession';
import { assertPlayable, sameQueue, type PlayableResource } from './playableResource';
import { backendRepeatMode } from './playingPolicies';
import { resourcesFromPlayerQueue } from './playingQueue';
import { speedFor } from './speedProfile';
import { useLatestRef } from './useLatestRef';
import type { PlaybackResources } from './usePlaybackResources';
import type { PlaybackServices } from './usePlaybackServices';
import { log } from '@/features/diagnostics/log';

export type LoadQueue = (
  resources: PlayableResource[],
  startIndex: number,
  play?: boolean,
  seekToPosition?: number
) => Promise<void>;

export type PlaybackEngine = ReturnType<typeof usePlaybackEngine>;

/**
 * The player's side of playback: handing a queue to whichever output holds
 * the audio, and catching up with what the engine then does on its own —
 * tracks starting, the queue moving underneath the app, failures, the queue
 * running low.
 */
export function usePlaybackEngine(
  session: PlaybackSession,
  resources: PlaybackResources,
  services: PlaybackServices
) {
  const { t } = useTranslation();
  const { sink, sinkLoadQueue } = usePlaybackSink();
  const sinkRef = useLatestRef(sink);
  const autoplayEnabled = useLatestRef(useSelector(selectAutoplayEnabled));
  const playbackSpeeds = useLatestRef(useSelector(selectPlaybackSpeeds));
  const activeMediaItem = usePlayerActiveItem();
  const { toMediaItems, resolve, queueFillProviders } = resources;
  const {
    scrobble, nowPlaying, bookmarks, queueSync, persistence, resetLastScrobbled, markInterrupted,
  } = services;

  /**
   * Records the listen that is ending, attributed to the collection it came
   * from. Every caller scrobbles the outgoing song before moving the pointer,
   * so the current index still names the queue position — and so the
   * playlist — that song was heard from.
   */
  const captureScrobble = useCallback((song: Song | null, listenedSeconds: number) => captureOutgoingScrobble({
    segments: session.segments,
    currentIndex: session.currentIndex,
    listenStartedAt: session.listenStartedAt,
    scrobble: (target, opts) => scrobble.current(target, opts),
  }, song, listenedSeconds), [scrobble, session]);

  const scrobbleOutgoing = useCallback(
    (song: Song | null, listenedSeconds: number) => captureScrobble(song, listenedSeconds)(),
    [captureScrobble]
  );

  const loadQueue = useCallback<LoadQueue>(async (queue, startIndex, play = true, seekToPosition) => {
    assertPlayable(queue);
    resetLastScrobbled();
    session.markNewListen();
    if (ownsPlayback(sinkRef.current)) {
      // The server plays from its own playlist of ids, so the local player is
      // never given the queue — and the server is sent the ids it knows.
      await sinkLoadQueue(queue.map(resource => resource.song.nativeId), startIndex, play);
      return;
    }
    const backend = getBackend();
    backend.setMediaItems(toMediaItems(queue), startIndex);
    backend.setRepeatMode(backendRepeatMode(session.repeatMode()));
    if (seekToPosition !== undefined && seekToPosition > 0) backend.seekTo(seekToPosition);
    if (play) backend.play();
  }, [resetLastScrobbled, session, sinkLoadQueue, sinkRef, toMediaItems]);
  const loadQueueRef = useLatestRef(loadQueue);

  /*
   Through a ref, like `loadQueue` above and for the same reason.

   The ranking function's identity changes whenever the listening log does —
   once per track — and the coordinator is memoised on a list that does not
   include it. Passed directly it would be captured once and never replaced,
   so autoplay would rank against whatever the graph held at mount: empty, on
   every cold start. Adding it to the dependency list instead would rebuild
   the coordinator every track and discard its in-flight `filling` guard with
   it, which is the other way to get this wrong.
  */
  const listenerRef = useLatestRef(useListenerModel());

  /** Autoplay and Smart Shuffle: both extend the queue with tracks nobody chose. */
  const autoplay = useMemo(() => createAutoplayCoordinator({
    listener: () => listenerRef.current,
    backend: getBackend,
    providers: () => queueFillProviders.current,
    queue: session.queue,
    setQueue: session.setQueue,
    segments: session.segments,
    setSegments: session.setSegments,
    currentIndex: session.currentIndex,
    resolvePlayableSong: song => resolve.current(song),
    toMediaItems,
    bumpQueue: session.bumpQueue,
    loadQueue: (queue, startIndex, play, seekToPosition) =>
      loadQueueRef.current(queue, startIndex, play, seekToPosition),
    logWarning: (message, fields) => log.playback.warn(message, fields),
  }), [loadQueueRef, listenerRef, queueFillProviders, resolve, session, toMediaItems]);
  const autoplayRef = useLatestRef(autoplay);

  const removeFailedCurrentTrack = useCallback(() => {
    const backend = getBackend();
    const failedIndex = session.currentIndex();
    const queue = session.queue();
    const nextQueue = queue.filter((_, index) => index !== failedIndex);
    const nextIndex = Math.min(failedIndex, nextQueue.length - 1);
    const next = nextQueue[nextIndex];

    if (queue.length <= 1 || failedIndex < 0 || failedIndex >= queue.length || !next) {
      session.clearQueue();
      session.bumpQueue();
      backend.stop();
      backend.clear();
      return;
    }

    const failedLocalId = queue[failedIndex].song.localId;
    const original = session.originalQueue();
    session.setQueue(nextQueue);
    session.setOriginalQueue(original ? original.filter(resource => resource.song.localId !== failedLocalId) : null);
    session.setActive(nextIndex, next);
    session.bumpQueue();

    backend.removeMediaItem(failedIndex);
    backend.skipToIndex(nextIndex);
    backend.play();
  }, [session]);

  /**
   * Failure handling: what has already been retried, how many stalls a song
   * has spent, when the last toast was — all kept inside `playbackEvents`.
   */
  const events = useMemo(() => createPlaybackEventHandlers({
    backend: getBackend,
    currentResource: session.currentResource,
    queue: session.queue,
    currentIndex: session.currentIndex,
    refreshResource: song => resolve.current(song),
    toMediaItems,
    replaceQueue: session.setQueue,
    setCurrentResource: session.setCurrentResource,
    removeFailedCurrentTrack,
    notifyError: () => notify.error(t('common.playbackError')),
    notifyStopped: () => notify.error(t('common.playbackStopped')),
    logFailure: info => log.playback.error('playback failed', info),
    now: Date.now,
  }), [removeFailedCurrentTrack, resolve, session, t, toMediaItems]);
  const eventsRef = useLatestRef(events);

  useEffect(() => getBackend().addListener(event => {
    switch (event.type) {
      case 'error': {
        // Said before the failure is handled, because handling it drops the
        // track and that is what writes the listen down. Without it a lost
        // stream is recorded as a skip, and the app concludes the listener
        // dislikes whatever was playing when their connection went.
        const failed = session.currentResource();
        if (failed) markInterrupted(failed.song.nativeId);
        eventsRef.current.onError(event);
        return;
      }
      case 'stateChange':
        session.setBuffering(event.buffering);
        // The one signal that a track really opened — see `onPlaying` for why
        // a track change is not it.
        if (event.playing) eventsRef.current.onPlaying();
        return;
      case 'queueChange': {
        // The engine's queue moved, so take its answer. Edits made in the app
        // are predictions of a call already made; the engine applies the same
        // edit and is right when the two disagree — and it also reports the
        // changes the app never made: a skip from the lock screen or the car,
        // a track it dropped because it would not open. An empty queue is not
        // taken as a clear: the engine reports empty before a `setQueue` lands.
        const next = resourcesFromPlayerQueue(getBackend().getQueue(), session.queue());
        if (!next.length || sameQueue(session.queue(), next)) return;
        session.setQueue(next);
        session.bumpQueue();
        return;
      }
    }
  }), [eventsRef, markInterrupted, session]);

  /**
   * A track starting is several separate things, and `playbackCoordinator` owns
   * the order: the outgoing scrobble and bookmark are read before anything
   * moves the pointer, and autoplay is asked last.
   */
  const coordinator = useMemo(() => createPlaybackCoordinator({
    backend: getBackend,
    queue: session.queue,
    setQueue: session.setQueue,
    currentResource: session.currentResource,
    setActive: session.setActive,
    bumpQueue: session.bumpQueue,

    // Read now, sent once the change has been drawn — see `deferOffTrackChange`.
    scrobbleOutgoing: (song, listenedSeconds) => { deferOffTrackChange(captureScrobble(song, listenedSeconds)); },
    markNewListen: () => session.markNewListen(),
    // Fire and forget: a save failing must not delay the next track.
    saveBookmark: (song, positionSeconds) => { void bookmarks.current.saveOrClear(song, positionSeconds); },
    resumePositionFor: song => bookmarks.current.getResumePosition(song.localId),
    persistCurrentIndex: index => persistence.current.persistCurrentIndex(index),

    speedFor: song => speedFor(song, playbackSpeeds.current),
    currentSpeed: session.playbackSpeed,
    setSpeed: speed => {
      session.setPlaybackSpeed(speed);
      getBackend().setPlaybackSpeed(speed);
    },

    submitNowPlaying: song => nowPlaying.current(song),
    syncServerQueue: (queue, nativeId, positionMs) => { void queueSync.current.save(queue, nativeId, positionMs); },

    autoplayEnabled: () => autoplayEnabled.current,
    isFilling: () => autoplayRef.current.isFilling(),
    fillQueueIfLow: () => { void autoplayRef.current.fillQueueIfLow(); },
  }), [autoplayEnabled, autoplayRef, bookmarks, nowPlaying, persistence, playbackSpeeds, queueSync, captureScrobble, session]);
  const coordinatorRef = useLatestRef(coordinator);

  useEffect(() => {
    coordinatorRef.current.onActiveTrackChanged(activeMediaItem);
  }, [activeMediaItem, coordinatorRef]);

  return { loadQueueRef, scrobbleOutgoing, autoplay };
}
