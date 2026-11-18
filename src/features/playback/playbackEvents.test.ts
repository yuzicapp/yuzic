import type { PlayerBackend } from '@/features/player/backend';
import type { Fields } from '@/features/diagnostics/record';
import type { PlayableResource } from '@/features/playback/playableResource';
import type { Song } from '@/domain/entities/Song';
import type { ContentKind } from '@/domain/playback/ContentKind';
import { makeLocalId } from '@/domain/identity/LocalId';
import { serverProvenance } from '@/domain/identity/Provenance';
import { STALL_MIN_POSITION_SEC, MAX_STALL_RESUMES } from './playbackErrorRecovery';
import {
  createPlaybackEventHandlers,
  ERROR_TOAST_INTERVAL_MS,
  MAX_DEAD_TRACKS_IN_A_ROW,
  type PlaybackEventDeps,
} from './playbackEvents';

const provenance = serverProvenance('srv-1');

function resource(nativeId: string, contentKind: ContentKind = 'song'): PlayableResource {
  const song: Song = {
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
    durationSeconds: 240,
    contentKind,
    genres: [],
  };
  return { song, streamUrl: `https://server.test/stream/${nativeId}?token=old` };
}

function harness(over: Partial<{
  queue: PlayableResource[];
  currentIndex: number;
  position: number;
  now: number;
  /** Move to the next queue entry when a track is dropped, as the engine does. */
  advanceOnRemove: boolean;
}> = {}) {
  const queue = over.queue ?? [resource('1'), resource('2')];
  let currentQueue = queue;
  let index = over.currentIndex ?? 0;
  let current: PlayableResource | null = queue[index] ?? null;
  let now = over.now ?? 1_000_000;

  const engineCalls: { name: string; args: unknown[] }[] = [];
  const removed: number[] = [];
  const toasts: number[] = [];
  const stops: number[] = [];
  const logged: Fields[] = [];

  const backend = {
    seekTo: (s: number) => { engineCalls.push({ name: 'seekTo', args: [s] }); },
    play: () => { engineCalls.push({ name: 'play', args: [] }); },
    pause: () => { engineCalls.push({ name: 'pause', args: [] }); },
    setMediaItems: (items: unknown[], index: number) => {
      engineCalls.push({ name: 'setMediaItems', args: [items, index] });
    },
    getProgress: () => ({ position: over.position ?? 0, duration: 240, buffered: 0 }),
  } as unknown as PlayerBackend;

  const deps: PlaybackEventDeps = {
    backend: () => backend,
    currentResource: () => current,
    queue: () => currentQueue,
    currentIndex: () => index,
    // A refreshed URL, which is the whole point of the retry path.
    refreshResource: song => ({
      song,
      streamUrl: `https://server.test/stream/${song.nativeId}?token=fresh`,
    }),
    toMediaItems: resources => resources.map(r => ({ mediaId: r.song.localId, url: r.streamUrl })),
    replaceQueue: resources => { currentQueue = resources; },
    setCurrentResource: r => { current = r; },
    removeFailedCurrentTrack: () => {
      removed.push(1);
      if (over.advanceOnRemove) current = currentQueue[++index] ?? null;
    },
    notifyError: () => { toasts.push(now); },
    notifyStopped: () => { stops.push(now); },
    logFailure: info => { logged.push(info); },
    now: () => now,
  };

  return {
    handlers: createPlaybackEventHandlers(deps),
    engineCalls,
    removed,
    toasts,
    stops,
    logged,
    get queue() { return currentQueue; },
    get current() { return current; },
    advance: (ms: number) => { now += ms; },
  };
}

const names = (calls: { name: string }[]) => calls.map(c => c.name);
const fail = { message: 'boom' };

describe('a track that cannot be refreshed', () => {
  it('drops a failed preview immediately rather than retrying it', () => {
    // A preview URL is issued once and no id can rebuild it, so every retry
    // would fail the same way — a loop instead of a recovery.
    const h = harness({ queue: [resource('1', 'preview')] });

    h.handlers.onError(fail);

    expect(h.removed).toHaveLength(1);
    expect(h.engineCalls).toEqual([]);
  });
});

describe('a stall part-way through a track', () => {
  it('puts playback back where it was instead of starting the track over', () => {
    // Restarting a stalled track is what made the same minute of a song play
    // twice before the track was dropped as unplayable.
    const h = harness({ position: 57 });

    h.handlers.onError(fail);

    expect(h.engineCalls).toEqual([
      { name: 'seekTo', args: [57] },
      { name: 'play', args: [] },
    ]);
    expect(h.removed).toEqual([]);
  });

  it('gives up on a connection that will never serve the track', () => {
    // Bounded, or a dead stream resumes forever and the listener hears
    // nothing while the player insists it is playing.
    const h = harness({ position: 57 });

    for (let i = 0; i < MAX_STALL_RESUMES; i += 1) h.handlers.onError(fail);
    expect(names(h.engineCalls).filter(n => n === 'seekTo')).toHaveLength(MAX_STALL_RESUMES);

    h.handlers.onError(fail);

    expect(names(h.engineCalls).filter(n => n === 'seekTo')).toHaveLength(MAX_STALL_RESUMES);
  });

  it('gives a new song its own full stall budget', () => {
    const h = harness({ position: 57 });
    for (let i = 0; i < MAX_STALL_RESUMES + 1; i += 1) h.handlers.onError(fail);
    const spent = names(h.engineCalls).filter(n => n === 'seekTo').length;

    // Same handler, different song: the budget belongs to the song, not the
    // session.
    const fresh = harness({ position: 57 });
    fresh.handlers.onError(fail);

    expect(spent).toBe(MAX_STALL_RESUMES);
    expect(names(fresh.engineCalls)).toEqual(['seekTo', 'play']);
  });
});

describe('a failure before the track got going', () => {
  it('refreshes every URL in the queue, not just the one that failed', () => {
    // They all came from the same session and went stale together — a
    // Navidrome token across a JavaScript context restart is the case.
    const h = harness({ position: STALL_MIN_POSITION_SEC - 1 });

    h.handlers.onError(fail);

    expect(h.queue.map(r => r.streamUrl)).toEqual([
      'https://server.test/stream/1?token=fresh',
      'https://server.test/stream/2?token=fresh',
    ]);
    expect(names(h.engineCalls)).toEqual(['setMediaItems', 'play']);
  });

  it('retries an unplayable track once, however many times it fails', () => {
    // The loop this rules out: a retry rebuilds the queue, the engine
    // announces the track again, and if that announcement cleared the retry
    // memory every failure would be a first one. Nothing but `onPlaying`
    // clears it, so a track that never plays is retried exactly once.
    const h = harness({ position: 0 });

    // Three, not more: past that the breaker below takes over.
    for (let attempt = 0; attempt < 3; attempt++) h.handlers.onError(fail);

    expect(names(h.engineCalls).filter(n => n === 'setMediaItems')).toHaveLength(1);
    expect(h.removed.length).toBeGreaterThan(0);
  });

  it('drops the track when the refresh did not help', () => {
    const h = harness({ position: 0 });

    h.handlers.onError(fail);
    h.handlers.onError(fail);

    expect(h.removed).toHaveLength(1);
    expect(h.toasts).toHaveLength(1);
  });

  it('retries again once a track has actually played', () => {
    // Playing is the proof the last attempt worked. Without clearing, a track
    // that recovered and later failed again would be dropped as a second
    // failure of the same attempt.
    const h = harness({ position: 0 });
    h.handlers.onError(fail);
    h.handlers.onPlaying();

    h.handlers.onError(fail);

    expect(h.removed).toEqual([]);
    expect(names(h.engineCalls).filter(n => n === 'setMediaItems')).toHaveLength(2);
  });
});

describe('the failure toast', () => {
  it('shows once for a burst, so a queue of dead tracks does not bury the screen', () => {
    const h = harness({ position: 0 });

    h.handlers.onError(fail);
    h.handlers.onError(fail);
    h.handlers.onError(fail);
    h.handlers.onError(fail);

    expect(h.toasts).toHaveLength(1);
  });

  it('shows again once the interval has passed', () => {
    const h = harness({ position: 0 });
    h.handlers.onError(fail);
    h.handlers.onError(fail);

    h.advance(ERROR_TOAST_INTERVAL_MS + 1);
    h.handlers.onError(fail);

    expect(h.toasts).toHaveLength(2);
  });
});

describe('a run of tracks that will not play', () => {
  const queue = () => ['1', '2', '3', '4', '5'].map(id => resource(id));
  /** One track's worth of failure: the first is retried, the second gives up. */
  const deadTrack = (h: ReturnType<typeof harness>) => {
    h.handlers.onError(fail);
    h.handlers.onError(fail);
  };

  it('stops at the limit and keeps the rest of the queue', () => {
    // What it replaces: dropping every track in turn while Autoplay refilled
    // the queue, which never ended on a server whose streams had broken.
    const h = harness({ queue: queue(), position: 0, advanceOnRemove: true });

    for (let track = 0; track < MAX_DEAD_TRACKS_IN_A_ROW; track++) deadTrack(h);

    expect(h.removed).toHaveLength(MAX_DEAD_TRACKS_IN_A_ROW - 1);
    expect(h.current?.song.nativeId).toBe(String(MAX_DEAD_TRACKS_IN_A_ROW));
    expect(names(h.engineCalls).filter(n => n === 'pause')).toHaveLength(1);
    expect(h.stops).toHaveLength(1);
  });

  it('counts only tracks with nothing played in between', () => {
    const h = harness({ queue: queue(), position: 0, advanceOnRemove: true });
    for (let track = 0; track < MAX_DEAD_TRACKS_IN_A_ROW - 1; track++) deadTrack(h);

    h.handlers.onPlaying();
    deadTrack(h);

    expect(h.removed).toHaveLength(MAX_DEAD_TRACKS_IN_A_ROW);
    expect(h.stops).toEqual([]);
  });

  it('gives a press of play one fresh retry, then stops again instead of dropping the track', () => {
    const h = harness({ queue: queue(), position: 0, advanceOnRemove: true });
    for (let track = 0; track < MAX_DEAD_TRACKS_IN_A_ROW; track++) deadTrack(h);
    const retriesBefore = names(h.engineCalls).filter(n => n === 'setMediaItems').length;

    // The listener presses play and the track fails again, twice.
    deadTrack(h);

    expect(names(h.engineCalls).filter(n => n === 'setMediaItems')).toHaveLength(retriesBefore + 1);
    expect(h.removed).toHaveLength(MAX_DEAD_TRACKS_IN_A_ROW - 1);
    expect(h.stops).toHaveLength(2);
  });
});

describe('what a failure is recorded as', () => {
  // The record is what #324, #320 and #318 get diagnosed from, and until 1.3.0
  // the only thing the engine offered was a sentence built for a listener —
  // which on iOS interpolates an NSError that carries the failing URL, and
  // every stream URL this app builds carries the user's credentials.
  it('keeps the engine\'s own account of the failure, not just its sentence', () => {
    const h = harness({ queue: [resource('1')] });

    h.handlers.onError({
      code: 'PLAYBACK_FAILED',
      message: 'Could not open Track 1: timed out',
      operation: 'stream',
      domain: 'NSURLErrorDomain',
      underlyingCode: -1001,
    });

    expect(h.logged[0]).toMatchObject({
      code: 'PLAYBACK_FAILED',
      operation: 'stream',
      domain: 'NSURLErrorDomain',
      underlyingCode: -1001,
      songId: '1',
    });
  });

  it('says nothing about the engine id when it agrees with the current track', () => {
    // Equal is the normal case. Recording it anyway would put a second copy of
    // the same id in every record, and bury the case below. Undefined rather
    // than absent is enough: `fieldsOf` drops undefined on the way out, so it
    // never reaches the export the user sends.
    const h = harness({ queue: [resource('1')] });

    h.handlers.onError({ message: 'boom', id: '1' });

    expect(h.logged[0]?.engineId).toBeUndefined();
  });

  it('records the engine id when it disagrees with the current track', () => {
    // The app handles a failure against whatever it thinks is playing — it
    // drops that track and retries that queue. If the engine failed on a
    // different one, every decision after this point is being made about the
    // wrong song, and nothing else in the record would show it.
    const h = harness({ queue: [resource('1')] });

    h.handlers.onError({ message: 'boom', id: '7' });

    expect(h.logged[0]).toMatchObject({ engineId: '7', songId: '1' });
  });

  it('still records a failure the engine could not classify', () => {
    // `operation` is absent on errors raised outside playback. The record has
    // to survive that rather than depend on it.
    const h = harness({ queue: [resource('1')] });

    h.handlers.onError({ message: 'boom' });

    expect(h.logged).toHaveLength(1);
    expect(h.logged[0]).toMatchObject({ songId: '1', detail: 'boom' });
  });
});
