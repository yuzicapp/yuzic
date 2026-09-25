import type { PlayerBackend, BackendEvent } from './backend';
import type { MediaItem } from './mediaItem';

/**
 * One contract, run against two implementations.
 *
 * `createEngineBackend.test.ts` and `engineBackend.test.ts` already cover the
 * real adapter's own internals — the optimistic queue edits, the setup gate,
 * events becoming backend events. What neither proves is that a *fake*
 * `PlayerBackend` used anywhere else in this app's tests actually behaves
 * like the real one. A fake that drifts from the adapter makes every test
 * built on it a lie: it would keep passing after a change that breaks the
 * real player.
 *
 * So this defines the plainest possible fake, and runs the same assertions —
 * about what `PlayerBackend` itself promises, not about either
 * implementation's internals — against it and against `createEngineBackend()`
 * (with the native module faked, the same way `createEngineBackend.test.ts`
 * does; this file has no more access to real native code than that one does).
 * `getQueue`/`getActiveMediaItemIndex`/`getActiveMediaItem` answering
 * immediately, without waiting on `setup()`, is exactly the property the
 * engine backend's docs call out as the one thing worth being careful about —
 * see `engineBackend.ts` — so it is the one this suite checks hardest.
 */

const mockEngineCalls: { name: string; args: unknown[] }[] = [];

const mockEngine = new Proxy(
  {},
  {
    get(_target, name: string) {
      if (name === 'addListener') {
        return () => () => {};
      }
      return (...args: unknown[]) => {
        mockEngineCalls.push({ name, args });
        return Promise.resolve();
      };
    },
  }
);

jest.mock('yuzic-engine', () => ({ YuzicEngine: mockEngine }), { virtual: true });

const { createEngineBackend } = require('./createEngineBackend');

function item(id: string, over: Partial<MediaItem> = {}): MediaItem {
  return {
    mediaId: id,
    title: id,
    artist: 'Someone',
    albumTitle: 'An Album',
    duration: 100,
    url: `https://example/${id}`,
    ...over,
  };
}

/**
 * The plainest thing that satisfies `PlayerBackend`: queue state lives in a
 * couple of variables, every command is a synchronous mutation, and nothing
 * ever fails. It exists to be compared against, not to be realistic — a fake
 * that tried to reproduce the engine's async event plumbing would just be a
 * second copy of `createEngineBackend`.
 */
function createFakeBackend(): PlayerBackend {
  let queue: MediaItem[] = [];
  let activeIndex = 0;
  let listeners: ((event: BackendEvent) => void)[] = [];

  return {
    setup() {},
    setCommands() {},

    setMediaItems(items, startIndex = 0) {
      queue = items;
      activeIndex = startIndex;
    },
    addMediaItems(items) {
      queue = [...queue, ...items];
    },
    insertMediaItem(index, newItem) {
      const next = [...queue];
      next.splice(index, 0, newItem);
      activeIndex = index <= activeIndex ? activeIndex + 1 : activeIndex;
      queue = next;
    },
    removeMediaItem(index) {
      const next = [...queue];
      next.splice(index, 1);
      activeIndex = index < activeIndex ? activeIndex - 1 : activeIndex;
      queue = next;
    },
    moveMediaItem(from, to) {
      const next = [...queue];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      if (from === activeIndex) activeIndex = to;
      else if (from < activeIndex && to >= activeIndex) activeIndex -= 1;
      else if (from > activeIndex && to <= activeIndex) activeIndex += 1;
      queue = next;
    },
    clear() {
      queue = [];
      activeIndex = 0;
    },

    play() {},
    pause() {},
    stop() {},
    seekTo() {},
    skipToNext() {},
    skipToIndex(index) {
      activeIndex = index;
    },
    setVolume() {},
    setPlaybackSpeed() {},
    setRepeatMode() {},
    setCrossfade() {},
    setEqualizer() {},
    setLoudness() {},

    getProgress() {
      return { position: 0, duration: 0, buffered: 0 };
    },
    getOutgoingProgress() {
      return { position: 0, duration: 0, buffered: 0 };
    },
    getQueue() {
      return queue;
    },
    getActiveMediaItemIndex() {
      return queue.length > 0 ? activeIndex : null;
    },
    getActiveMediaItem() {
      return queue[activeIndex] ?? null;
    },

    sleepAfterTime() {},
    cancelSleepTimer() {},

    clearCache() {},
    evict() {},

    setBrowseTree() {},
    clearBrowseTree() {},
    engineQueueKnown() {
      return true;
    },

    addListener(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter(other => other !== listener);
      };
    },
  };
}

const implementations: [string, () => PlayerBackend][] = [
  ['a fake backend', createFakeBackend],
  ['the engine adapter (native module faked)', createEngineBackend],
];

describe.each(implementations)('PlayerBackend contract — %s', (_name, makeBackend) => {
  beforeEach(() => {
    mockEngineCalls.length = 0;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts empty', () => {
    const backend = makeBackend();
    expect(backend.getQueue()).toEqual([]);
    expect(backend.getActiveMediaItemIndex()).toBeNull();
    expect(backend.getActiveMediaItem()).toBeNull();
  });

  it('answers the queue synchronously, with no wait for setup or the engine', () => {
    const backend = makeBackend();
    backend.setMediaItems([item('a'), item('b')], 1);
    expect(backend.getQueue().map(track => track.mediaId)).toEqual(['a', 'b']);
    expect(backend.getActiveMediaItemIndex()).toBe(1);
    expect(backend.getActiveMediaItem()?.mediaId).toBe('b');
  });

  it('appends without disturbing what is already queued', () => {
    const backend = makeBackend();
    backend.setMediaItems([item('a')], 0);
    backend.addMediaItems([item('b'), item('c')]);
    expect(backend.getQueue().map(track => track.mediaId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the active track playing when something is inserted above it', () => {
    const backend = makeBackend();
    backend.setMediaItems([item('a'), item('b')], 1);
    backend.insertMediaItem(0, item('new'));
    expect(backend.getActiveMediaItem()?.mediaId).toBe('b');
    expect(backend.getQueue().map(track => track.mediaId)).toEqual(['new', 'a', 'b']);
  });

  it('keeps the active track playing when something above it is removed', () => {
    const backend = makeBackend();
    backend.setMediaItems([item('a'), item('b'), item('c')], 2);
    backend.removeMediaItem(0);
    expect(backend.getActiveMediaItem()?.mediaId).toBe('c');
  });

  it('follows the active track when it is the one moved', () => {
    const backend = makeBackend();
    backend.setMediaItems([item('a'), item('b'), item('c')], 0);
    backend.moveMediaItem(0, 2);
    expect(backend.getActiveMediaItem()?.mediaId).toBe('a');
    expect(backend.getActiveMediaItemIndex()).toBe(2);
  });

  it('reports nothing active — not index 0 — once cleared', () => {
    const backend = makeBackend();
    backend.setMediaItems([item('a')], 0);
    backend.clear();
    expect(backend.getQueue()).toEqual([]);
    expect(backend.getActiveMediaItem()).toBeNull();
    expect(backend.getActiveMediaItemIndex()).toBeNull();
  });

  it('returns an unsubscribe function from addListener', () => {
    const backend = makeBackend();
    const unsubscribe = backend.addListener(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('accepts every transport, cache and platform command without throwing', () => {
    const backend = makeBackend();
    backend.setup();
    backend.setCommands();
    backend.setMediaItems([item('a')], 0);
    expect(() => {
      backend.play();
      backend.pause();
      backend.stop();
      backend.seekTo(10);
      backend.skipToNext();
      backend.skipToIndex(0);
      backend.setVolume(0.5);
      backend.setPlaybackSpeed(1.25);
      backend.setRepeatMode('queue');
      backend.setCrossfade({ durationSec: 4, mode: 'gapless-aware', skipIsImmediate: true });
      backend.setCrossfade(null);
      backend.setEqualizer([]);
      backend.setLoudness({ enabled: false, preampDb: 0 });
      backend.sleepAfterTime(60);
      backend.cancelSleepTimer();
      backend.clearCache();
      // The app has no way to tell the engine a deleted download's audio
      // should stop being served from its cache without this — see
      // `backend.ts`.
      backend.evict('a');
      backend.setBrowseTree([]);
      backend.clearBrowseTree();
    }).not.toThrow();
  });
});
