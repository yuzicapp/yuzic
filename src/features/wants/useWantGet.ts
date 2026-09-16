/**
 * Handing one want to a downloader.
 *
 * Only ever from an explicit tap. Saving a want starts nothing, now or later:
 * there is no effect here, nothing watches the want list, and the two entry
 * points below are both called from a row the user pressed. That is a
 * deliberate product decision rather than an unfinished one — matching a
 * wishlist entry to a release on a peer-to-peer network is a guess, and a
 * guess that downloads something is a guess nobody agreed to.
 *
 * An album or track want does not come through here at all: it opens the
 * normal `GetReviewSheet`, the same review every other Get in the app goes
 * through, so there is one confirm step and one place that knows how to pick
 * a downloader. What is left for this hook is the artist unit, which that
 * sheet has no concept of — an artist is followed, not fetched.
 */
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { notify } from '@/components/toast';
import {
  downloadErrorKey,
  useAnyArtistDownloaderConnected,
  useDownloadersForUnit,
} from '@/features/downloaders/registry';
import { promptConnectDownloader } from '@/features/downloaders/connectDownloaderPrompt';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { setWantJobRef, type Want } from '@/state/redux/slices/wantsSlice';

interface WantGet {
  /** Whether anything connected can follow an artist. */
  canGetArtist: boolean;
  /**
   * Sends an artist want to the downloader that can follow artists, and
   * records which one was asked so the row can read its state back. Opens the
   * connect prompt instead when nothing can take it.
   */
  getArtist: (want: Want) => Promise<void>;
}

export function useWantGet(): WantGet {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activeServerId = useSelector(selectActiveServerId);
  const canGetArtist = useAnyArtistDownloaderConnected();
  const artistDownloaders = useDownloadersForUnit('artist');

  const getArtist = useCallback(async (want: Want) => {
    const target = artistDownloaders[0];
    // Nothing that follows artists is connected. The prompt says what a
    // downloader is and offers the ones that could take this, rather than a
    // row that swallows the tap.
    if (!target?.def.monitorArtist) {
      promptConnectDownloader('artist');
      return;
    }

    try {
      const result = await target.def.monitorArtist(target.config, {
        name: want.artist || want.title,
        mbid: want.externalIds?.mbid,
      });
      if (!result.success) {
        notify.error(t(downloadErrorKey(target.def.id, result.code), {
          defaultValue: t('externalAlbum.download.failed'),
        }));
        return;
      }
      notify.success(t(target.def.artistMonitoredKey ?? 'externalAlbum.download.failed', {
        artist: want.artist || want.title,
      }));
      if (activeServerId) {
        dispatch(setWantJobRef({
          serverId: activeServerId,
          localId: want.localId,
          jobRef: { downloader: target.def.id, requestedAt: Date.now() },
        }));
      }
    } catch {
      notify.error(t('externalAlbum.download.startFailed'));
    }
  }, [artistDownloaders, activeServerId, dispatch, t]);

  return { canGetArtist, getArtist };
}
