/**
 * What a want is currently doing, read off the downloader that was asked.
 *
 * A want has no status of its own and deliberately stores none. Presence in
 * the library is the arrival signal (`arrival.ts`), and everything between a
 * Get and that arrival is the downloader's business — it is the only thing
 * that knows whether a transfer is queued, moving, or gone. So this derives
 * the row's state from the shared queue snapshot rather than from a flag
 * somebody has to remember to write.
 *
 * Nothing here polls: the snapshot comes from `DownloadersQueueContext`, the
 * single poller the app already runs. Pure, so the mapping can be tested
 * without a downloader, a queue, or a clock.
 */
import { matchesAlbum, type DownloaderQueueItem } from '@/features/downloaders/queueItem';
import { normalizeName } from '@/domain/identity/matching';
import type { Want } from '@/state/redux/slices/wantsSlice';
import type { DownloaderId } from '@/state/redux/slices/downloadersSlice';

export type WantStatus =
  /** Saved, nothing asked for. The state every want starts in, and stays in
   *  with no downloader connected. */
  | { kind: 'saved' }
  /** A Get was sent and is accepted but not yet moving. */
  | { kind: 'queued' }
  /** In flight, with whatever progress the downloader reports. */
  | { kind: 'downloading'; progress: number }
  /** Asked for long enough ago that a queue which never showed it is not
   *  going to. Offers a retry rather than sitting silently. */
  | { kind: 'failed' }
  /** It is in the library. The watcher resolves the want moments later; this
   *  is what the row shows in between. */
  | { kind: 'arrived' };

/** One downloader's queue, as much of the snapshot as this needs. */
export interface WantQueueSnapshot {
  id: DownloaderId;
  items: DownloaderQueueItem[];
}

/**
 * How long a job may be unaccounted for before the row offers a retry.
 *
 * Generous on purpose, and it has to be. The queue is read every 30 seconds,
 * a Lidarr request spends its first minutes resolving metadata before
 * anything is queued at all, and a Soulseek search can sit a while before a
 * peer answers. Calling those failures would put a retry under a job that is
 * working. The opposite error — a genuinely lost request showing as queued a
 * few minutes longer than it had to — costs the user nothing.
 */
export const JOB_GRACE_MS = 10 * 60 * 1000;

/**
 * Whether a queued transfer is the one this want asked for.
 *
 * Album and track wants go through `matchesAlbum`, the same comparison the
 * album screen and the settings card use — strict for a downloader that
 * resolved a real release, fuzzy for one reporting a remote folder name. An
 * artist want has only a name to compare, so it compares that, with the same
 * normalisation the domain matcher uses. No new matching is invented here.
 */
function queueItemMatchesWant(item: DownloaderQueueItem, want: Want): boolean {
  if (want.unit === 'artist') {
    const artist = normalizeName(want.artist || want.title);
    return !!artist && normalizeName(item.artistName) === artist;
  }
  return matchesAlbum(item, { title: want.title, artist: want.artist });
}

interface StatusInput {
  /** Every connected downloader's queue, from `useDownloadersQueue()`. */
  queues: readonly WantQueueSnapshot[];
  /** Whether the want's entity is now findable in the synced library. */
  hasArrived: boolean;
  /** Unix ms. Injected so the grace window is testable. */
  now?: number;
}

/**
 * The one status mapping, shared by the row and its options sheet.
 *
 * Arrival wins over everything: something that landed while its transfer was
 * still listed reads as yours, not as still coming — the same precedence
 * `useExternalAlbumStatus` applies to a browsed album.
 */
export function wantStatus(want: Want, input: StatusInput): WantStatus {
  if (input.hasArrived) return { kind: 'arrived' };

  const job = want.jobRef;
  if (!job) return { kind: 'saved' };
  // A job this version cannot read is not a job that failed. 2.4.0 wrote
  // `jobRef` as a `${id}:${Date.now()}` string that nothing ever read back;
  // a want persisted with one would otherwise fall past every branch below
  // and report as "didn't arrive", offering a retry for a download that may
  // well have completed. Saved is the honest reading — it says what is known.
  if (typeof job.requestedAt !== 'number' || !job.downloader) return { kind: 'saved' };

  // Only the downloader that was asked. Another downloader fetching something
  // with the same name is not this want's job, and reading it as one would
  // show a progress bar that answers to nothing the user did here.
  const queue = input.queues.find(q => q.id === job.downloader);
  const item = queue?.items.find(candidate => queueItemMatchesWant(candidate, want));

  if (item) {
    // A finished-but-not-yet-departed item is not progress any more: it has
    // done its work and is waiting to leave the queue, which is the signal
    // arrival watches for.
    if (!item.active) return { kind: 'queued' };
    const progress = Math.max(0, Math.min(100, Math.round(item.percentComplete)));
    return progress > 0 ? { kind: 'downloading', progress } : { kind: 'queued' };
  }

  // Nothing in the queue. Either it has not been picked up yet, or it left
  // without the entity ever reaching the library — the second is a failure,
  // and the only thing separating them is how long it has been.
  const now = input.now ?? Date.now();
  return now - job.requestedAt < JOB_GRACE_MS ? { kind: 'queued' } : { kind: 'failed' };
}

/** Whether a row in this state should offer a Get. */
export const canGet = (status: WantStatus): boolean =>
  status.kind === 'saved' || status.kind === 'failed';
