import type { PlayerBackend } from '@/features/player/backend';
import type { MediaItem } from '@/features/player/mediaItem';
import type { PlayableResource } from '@/features/playback/playableResource';
import type { Song } from '@/domain/entities/Song';
import type { LocalId } from '@/domain/identity/LocalId';
import type { ListenerModel } from '@/features/listening/listenerModel';
import { entityKey } from '@/features/listening/listenerKey';
import { playableOnly } from '@/features/playback/playableResource';
import { buildFillRequest } from './autoplayFill';
import { tagSegment, type QueueSegment } from './playingQueue';
import { resolveQueueFillProvider, type QueueFillProvider } from './queueProviders';

/**
 * Extending a queue with tracks nobody chose.
 *
 * Two features share almost all of this and differ only in where the new
 * tracks go:
 *
 * - **Autoplay** appends when the queue runs low, so the music does not stop.
 *   The added stretch is tagged `autoplay-fill` — Smart Shuffle reads that tag
 *   to tell what was never part of the listener's selection.
 * - **Smart Shuffle** is a one-shot injection: fetch related tracks and
 *   shuffle them through the *rest* of the queue, leaving the already-played
 *   prefix alone. Someone who has heard six tracks of an album has heard them,
 *   and reshuffling those six would replay them.
 *
 * Both go through `fetchExtension`, which is the part with the identity trap
 * in it — see below.
 */
export interface AutoplayDeps {
  backend: () => PlayerBackend;
  /** Ordered by preference: the similarity service when connected, native similarity otherwise. */
  providers: () => QueueFillProvider[];
  queue: () => PlayableResource[];
  setQueue: (resources: PlayableResource[]) => void;
  segments: () => QueueSegment[];
  setSegments: (segments: QueueSegment[]) => void;
  currentIndex: () => number;
  resolvePlayableSong: (song: Song) => PlayableResource | null;
  /**
   * Reorder a fetched batch by how well it fits this listener.
   *
   * The provider decides *which* tracks are candidates — it knows the music.
   * This decides the order they go in, from the listener's own history, which
   * the provider knows nothing about. Injected rather than imported so this
   * coordinator stays free of the store and the whole policy stays testable
   * on its own; see `features/listening/listeningRanking`.
   *
   * Reordering only. A batch comes back the same length it went in, so a thin
   * history can never empty a queue.
   */
  /**
   * What is known about this listener.
   *
   * One dependency rather than a ranker and a shuffler, because both ask the
   * same question — *what order suits this person* — for different purposes,
   * and keeping them apart is how two features end up with two opinions about
   * what a skip is worth. A function rather than a value: the model is rebuilt
   * whenever the log grows and this coordinator outlives that. Injected, so
   * this file stays free of the store. See `features/listening/listenerModel`.
   */
  listener: () => ListenerModel;
  toMediaItems: (resources: PlayableResource[]) => MediaItem[];
  bumpQueue: () => void;
  /** Hand a whole queue to the player. Smart Shuffle replaces rather than appends. */
  loadQueue: (
    resources: PlayableResource[],
    startIndex: number,
    play: boolean,
    seekToPosition?: number
  ) => Promise<void>;
  logWarning: (message: string, error: unknown) => void;
}

interface AutoplayCoordinator {
  /** Top the queue up if it is running low. Safe to call on every track change. */
  fillQueueIfLow: () => Promise<void>;
  /**
   * Whether a fill is in flight.
   *
   * `shouldFillQueue` asks, because a fill takes a network round trip and the
   * track changes that trigger one arrive more than once inside it. The guard
   * inside `fillQueueIfLow` makes the second call harmless either way; this
   * lets the caller skip deciding at all, and — more to the point — means
   * there is no second copy of this flag anywhere to fall out of step.
   */
  isFilling: () => boolean;
  /** Shuffle related tracks through what is left of the queue. */
  injectSmartShuffleTracks: (wasPlaying: boolean, savedPosition: number) => Promise<void>;
  /**
   * Tracks related to one song — what "Play Similar" starts from.
   *
   * Empty when no provider is configured, which the caller distinguishes from
   * "a provider answered with nothing": the first means fall back to the
   * adapter's own similar-songs call, the second means there is genuinely
   * nothing similar and falling back would only ask a worse source the same
   * question.
   */
  relatedTo: (song: Song, count: number) => Promise<PlayableResource[] | null>;
}

export function createAutoplayCoordinator(deps: AutoplayDeps): AutoplayCoordinator {
  /**
   * A fill already in flight.
   *
   * Closure state rather than a provider ref, because nothing else has any
   * business reading it. It is a re-entry guard: a fill takes a network round
   * trip, and the track changes that trigger it can easily arrive twice inside
   * one — which would append the same tracks twice.
   */
  let filling = false;

  /**
   * Ask a provider for more tracks, and turn them into something playable.
   *
   * The identity trap is in the two id arguments and they are not the same
   * kind. Seeds go out as `nativeId`, because both providers hand them
   * straight to a server that only knows its own ids. Exclusions are matched
   * on `localId`, because a queue can hold tracks from more than one origin at
   * once and two origins can easily both call something `42` — excluding on
   * the native id would drop the wrong track.
   */
  const fetchExtension = async (
    provider: QueueFillProvider,
    recentSongs: { song: Song }[],
    excludeLocalIds: Iterable<LocalId | undefined>,
    count: number
  ): Promise<PlayableResource[]> => {
    const extension = await provider.fetchExtension({
      recentSongs: recentSongs.map(entry => ({
        nativeId: entry.song.nativeId,
        artistName: entry.song.artist?.name,
      })),
      excludeIds: new Set([...excludeLocalIds].filter((id): id is LocalId => Boolean(id))),
      count,
    });
    return playableOnly(
      extension
        .map(deps.resolvePlayableSong)
        .filter((resource): resource is PlayableResource => Boolean(resource))
    );
  };

  /**
 * How a queue entry is named to the listener model.
 *
 * Through `entityKey`, which is the same function the log is written with. This
 * was briefly `localId` — which also carries provenance and reads tidier — and
 * that was a silent bug: the log is keyed `serverId:nativeId`, so every lookup
 * missed, the model reported knowing nothing about everything, and each of
 * these orderings quietly became the identity. Nothing threw and every gate
 * passed.
 */
const keyOfResource = (resource: PlayableResource): string => entityKey(resource.song);

/**
 * The tracks both features start from, or an empty list if there is nothing to add.
 *
 * Every tier is asked in turn until one answers with something playable. This
 * used to ask only the first, and an empty answer from it ended the queue:
 * similar-songs is empty for any track its source does not know, and on the
 * last track of a queue nothing ever asks again.
 */
  const nextTracks = async (): Promise<PlayableResource[]> => {
    const request = buildFillRequest(deps.queue(), deps.currentIndex());
    let fetched: PlayableResource[] = [];
    let lastError: unknown = null;
    let answered = false;
    for (const provider of deps.providers().filter(p => p.isAvailable())) {
      try {
        fetched = await fetchExtension(
          provider,
          request.recentResources,
          deps.queue().map(resource => resource.song.localId),
          request.count
        );
        answered = true;
      } catch (error) {
        lastError = error;
        deps.logWarning(`Queue fill from ${provider.id} failed`, error);
        continue;
      }
      if (fetched.length) break;
    }
    // Every tier failing is worth the caller's warning. A tier answering with
    // nothing is not: the end of what the library can suggest is the ordinary
    // end of a queue, and rethrowing an earlier tier's error over it made that
    // log "Autoplay fill failed" on a night that worked exactly as designed.
    if (!fetched.length && lastError && !answered) throw lastError;
    // The track the queue is continuing from, which is what a habit is
    // measured against — "you play B after A" needs to know what A was.
    const after = deps.queue()[deps.currentIndex()] ?? null;
    return deps.listener().order(fetched, keyOfResource, 'continue', {
      after: after ? keyOfResource(after) : null,
    });
  };

  return {
    isFilling: () => filling,

    async fillQueueIfLow() {
      if (filling) return;
      filling = true;
      try {
        // What this fill is a continuation *of*. Asking the tiers takes
        // several round trips, and a listener can start something else in
        // that time — tap an album, switch server, clear the queue. The
        // tracks coming back were chosen from the queue as it was, so
        // appending them to whatever is playing now drops a stranger's
        // records onto the end of it. Advancing a track is fine and common,
        // which is why this asks whether the anchor is still *in* the queue
        // rather than still current.
        const anchor = deps.queue()[deps.currentIndex()] ?? null;

        const playable = await nextTracks();
        if (!playable.length) return;

        if (anchor && !deps.queue().some(r => r.song.localId === anchor.song.localId)) {
          deps.logWarning('Autoplay fill discarded: the queue it was filling is gone', null);
          return;
        }

        const insertAt = deps.queue().length;
        deps.setQueue([...deps.queue(), ...playable]);
        // Tagged so Smart Shuffle can tell these from the listener's own
        // selection. Keyed by where they landed, because a queue can be
        // topped up many times and each stretch is its own context.
        deps.setSegments(tagSegment(deps.segments(), insertAt, playable.length, {
          kind: 'autoplay-fill',
          contextId: `autoplay-${insertAt}`,
        }));
        deps.backend().addMediaItems(deps.toMediaItems(playable));
        deps.bumpQueue();
      } catch (error) {
        // Autoplay failing is the music stopping at the end of the queue,
        // which is also what happens without the feature. Not worth a toast.
        deps.logWarning('Autoplay fill failed', error);
      } finally {
        filling = false;
      }
    },

    async relatedTo(song: Song, count: number) {
      const provider = resolveQueueFillProvider(deps.providers());
      if (!provider) return null;
      // The seed is excluded from its own results: a provider returning the
      // song you asked about would put it in the queue twice, since the caller
      // places it first itself.
      return fetchExtension(provider, [{ song }], [song.localId], count);
    },

    async injectSmartShuffleTracks(wasPlaying: boolean, savedPosition: number) {
      try {
        const playable = await nextTracks();
        if (!playable.length) return;

        // The prefix is what has already been heard, and it stays put:
        // reshuffling it would replay tracks the listener has just finished.
        const played = deps.queue().slice(0, deps.currentIndex() + 1);
        const remaining = deps.queue().slice(deps.currentIndex() + 1);
        const shuffled = deps.listener().order(
          [...remaining, ...playable],
          keyOfResource,
          'shuffle',
        );
        const full = [...played, ...shuffled];

        deps.setQueue(full);
        // One segment over the whole thing. After a smart shuffle there is no
        // album or playlist left to speak of — the tracks are interleaved —
        // and claiming otherwise would have Smooth Transitions drawing
        // boundaries through a deliberately continuous mix.
        deps.setSegments([{
          startIndex: 0,
          length: full.length,
          source: { kind: 'user', contextId: 'smart-shuffled', contextType: 'adhoc' },
        }]);
        deps.bumpQueue();
        // Reloaded rather than appended, and resumed where it was: the queue
        // after the current track is entirely different now.
        await deps.loadQueue(full, deps.currentIndex(), wasPlaying, savedPosition);
      } catch (error) {
        deps.logWarning('Smart Shuffle inject failed', error);
      }
    },
  };
}
