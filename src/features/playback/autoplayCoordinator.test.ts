import type { PlayerBackend } from '@/features/player/backend';
import type { PlayableResource } from '@/features/playback/playableResource';
import type { Song } from '@/domain/entities/Song';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';
import type { QueueSegment } from './playingQueue';
import { segmentAt } from './playingQueue';
import type { QueueFillProvider } from './queueProviders';
import { createAutoplayCoordinator, type AutoplayDeps } from './autoplayCoordinator';
import { UNINFORMED_MODEL, type ListenerModel } from '@/features/listening/listenerModel';
import { entityKey } from '@/features/listening/listenerKey';

jest.mock('@/features/playback/shuffleArray', () => ({
  // Identity, so the tests can assert on *which* tracks ended up where
  // without pinning a random order. What is shuffled is covered by
  // shuffleArray's own tests.
  __esModule: true,
  default: <T,>(items: T[]) => items,
}));

const provenance = serverProvenance('srv-1');

function song(nativeId: string): Song {
  return {
    localId: makeLocalId('song', provenance, nativeId),
    nativeId,
    provenance,
    externalIds: {},
    title: `Track ${nativeId}`,
    artist: {
      localId: makeLocalId('artist', provenance, 'a1'),
      nativeId: 'a1',
      externalIds: {},
      name: 'Artist',
      cover: { kind: 'none' },
    },
    album: {
      localId: makeLocalId('album', provenance, 'al1'),
      nativeId: 'al1',
      externalIds: {},
      title: 'Album',
      cover: { kind: 'none' },
    },
    cover: { kind: 'none' },
    durationSeconds: 200,
    contentKind: 'song',
    genres: [],
  };
}

const resource = (nativeId: string): PlayableResource => ({
  song: song(nativeId),
  streamUrl: `https://server.test/stream/${nativeId}`,
});

interface ProviderCall {
  recentSongs: { nativeId: string; artistName?: string }[];
  excludeIds: string[];
  count: number;
}

function harness(over: Partial<{
  queue: PlayableResource[];
  segments: QueueSegment[];
  currentIndex: number;
  returns: Song[];
  noProvider: boolean;
  listener: AutoplayDeps['listener'];
  fails: boolean;
  /** Tiers asked after the default one, in order. */
  fallbacks: QueueFillProvider[];
  /** Runs inside the provider's fetch, for the things a listener can do while
   *  one is in flight — starting a different album, say. */
  duringFetch: (replaceQueue: (next: PlayableResource[]) => void) => void;
}> = {}) {
  let queue = over.queue ?? [resource('1'), resource('2'), resource('3')];
  let segments = over.segments ?? [];
  const providerCalls: ProviderCall[] = [];
  const engineCalls: { name: string; args: unknown[] }[] = [];
  const loaded: { ids: string[]; startIndex: number; play: boolean; seek?: number }[] = [];
  const warnings: string[] = [];
  let bumps = 0;

  const provider: QueueFillProvider = {
    id: 'similarity-service',
    isAvailable: () => true,
    fetchExtension: async ({ recentSongs, excludeIds, count }) => {
      providerCalls.push({
        recentSongs: [...recentSongs],
        excludeIds: [...excludeIds],
        count,
      });
      over.duringFetch?.(next => { queue = next; });
      if (over.fails) throw new Error('provider is down');
      return over.returns ?? [song('90'), song('91')];
    },
  };

  const backend = {
    addMediaItems: (items: { mediaId?: string }[]) => {
      engineCalls.push({ name: 'addMediaItems', args: [items.map(i => i.mediaId)] });
    },
  } as unknown as PlayerBackend;

  const deps: AutoplayDeps = {
    backend: () => backend,
    providers: () => (over.noProvider ? [] : [provider, ...(over.fallbacks ?? [])]),
    queue: () => queue,
    setQueue: next => { queue = next; },
    segments: () => segments,
    setSegments: next => { segments = next; },
    currentIndex: () => over.currentIndex ?? 0,
    resolvePlayableSong: s => ({ song: s, streamUrl: `https://server.test/stream/${s.nativeId}` }),
    toMediaItems: resources => resources.map(r => ({ mediaId: r.song.localId, url: r.streamUrl })),
    bumpQueue: () => { bumps += 1; },
    loadQueue: async (resources, startIndex, play, seekToPosition) => {
      loaded.push({
        ids: resources.map(r => r.song.nativeId),
        startIndex,
        play,
        seek: seekToPosition,
      });
    },
    logWarning: message => { warnings.push(message); },
    // Identity by default: these tests are about when autoplay fetches and
    // where it puts what it gets, not about the ranking policy, which has its
    // own suite. A test that cares passes its own.
    // A model that changes nothing by default: these tests are about when
    // autoplay fetches and where it puts what it gets, not about the ordering
    // policy, which has its own suite. A test that cares passes its own.
    listener: over.listener ?? (() => UNINFORMED_MODEL),
  };

  return {
    coordinator: createAutoplayCoordinator(deps),
    providerCalls,
    engineCalls,
    loaded,
    warnings,
    get queue() { return queue; },
    get segments() { return segments; },
    get bumps() { return bumps; },
  };
}

const ids = (queue: PlayableResource[]) => queue.map(r => r.song.nativeId);

const tier = (
  id: QueueFillProvider['id'],
  fetchExtension: QueueFillProvider['fetchExtension'],
): QueueFillProvider => ({ id, isAvailable: () => true, fetchExtension });

describe('topping the queue up', () => {
  it('appends the new tracks to the queue and the player', async () => {
    const h = harness();

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue)).toEqual(['1', '2', '3', '90', '91']);
    expect(h.engineCalls).toEqual([{
      name: 'addMediaItems',
      args: [[makeLocalId('song', provenance, '90'), makeLocalId('song', provenance, '91')]],
    }]);
  });

  it('marks the added stretch as autoplay, not as the listener selection', async () => {
    // Smart Shuffle reads this tag to tell what was never chosen.
    const h = harness();

    await h.coordinator.fillQueueIfLow();

    expect(segmentAt(h.segments, 3)?.source).toMatchObject({ kind: 'autoplay-fill' });
    expect(segmentAt(h.segments, 4)?.source).toMatchObject({ kind: 'autoplay-fill' });
  });

  it('seeds with native ids and excludes by identity', async () => {
    // Two different kinds of id, and the distinction is the point. Seeds go to
    // a server that only knows its own ids; exclusions are matched locally,
    // where two origins can both call something `42`.
    const h = harness();

    await h.coordinator.fillQueueIfLow();

    expect(h.providerCalls[0].recentSongs.every(s => /^\d+$/.test(s.nativeId))).toBe(true);
    expect(h.providerCalls[0].excludeIds).toEqual([
      makeLocalId('song', provenance, '1'),
      makeLocalId('song', provenance, '2'),
      makeLocalId('song', provenance, '3'),
    ]);
  });

  it('does not start a second fill while one is in flight', async () => {
    // A fill is a network round trip, and the track changes that trigger it
    // arrive more than once inside one — which would append the same tracks
    // twice.
    const h = harness();

    await Promise.all([
      h.coordinator.fillQueueIfLow(),
      h.coordinator.fillQueueIfLow(),
    ]);

    expect(h.providerCalls).toHaveLength(1);
    expect(ids(h.queue)).toEqual(['1', '2', '3', '90', '91']);
  });

  it('reports a fill in flight, so the caller need not keep its own copy', async () => {
    // `shouldFillQueue` asks this. It used to read a provider ref that was
    // assigned nowhere once the fill moved in here — permanently false, and
    // silently so, because a stale `false` only ever causes an extra call that
    // the guard below then swallows.
    const h = harness();

    expect(h.coordinator.isFilling()).toBe(false);

    const inFlight = h.coordinator.fillQueueIfLow();
    const duringFetch = h.coordinator.isFilling();
    await inFlight;

    expect(duringFetch).toBe(true);
    expect(h.coordinator.isFilling()).toBe(false);
  });

  it('can fill again once the first one has finished', async () => {
    const h = harness();

    await h.coordinator.fillQueueIfLow();
    await h.coordinator.fillQueueIfLow();

    expect(h.providerCalls).toHaveLength(2);
  });

  it('leaves the queue alone when no provider is configured', async () => {
    const h = harness({ noProvider: true });

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue)).toEqual(['1', '2', '3']);
    expect(h.bumps).toBe(0);
  });

  it('warns rather than throwing when the provider fails', async () => {
    // Autoplay failing is the music stopping at the end of the queue, which
    // is what happens without the feature at all.
    const h = harness({ fails: true });

    await expect(h.coordinator.fillQueueIfLow()).resolves.toBeUndefined();

    expect(h.warnings).toEqual(['Queue fill from similarity-service failed', 'Autoplay fill failed']);
  });

  it('asks the next tier when the first answers with nothing', async () => {
    // Similar-songs is empty for any track its source does not know. Stopping
    // there ended the queue after one song with Autoplay on.
    const fallback = tier('library', async () => [song('50')]);
    const h = harness({ returns: [], fallbacks: [fallback] });

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue)).toEqual(['1', '2', '3', '50']);
  });

  it('asks the next tier when the first fails', async () => {
    const fallback = tier('library', async () => [song('50')]);
    const h = harness({ fails: true, fallbacks: [fallback] });

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue)).toEqual(['1', '2', '3', '50']);
    expect(h.warnings).toEqual(['Queue fill from similarity-service failed']);
  });

  it('stops at the first tier that answers', async () => {
    const fallback = tier('library', jest.fn(async () => [song('50')]));
    const h = harness({ fallbacks: [fallback] });

    await h.coordinator.fillQueueIfLow();

    expect(fallback.fetchExtension).not.toHaveBeenCalled();
  });

  it('skips a tier that is not available', async () => {
    const off = { ...tier('native-similarity', jest.fn(async () => [song('60')])), isAvailable: () => false };
    const h = harness({ returns: [], fallbacks: [off, tier('library', async () => [song('50')])] });

    await h.coordinator.fillQueueIfLow();

    expect(off.fetchExtension).not.toHaveBeenCalled();
    expect(ids(h.queue)).toEqual(['1', '2', '3', '50']);
  });

  it('sends the seed artist, which the library tier needs', async () => {
    const h = harness();

    await h.coordinator.fillQueueIfLow();

    expect(h.providerCalls[0].recentSongs[0]).toEqual({ nativeId: '1', artistName: 'Artist' });
  });

  it('releases the guard after a failure, so autoplay is not dead for the session', async () => {
    const h = harness({ fails: true });

    await h.coordinator.fillQueueIfLow();
    await h.coordinator.fillQueueIfLow();

    expect(h.providerCalls).toHaveLength(2);
  });
});

describe('a queue that moved while the fill was in flight', () => {
  /**
   * Asking the tiers is several round trips, and the library tier answers on
   * nearly every server — so the window is real and the tracks coming back
   * were chosen from a queue that may no longer be playing. Appending them
   * anyway put the previous album's artist on the end of the one the listener
   * had just started.
   */
  it('drops the fill when the listener has started something else', async () => {
    const h = harness({
      duringFetch: replaceQueue => replaceQueue([resource('B1'), resource('B2')]),
    });

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue)).toEqual(['B1', 'B2']);
    expect(h.engineCalls).toEqual([]);
    expect(h.warnings.join(' ')).toContain('discarded');
  });

  it('still fills when the queue merely advanced a track under it', async () => {
    const h = harness({
      queue: [resource('1'), resource('2'), resource('3')],
      // The same queue, one track longer: what a listener adding a song does.
      duringFetch: replaceQueue =>
        replaceQueue([resource('1'), resource('2'), resource('3'), resource('4')]),
    });

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue)).toEqual(['1', '2', '3', '4', '90', '91']);
  });
});

describe('smart shuffle', () => {
  it('leaves the already-played prefix untouched', async () => {
    // Someone who has heard the first two tracks has heard them; reshuffling
    // those would replay them.
    const h = harness({
      queue: [resource('1'), resource('2'), resource('3'), resource('4')],
      currentIndex: 1,
    });

    await h.coordinator.injectSmartShuffleTracks(true, 0);

    expect(ids(h.queue).slice(0, 2)).toEqual(['1', '2']);
    expect(ids(h.queue).slice(2).sort()).toEqual(['3', '4', '90', '91']);
  });

  it('replaces the whole segment map, because there is no album left to speak of', async () => {
    const h = harness({
      segments: [
        { startIndex: 0, length: 3, source: { kind: 'user', contextId: 'al1', contextType: 'album' } },
      ] as QueueSegment[],
    });

    await h.coordinator.injectSmartShuffleTracks(true, 0);

    expect(h.segments).toHaveLength(1);
    expect(h.segments[0]).toMatchObject({
      startIndex: 0,
      length: 5,
      source: { contextId: 'smart-shuffled' },
    });
  });

  it('reloads the player and resumes where the listener was', async () => {
    // The queue after the current track is entirely different now, so it has
    // to be handed over whole — and the position has to survive that.
    const h = harness({ currentIndex: 1 });

    await h.coordinator.injectSmartShuffleTracks(true, 42.5);

    expect(h.loaded).toHaveLength(1);
    expect(h.loaded[0]).toMatchObject({ startIndex: 1, play: true, seek: 42.5 });
  });

  it('stays paused if it was paused', async () => {
    const h = harness();

    await h.coordinator.injectSmartShuffleTracks(false, 0);

    expect(h.loaded[0].play).toBe(false);
  });

  it('does not touch the queue when the provider returns nothing', async () => {
    const h = harness({ returns: [] });

    await h.coordinator.injectSmartShuffleTracks(true, 0);

    expect(ids(h.queue)).toEqual(['1', '2', '3']);
    expect(h.loaded).toEqual([]);
  });
});

describe('play similar', () => {
  it('asks the provider about the one song, excluding it from its own results', async () => {
    // The caller places the seed first itself; a provider returning it would
    // put it in the queue twice.
    const h = harness();

    await h.coordinator.relatedTo(song('7'), 20);

    expect(h.providerCalls[0]).toEqual({
      recentSongs: [{ nativeId: '7', artistName: 'Artist' }],
      excludeIds: [makeLocalId('song', provenance, '7')],
      count: 20,
    });
  });

  it('answers null when no provider is configured, so the caller can fall back', async () => {
    // Distinct from an empty list: null means "nobody was asked", which is
    // the case where the adapter's own similar-songs call is worth trying.
    const h = harness({ noProvider: true });

    await expect(h.coordinator.relatedTo(song('7'), 20)).resolves.toBeNull();
  });

  it('answers an empty list when a provider found nothing', async () => {
    const h = harness({ returns: [] });

    await expect(h.coordinator.relatedTo(song('7'), 20)).resolves.toEqual([]);
  });
});

/**
 * The seam between the provider and the listener.
 *
 * The coordinator must hand what it fetched to the model and use what comes
 * back — not the batch it fetched. Without this the whole listening history is
 * computed, passed in, and dropped on the floor, which is a fault that looks
 * exactly like working code.
 */
function modelThat(
  order: ListenerModel['order'],
  purposes: string[] = [],
): () => ListenerModel {
  const model: ListenerModel = {
    ...UNINFORMED_MODEL,
    informed: true,
    order: (items, keyOf, purpose, context) => {
      purposes.push(purpose);
      return order(items, keyOf, purpose, context);
    },
  };
  return () => model;
}

describe('asking the listener model', () => {
  it('queues the order the model returned, not the order the provider sent', async () => {
    const h = harness({
      returns: [song('x'), song('y'), song('z')],
      listener: modelThat(items => [...items].reverse()),
    });

    await h.coordinator.fillQueueIfLow();

    expect(ids(h.queue).slice(-3)).toEqual(['z', 'y', 'x']);
  });

  it('asks to continue, and says which track it is continuing from', async () => {
    const purposes: string[] = [];
    let seenAfter: string | null | undefined;
    const h = harness({
      returns: [song('x')],
      listener: modelThat((items, _keyOf, _purpose, context) => {
        seenAfter = context?.after;
        return [...items];
      }, purposes),
    });

    await h.coordinator.fillQueueIfLow();

    expect(purposes).toContain('continue');
    expect(seenAfter).toBe(entityKey(h.queue[0].song));
  });

  /**
   * Smart Shuffle used a uniform Fisher-Yates, so a track abandoned eleven
   * times out of twelve was as likely to land first as one never skipped — in
   * the feature with "smart" in its name.
   */
  it('asks to shuffle, rather than shuffling for itself', async () => {
    const purposes: string[] = [];
    const h = harness({
      returns: [song('x')],
      listener: modelThat(items => [...items], purposes),
    });

    await h.coordinator.injectSmartShuffleTracks(false, 0);

    expect(purposes).toContain('shuffle');
    expect(h.loaded).toHaveLength(1);
  });
});
