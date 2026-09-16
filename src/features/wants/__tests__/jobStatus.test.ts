import { wantStatus, canGet, JOB_GRACE_MS, type WantQueueSnapshot } from '../jobStatus';
import type { Want } from '@/state/redux/slices/wantsSlice';
import type { DownloaderQueueItem } from '@/features/downloaders/queueItem';
import type { LocalId } from '@/domain/identity/LocalId';

const NOW = 1_000_000;

function want(overrides: Partial<Want> = {}): Want {
  return {
    localId: 'local:album:ext:deezer:1' as LocalId,
    unit: 'album',
    title: 'Kid A',
    artist: 'Radiohead',
    origin: 'search',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function queueItem(overrides: Partial<DownloaderQueueItem> = {}): DownloaderQueueItem {
  return {
    id: 'q1',
    percentComplete: 40,
    title: 'Kid A',
    artistName: 'Radiohead',
    active: true,
    identity: 'exact',
    transferIds: ['t1'],
    ...overrides,
  };
}

const queue = (items: DownloaderQueueItem[], id: WantQueueSnapshot['id'] = 'lidarr'): WantQueueSnapshot[] =>
  [{ id, items }];

describe('wantStatus', () => {
  it('is saved for a want nothing has been asked for', () => {
    expect(wantStatus(want(), { queues: [], hasArrived: false, now: NOW })).toEqual({ kind: 'saved' });
  });

  it('is arrived once the entity is in the library, whatever the queue says', () => {
    // Presence beats a transfer still being listed — something that landed
    // while its job was in flight is yours, not still coming.
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW } }),
      { queues: queue([queueItem()]), hasArrived: true, now: NOW }
    );

    expect(status).toEqual({ kind: 'arrived' });
  });

  it('is arrived even with no job, because arrival is presence and not a job outcome', () => {
    expect(wantStatus(want(), { queues: [], hasArrived: true, now: NOW })).toEqual({ kind: 'arrived' });
  });

  it('reports progress while the matching transfer is moving', () => {
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW } }),
      { queues: queue([queueItem({ percentComplete: 41.6 })]), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'downloading', progress: 42 });
  });

  it('is queued when the transfer is listed but has not started moving', () => {
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW } }),
      { queues: queue([queueItem({ percentComplete: 0 })]), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'queued' });
  });

  it('is queued for a finished item still waiting to leave the queue', () => {
    // Not progress any more: it has done its work, and its disappearance is
    // what arrival watches for.
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW } }),
      { queues: queue([queueItem({ active: false, percentComplete: 100 })]), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'queued' });
  });

  it('stays queued while a job the queue has not shown yet is still within the grace window', () => {
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW - JOB_GRACE_MS + 1 } }),
      { queues: queue([]), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'queued' });
  });

  it('fails a job that left the queue without the entity ever arriving', () => {
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW - JOB_GRACE_MS - 1 } }),
      { queues: queue([]), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'failed' });
  });

  it('reads only the downloader that was actually asked', () => {
    // Another downloader fetching something of the same name is not this
    // want's job, and showing its progress here would answer to nothing the
    // listener did.
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW } }),
      { queues: queue([queueItem()], 'slskd'), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'queued' });
  });

  /**
   * 2.4.0 wrote `jobRef` as a `${id}:${Date.now()}` string that nothing read
   * back. A want persisted with one must not read as a failure: it would put
   * a retry under a download that may well have finished.
   */
  it('reads a want carrying the old string jobRef as saved, not as failed', () => {
    const legacy = want();
    // The shape that upgrades off 2.4.0, which the current type cannot spell.
    Object.assign(legacy, { jobRef: 'lidarr:1700000000000' });

    expect(wantStatus(legacy, { queues: [], hasArrived: false, now: NOW })).toEqual({ kind: 'saved' });
  });

  it('still reports arrival for a want carrying an unreadable job', () => {
    const legacy = want();
    Object.assign(legacy, { jobRef: 'lidarr:1700000000000' });

    expect(wantStatus(legacy, { queues: [], hasArrived: true, now: NOW })).toEqual({ kind: 'arrived' });
  });

  it('does not match a queue item for a different release', () => {
    const status = wantStatus(
      want({ jobRef: { downloader: 'lidarr', requestedAt: NOW - JOB_GRACE_MS - 1 } }),
      { queues: queue([queueItem({ title: 'In Rainbows' })]), hasArrived: false, now: NOW }
    );

    expect(status).toEqual({ kind: 'failed' });
  });

  describe('artist wants', () => {
    const artistWant = (overrides: Partial<Want> = {}) =>
      want({ unit: 'artist', title: 'Radiohead', artist: 'Radiohead', ...overrides });

    it('matches a transfer by the artist it is for, since there is no release to compare', () => {
      const status = wantStatus(
        artistWant({ jobRef: { downloader: 'lidarr', requestedAt: NOW } }),
        { queues: queue([queueItem({ title: 'Amnesiac', percentComplete: 10 })]), hasArrived: false, now: NOW }
      );

      expect(status).toEqual({ kind: 'downloading', progress: 10 });
    });

    it('ignores a transfer for a different artist', () => {
      const status = wantStatus(
        artistWant({ jobRef: { downloader: 'lidarr', requestedAt: NOW - JOB_GRACE_MS - 1 } }),
        { queues: queue([queueItem({ artistName: 'Portishead' })]), hasArrived: false, now: NOW }
      );

      expect(status).toEqual({ kind: 'failed' });
    });

    it('is saved with nothing asked for — wanting an artist starts nothing', () => {
      expect(wantStatus(artistWant(), { queues: [], hasArrived: false, now: NOW })).toEqual({ kind: 'saved' });
    });
  });
});

describe('canGet', () => {
  it('offers a Get on a saved want and a retry on a failed one', () => {
    expect(canGet({ kind: 'saved' })).toBe(true);
    expect(canGet({ kind: 'failed' })).toBe(true);
  });

  it('offers nothing while a job is in flight or already landed', () => {
    expect(canGet({ kind: 'queued' })).toBe(false);
    expect(canGet({ kind: 'downloading', progress: 10 })).toBe(false);
    expect(canGet({ kind: 'arrived' })).toBe(false);
  });
});
