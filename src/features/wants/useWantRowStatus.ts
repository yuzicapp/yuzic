/**
 * The live state of every want on screen, in one pass.
 *
 * The two questions a want row asks — "is it mine yet?" and "what is the
 * downloader doing with it?" — are each answered once here for the whole
 * list, rather than per row. A row-level hook would rebuild the library index
 * and re-scan the queues for every want, which is the shape
 * `features/library/localFirst` exists to avoid.
 *
 * It starts nothing. Arrival reads the already-loaded catalog and the queue
 * comes from `DownloadersQueueContext`, the app's single downloader poller —
 * there is deliberately no second queue and no timer of its own.
 */
import { useCallback, useMemo } from 'react';

import { useAlbums } from '@/features/album/useAlbums';
import { useArtists } from '@/features/artist/useArtists';
import { useTracks } from '@/features/song/useTracks';
import { useDownloadersQueue } from '@/features/downloaders/DownloadersQueueContext';
import type { Want } from '@/state/redux/slices/wantsSlice';
import { hasWantArrived } from './arrival';
import { wantStatus, type WantStatus } from './jobStatus';

export function useWantRowStatus(): (want: Want) => WantStatus {
  const { albums } = useAlbums();
  const { artists } = useArtists();
  const { tracks } = useTracks();
  const { queues } = useDownloadersQueue();

  const library = useMemo(() => ({ albums, artists, tracks }), [albums, artists, tracks]);

  return useCallback(
    (want: Want) => wantStatus(want, { queues, hasArrived: hasWantArrived(want, library) }),
    [queues, library]
  );
}
