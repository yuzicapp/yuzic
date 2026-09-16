import type { Song } from '@/domain/entities/Song';
import { segmentAt, type QueueSegment } from './playingQueue';

/**
 * How long after a track change the outgoing listen is recorded.
 *
 * Recording it bumps play stats, and Home's shelves are drawn from those
 * stats. Dispatched inside the track change, that re-render joined the
 * player's own in one commit — measured at 60–140ms on the simulator, the
 * largest single block of JS-thread time at the end of every song. A second
 * later the change has been drawn and the shelves update on their own frame.
 * Nothing waits on the listen being recorded, and a second is well inside
 * every scrobble destination's tolerance for when a listen arrives.
 */
export const OUTGOING_SCROBBLE_DELAY_MS = 1000;

type ScrobbleOptions = { listenedSeconds: number; startTime: number; playlistId?: string };

interface OutgoingScrobbleSource {
  segments: () => QueueSegment[];
  currentIndex: () => number;
  listenStartedAt: () => number;
  scrobble: (song: Song | null, opts: ScrobbleOptions) => Promise<void>;
}

/**
 * The outgoing listen, with everything it depends on read now.
 *
 * Returned as a thunk so it can be sent later. The reads cannot wait: the
 * track change moves the pointer and restarts the listen clock straight after
 * this is called, so the collection and the start time read at send time
 * would belong to the song that has just begun.
 */
export function captureOutgoingScrobble(
  source: OutgoingScrobbleSource,
  song: Song | null,
  listenedSeconds: number,
): () => Promise<void> {
  const origin = segmentAt(source.segments(), source.currentIndex())?.source;
  const playlistId = origin?.kind === 'user' && origin.contextType === 'playlist' ? origin.contextId : undefined;
  const opts: ScrobbleOptions = { listenedSeconds, startTime: source.listenStartedAt(), playlistId };
  return () => source.scrobble(song, opts);
}

/** Run `send` once the track change has been drawn. A failure is the scrobbler's to queue, not a crash. */
export function deferOffTrackChange(
  send: () => Promise<void>,
  schedule: (run: () => void, ms: number) => unknown = setTimeout,
): void {
  schedule(() => { send().catch(() => {}); }, OUTGOING_SCROBBLE_DELAY_MS);
}
