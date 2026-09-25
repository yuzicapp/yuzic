import type { BrowseNode } from 'yuzic-engine';
import { isFlat } from './audioSettings';
import type { MediaItem } from './mediaItem';
import type { PlayerBackend, BackendEvent } from './backend';
import {
  applyEvent,
  createShadow,
  toBrowseNode,
  toEngineTrack,
  toPlaybackProgress,
  type Shadow,
} from './engineBackend';
import { createEngineQueueSync } from './engineQueueSync';

/**
 * `PlayerBackend`, implemented on yuzic-engine.
 *
 * The engine is loaded lazily and by `require`, for the same reason the smoke
 * test does it: if the native module is missing this throws, and it should
 * surface as a playback error rather than a blank screen at import time.
 *
 * Every command is fired and not awaited. That is not carelessness — the
 * interface promises synchronous calls, the app has nothing to do while a
 * bridge round-trips, and a rejected promise nobody holds becomes an unhandled
 * rejection. So each one is caught and turned into the error event the app
 * already listens for.
 */
/**
 * Reached by `require` rather than `import` so a missing native module
 * surfaces as a playback error at first use, not a blank screen at import.
 * The smoke test does the same, for the same reason.
 */
function requireEngine() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('yuzic-engine') as typeof import('yuzic-engine')).YuzicEngine;
}

export function createEngineBackend(): PlayerBackend {
  let shadow: Shadow = createShadow();
  let listeners: ((event: BackendEvent) => void)[] = [];
  /** The last tree sent, serialized, so an unchanged one is not sent again. */
  let lastBrowseTree: string | null = null;
  let unsubscribeEngine: (() => void) | null = null;

  // Untyped on purpose: this is the one place that reaches into the native
  // module by name, and typing it against the engine's interface here would
  // only restate what `PlayerBackend` above already promises.
  let engine: ReturnType<typeof requireEngine> | null = null;

  function load() {
    if (!engine) engine = requireEngine();
    return engine;
  }

  function emit(event: BackendEvent) {
    for (const listener of listeners) listener(event);
  }

  /**
   * Run an engine call, and turn a failure into the event the app watches.
   *
   * Named for what it is rather than hidden in every method: the app cannot
   * see a rejected promise, so anything that fails silently here is a track
   * that simply never plays with nothing in the log to say why.
   *
   * **It also warns, and the warning is not redundant.** Emitting the event
   * alone means "handled" in the sense that nothing crashes, not in the sense
   * that anyone finds out: the only subscriber to `error` in this app is the
   * dev smoke-test screen. A method that is missing on a platform therefore
   * fails on the main playback path and leaves no trace at all — `loadQueue`
   * calls `setRepeatMode`, that call rejects, the lines after it still run, so
   * the track plays and repeat mode is silently dead.
   *
   * Swallowing is still right: one absent method must not stop the calls
   * after it, or a partial platform would play nothing rather than play
   * imperfectly. The warning is what makes the difference visible without
   * changing that.
   */
  /** Resolves once `setup` has settled. Null until `setup` is called. */
  // Created eagerly, not when `setup` is called. `fire` gates every other call
  // behind this, and a null gate meant a call arriving *before* setup was
  // fired straight at an engine that did not exist yet — "the engine is not
  // set up — call setup() and wait for it before any command".
  //
  // That is not hypothetical ordering: `setup()` is invoked from an effect
  // declared well below the one that restores the persisted queue, and React
  // runs effects in declaration order. So on every cold launch the restore's
  // `setQueue` went out first and was rejected, and the app came up showing a
  // queue the player had never been given.
  //
  // The gate handled "setup is in flight" and not "setup has not started",
  // which are the same thing from the caller's side.
  let settleReady: () => void = () => {};
  let ready: Promise<void> = new Promise<void>(resolve => {
    settleReady = resolve;
  });

  function fire(what: string, run: () => Promise<unknown>) {
    const report = (error: unknown) => {
      console.warn(`[player] ${what} failed`, error);
      emit({ type: 'error', code: 'ENGINE_CALL_FAILED', message: `${what}: ${String(error)}` });
    };

    // Everything waits for setup, and this is not belt-and-braces: on the
    // native side every transport function is `self.engine?.play()`, so a call
    // arriving before the graph exists is optional-chained into a silent
    // no-op. No error, no event, nothing in a log.
    //
    // That is what made the app open on a cold first launch, show the track,
    // and sit paused: setup was still claiming the audio session and building
    // the graph while the restored queue issued `setMediaItems` and `play`,
    // and both went nowhere. Restarting "fixed" it because by then setup had
    // long finished, which is exactly why it reads as flaky rather than
    // broken.
    //
    // `then(next, next)` runs the call whether setup resolved or rejected: a
    // failed setup already reports itself, and blocking the transport forever
    // afterwards would turn a bad launch into a dead player.
    const next = () => {
      try {
        const result = run();
        if (result && typeof result.catch === 'function') {
          result.catch(report);
        }
      } catch (error) {
        report(error);
      }
    };

    if (what !== 'setup') {
      // Callbacks queue in registration order, so calls stay in the order the
      // app made them rather than racing each other once the gate opens.
      ready.then(next, next);
    } else {
      next();
    }
  }

  /**
   * Queue edits are applied to the shadow immediately as well as sent.
   *
   * `getQueue()` answers synchronously, and a caller that adds a track and
   * reads the queue on the next line has to see it — the engine's own
   * confirmation arrives an event later. The engine remains the authority: a
   * `queueChange` correcting this is welcome, and the shadow is a prediction of
   * a call already made rather than a guess about one that might be.
   */
  function editQueue(next: MediaItem[], activeIndex = shadow.activeIndex) {
    shadow = { ...shadow, queue: next, activeIndex };
  }

  const queueSync = createEngineQueueSync({
    load,
    getShadow: () => shadow,
    setShadow: next => { shadow = next; },
    emit,
  });
  const { reconcileWithEngine, adoptEngineQueue, markEngineQueueKnown, reportTrackChange } = queueSync;

  return {
    setup() {
      // The gate already exists — see `ready` above. All this has to do is
      // open it once the engine is actually up.
      fire('setup', async () => {
        const api = load();
        try {
          // Once a second: every reader of progress — the progress provider,
          // the heartbeat, the sleep timer — polls the shadow at 1s or slower,
          // so faster events were bridge traffic and shadow rebuilds nobody
          // read. The engine's own 4Hz ticker, which times crossfades, is
          // unaffected by this.
          await api.setup({ progressIntervalMs: 1000 });
        } catch (error) {
          // No engine to ask, so nothing to wait for: the restore may go ahead.
          markEngineQueueKnown();
          throw error;
        } finally {
          // Resolved in `finally` rather than after: a setup that threw still
          // has to open the gate, or the transport is blocked for the life of
          // the process.
          settleReady();
        }
        // Subscribe once, and only after setup — the module has no listener
        // list before it exists.
        if (!unsubscribeEngine) {
          unsubscribeEngine = api.addListener((event: Parameters<typeof applyEvent>[1]) => {
            shadow = applyEvent(shadow, event);
            if (event.type === 'stateChange') {
              // `playing` only from the engine's own playing state, never from
              // a play request — failure recovery relies on that; see
              // BackendEvent.
              emit({
                type: 'stateChange',
                buffering: event.state === 'buffering',
                playing: event.state === 'playing',
              });
            }
            if (event.type === 'trackChange') {
              reportTrackChange(event.index, event.id);
            }
            if (event.type === 'error') {
              emit({ type: 'error', code: event.code, message: event.message });
            }
            if (event.type === 'queueChange') {
              void reconcileWithEngine();
            }
          });
          adoptEngineQueue();
        }
      });
    },

    setCommands() {
      // The engine takes the command list on its own terms; the set yuzic
      // advertises is the same one it gives rntp.
      fire('setCommands', async () =>
        load().setCommands(['playPause', 'next', 'previous', 'seek', 'stop'])
      );
    },

    setMediaItems(items, startIndex = 0) {
      editQueue(items, startIndex);
      fire('setQueue', async () => load().setQueue(items.map(toEngineTrack), startIndex));
    },

    addMediaItems(items) {
      editQueue([...shadow.queue, ...items]);
      fire('append', async () => load().append(items.map(toEngineTrack)));
    },

    insertMediaItem(index, item) {
      const next = [...shadow.queue];
      next.splice(index, 0, item);
      // The active index follows the same rule the engine applies natively:
      // inserting at or before the playhead pushes it down, so the track that
      // is playing keeps playing.
      editQueue(next, index <= shadow.activeIndex ? shadow.activeIndex + 1 : shadow.activeIndex);
      fire('insertAt', async () => load().insertAt(index, [toEngineTrack(item)]));
    },

    removeMediaItem(index) {
      const next = [...shadow.queue];
      next.splice(index, 1);
      editQueue(next, index < shadow.activeIndex ? shadow.activeIndex - 1 : shadow.activeIndex);
      fire('removeAt', async () => load().removeAt(index));
    },

    moveMediaItem(from, to) {
      const next = [...shadow.queue];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      let index = shadow.activeIndex;
      if (from === index) index = to;
      else if (from < index && to >= index) index -= 1;
      else if (from > index && to <= index) index += 1;
      editQueue(next, index);
      fire('move', async () => load().move(from, to));
    },

    clear() {
      editQueue([], 0);
      fire('clearQueue', async () => load().clearQueue());
    },

    play() { fire('play', async () => load().play()); },
    pause() { fire('pause', async () => load().pause()); },
    stop() { fire('stop', async () => load().stop()); },
    seekTo(positionSeconds) { fire('seekTo', async () => load().seekTo(positionSeconds)); },
    skipToNext() { fire('skipToNext', async () => load().skipToNext()); },
    skipToIndex(index) { fire('skipToIndex', async () => load().skipToIndex(index)); },
    setVolume(volume) { fire('setVolume', async () => load().setVolume(volume)); },
    setPlaybackSpeed(speed) { fire('setSpeed', async () => load().setSpeed(speed)); },

    setRepeatMode(mode) {
      // The app says off/track/queue; the engine says off/one/all. Same three
      // states, different words, and translating in one place beats teaching
      // either side the other's vocabulary.
      const engineMode = mode === 'track' ? 'one' : mode === 'queue' ? 'all' : 'off';
      fire('setRepeatMode', async () => load().setRepeatMode(engineMode));
    },

    getProgress() { return toPlaybackProgress(shadow.progress); },
    getOutgoingProgress() { return toPlaybackProgress(shadow.outgoingProgress); },
    getQueue() { return shadow.queue; },
    // Null on an empty queue, matching rntp: "nothing is active" and "the
    // first track" are different answers, and the app branches on it.
    getActiveMediaItemIndex() { return shadow.queue.length > 0 ? shadow.activeIndex : null; },
    getActiveMediaItem() { return shadow.queue[shadow.activeIndex] ?? null; },

    sleepAfterTime(seconds) {
      // The engine picks its own fade length and explains why in SleepTimer;
      // the host's fadeOutSeconds is dropped rather than passed to a parameter
      // that does not exist.
      fire('sleepAfter', async () => load().sleepAfter(seconds));
    },
    cancelSleepTimer() { fire('cancelSleep', async () => load().cancelSleep()); },

    setCrossfade(options) {
      fire('setCrossfade', async () => load().setCrossfade(options));
    },

    /**
     * Flat is sent as an empty array rather than ten zeroed bands, so the
     * engine can bypass the EQ unit outright instead of running a filter chain
     * that multiplies by one.
     */
    setEqualizer(bands) {
      fire('setEqualizer', async () =>
        load().setEqualizer(isFlat(bands) ? [] : bands),
      );
    },

    /**
     * Off is sent as `mode: 'off'` rather than a zero preamp — the engine then
     * skips the correction entirely instead of applying a measured gain and
     * adding nothing to it.
     *
     * `preventClipping` stays on: the peak the tracks carry is exactly what it
     * needs, and a positive preamp on an already-hot master is how loudness
     * normalisation ends up sounding worse than none.
     */
    setLoudness(options) {
      fire('setLoudness', async () =>
        load().setReplayGain(
          options.enabled
            ? { mode: 'track', preampDb: options.preampDb, preventClipping: true }
            : { mode: 'off' },
        ),
      );
    },

    clearCache() { fire('clearCache', async () => load().clearCache()); },
    evict(mediaId) { fire('evict', async () => load().evict(mediaId)); },

    engineQueueKnown() {
      return queueSync.engineQueueKnown();
    },

    clearBrowseTree() {
      lastBrowseTree = null;
      fire('clearBrowseTree', async () => load().clearBrowseTree());
    },

    /**
     * Flat categories in, a tree out.
     *
     * The engine takes a recursive `BrowseNode`; the app builds two flat
     * levels. The conversion is here rather than in the CarPlay hook so the
     * hook keeps describing the app's library instead of the engine's shape.
     *
     * `playable` is what makes a node selectable — a node without it is a
     * folder — so the recursion sets it only where a `url` exists. The app
     * nests three deep in places (Albums → an album → its tracks), which is
     * why this recurses rather than mapping two fixed levels.
     *
     * A tree identical to the last one sent is not sent again. The hook
     * rebuilds on every change to anything it reads, most of which leave the
     * library as it was, and each send is a car redrawing under the driver
     * and, on Android, the whole tree encrypted and written to disk.
     */
    setBrowseTree(categories) {
      const tree: BrowseNode = {
        id: 'root',
        title: 'yuzic',
        children: categories.map(category => ({
          id: category.mediaId,
          title: category.title,
          ...(category.icon ? { icon: category.icon } : {}),
          ...(category.layout ? { layout: category.layout } : {}),
          children: category.items.map(item => toBrowseNode(item, category.mediaId)),
        })),
      };
      const serialized = JSON.stringify(tree);
      if (serialized === lastBrowseTree) return;
      lastBrowseTree = serialized;
      fire('setBrowseTree', async () => load().setBrowseTree(tree));
    },

    addListener(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter(other => other !== listener);
      };
    },
  };
}
