import type { BrowseCategory } from './browse';
import type { CrossfadeSettings, EqualizerBand, LoudnessSettings } from './audioSettings';
import type { MediaItem } from './mediaItem';

/**
 * The player, as the app talks to it.
 *
 * Taken from what yuzic actually calls — every `TrackPlayer.*` in
 * `PlayingContext`, `sleepTimer`, the player settings screen and the
 * CarPlay hook — rather than from anyone's idea of a complete player. If a
 * method is here, something calls it; if something calls it, it is here.
 *
 * yuzic-engine implements this. It was written while `@rntp/player` was still
 * the player, so both could be driven on one device and compared; that is what
 * turned the replacement from a rewrite of ~40 call sites into a swap of one
 * factory function, and the interface is worth keeping now that only one
 * implementation is left.
 *
 * **Commands return void, not promises, and that is deliberate.** The call
 * sites are synchronous and treat playback as fire-and-forget — `play()` on a
 * button press, `seekTo()` on a scrub. Making them awaitable would spread
 * `await` through components that have nothing to do while they wait, and an
 * engine that crosses a bridge cannot honour a synchronous *result* anyway.
 * Failures arrive as a `PlaybackError` event, which is where the app already
 * looks for them.
 *
 * The getters, by contrast, must answer immediately: call sites read
 * `Math.floor(getProgress().position)` inline. See `engineBackend` for how a
 * bridged engine manages that.
 */
export interface PlayerBackend {
  // Lifecycle
  setup(): void;
  setCommands(): void;

  // Queue
  setMediaItems(items: MediaItem[], startIndex?: number): void;
  addMediaItems(items: MediaItem[]): void;
  insertMediaItem(index: number, item: MediaItem): void;
  removeMediaItem(index: number): void;
  moveMediaItem(from: number, to: number): void;
  clear(): void;

  // Transport
  play(): void;
  pause(): void;
  stop(): void;
  seekTo(positionSeconds: number): void;
  skipToNext(): void;
  skipToIndex(index: number): void;
  setVolume(volume: number): void;
  setPlaybackSpeed(speed: number): void;
  setRepeatMode(mode: 'off' | 'track' | 'queue'): void;

  /**
   * Overlap consecutive tracks, or `null` for none.
   *
   * Not every player can do this — it needs two sources playing at once — so
   * it is the one method here whose absence is a feature being unavailable
   * rather than a platform being incomplete.
   */
  setCrossfade(options: CrossfadeSettings | null): void;

  /** Bands in ascending frequency order. An empty array is flat. */
  setEqualizer(bands: EqualizerBand[]): void;

  /**
   * Level tracks to a reference loudness, from the figures each one carries.
   *
   * A policy, not a per-track call: the engine multiplies it against whatever
   * `replayGainDb` the playing track was queued with, and re-reads it live, so
   * changing this affects the track already playing rather than the next one.
   */
  setLoudness(options: LoudnessSettings): void;

  // State, answered synchronously.
  //
  // `null` from the two active-item getters means *nothing is active*, which
  // is not index 0 — the app already distinguishes them, falling back to
  // finding the track by id when the player has no opinion yet.
  getProgress(): { position: number; duration: number; buffered: number };
  /**
   * Progress of the track that was active until the last track change — how
   * far a listener got into the song the player just left. `getProgress` has
   * already moved on to the new track by the time anyone hears about a change.
   */
  getOutgoingProgress(): { position: number; duration: number; buffered: number };
  getQueue(): MediaItem[];
  getActiveMediaItemIndex(): number | null;
  getActiveMediaItem(): MediaItem | null;

  // Sleep timer
  sleepAfterTime(seconds: number, options?: { fadeOutSeconds?: number }): void;
  cancelSleepTimer(): void;

  // Cache
  clearCache(): void;

  /**
   * Drop one track's cached audio, by the same id the queue keys tracks on
   * (`MediaItem['mediaId']` / `Track['id']`).
   *
   * Distinct from `clearCache()`: deleting one downloaded track must not
   * evict everything the engine has cached for the rest of the library, and
   * without this the app has no way to tell the engine a download is gone —
   * the deleted track's audio can still be served out of the engine's own
   * disk cache after the app has thrown its copy away.
   */
  evict(mediaId: string): void;

  /**
   * Publish the tree the car surfaces browse.
   *
   * Best-effort by contract: a car that is not connected has nothing to show,
   * and a failure here must never take the app down with it.
   */
  setBrowseTree(categories: BrowseCategory[]): void;

  /**
   * Take the car's tree away, including the copy the engine keeps for a car
   * that connects with the app closed. Sign-out calls it, or the next car to
   * connect would show the previous account's library.
   */
  clearBrowseTree(): void;

  /**
   * Whether the engine has been asked what it already holds this launch.
   *
   * A car can start playback before the app's JavaScript runs, and the only
   * way the app learns of it is by asking once the engine is set up. Until
   * then, an empty `getQueue()` means "not asked yet", not "nothing playing",
   * and the persisted-queue restore must wait for the difference: it once won
   * the race and loaded last session's queue over what the car was playing.
   */
  engineQueueKnown(): boolean;

  /** Returns an unsubscribe function, as every caller here expects. */
  addListener(listener: (event: BackendEvent) => void): () => void;
}

/**
 * The events the app reacts to, which is fewer than the engine emits.
 *
 * The state event carries two facts: whether the player is buffering, and
 * whether audio is actually coming out.
 */
export type BackendEvent =
  | { type: 'error'; code?: string; message: string }
  | {
      type: 'stateChange';
      buffering: boolean;
      /**
       * The engine's `playing` state: the source opened and audio is going
       * out, not merely that play was asked for. A stream that cannot open
       * never produces it, which is why failure recovery takes it as proof a
       * retry worked — see `onPlaying` in `playbackEvents`.
       *
       * It was optional while `@rntp/player` was a second backend, because
       * rntp has no playing state to report. The engine is the only backend
       * now, and it always says.
       */
      playing: boolean;
    }
  | { type: 'trackChange'; index: number }
  /**
   * The engine's queue changed, and the backend has already re-read it — so a
   * listener's next `getQueue()` is the engine's answer, not a prediction.
   *
   * Carries no payload on purpose. Anything put here would be a second copy of
   * what `getQueue()` and `getActiveMediaItemIndex()` already say, and a second
   * copy is what this event exists to stop the app from keeping.
   */
  | { type: 'queueChange' }
  /**
   * The backend has asked the engine what it already holds, and taken it if
   * there was anything. Sent once per launch; see `engineQueueKnown`.
   */
  | { type: 'engineQueueKnown' };
