import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { notify } from '@/components/toast';
import { useTranslation } from 'react-i18next';

import { useAlbums } from '@/features/album/useAlbums';
import { useArtists } from '@/features/artist/useArtists';
import { useTracks } from '@/features/song/useTracks';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { selectWantsForActiveServer } from '@/state/redux/selectors/wantsSelectors';
import { removeWant } from '@/state/redux/slices/wantsSlice';
import { findArrivedWants } from './arrival';

/**
 * Watches the synced library for wants that have actually arrived and
 * resolves them — presence in the library is the only signal, never a
 * downloader job/queue state. Mount once (alongside `DownloadersQueueProvider`
 * in the home layout): the queue's own poll/staggered-sync loop is what
 * causes a server rescan, and *this* hook is what notices the result landing
 * in the synced library and reacts to it. It never drives or touches that
 * loop itself.
 *
 * Arrival is intentionally not gated on `jobRef` — an entity that shows up
 * in the library by any route (a Get that completed, a manual copy, a
 * Bandcamp download dropped in by hand) resolves the want. There is
 * deliberately no separate "Arrived" collection; Recently Added already
 * covers that, so a resolved want is simply removed from the active list
 * with a brief notification.
 *
 * That notification opens the copy that arrived. Telling someone the thing
 * they waited for is finally here and leaving them to go and find it is the
 * one moment in this feature where a tap is obviously worth offering — and
 * the row that would have taken them there has just been removed.
 */
export function useWantArrivalWatcher(): void {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const activeServerId = useSelector(selectActiveServerId);
  const wants = useSelector(selectWantsForActiveServer);
  const { albums } = useAlbums();
  const { artists } = useArtists();
  const { tracks } = useTracks();

  // Guards against re-firing the toast/removal for a want already resolved
  // in this session — `removeWant` is itself idempotent-safe, but without
  // this the effect could still fire once per re-render before the removal
  // is reflected back through the selector.
  const resolvedRef = useRef<Set<string>>(new Set());

  // A server switch invalidates any previously-resolved localIds — they were
  // scoped to the server that had them, and a different server's wants use
  // localIds independently.
  const prevServerIdRef = useRef<string | null | undefined>(activeServerId);
  if (prevServerIdRef.current !== activeServerId) {
    prevServerIdRef.current = activeServerId;
    resolvedRef.current = new Set();
  }

  useEffect(() => {
    if (!activeServerId || wants.length === 0) return;

    const candidates = wants.filter((want) => !resolvedRef.current.has(want.localId));
    if (candidates.length === 0) return;

    const arrived = findArrivedWants(candidates, { albums, artists, tracks });
    if (arrived.length === 0) return;

    for (const { want, libraryCopy } of arrived) {
      resolvedRef.current.add(want.localId);
      dispatch(removeWant({ serverId: activeServerId, localId: want.localId }));
      notify.success(t('externalAlbum.menu.arrived', { title: want.title }), {
        action: {
          label: t('wants.openArrival'),
          // The server adapter's own id, which is what the detail routes
          // resolve their `id` param by calling back with.
          onPress: () => router.push({
            pathname: libraryCopy.kind === 'artist' ? '/artistView' : '/albumView',
            params: { id: libraryCopy.nativeId },
          }),
        },
      });
    }
  }, [activeServerId, wants, albums, artists, tracks, dispatch, router, t]);
}
