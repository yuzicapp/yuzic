import React, { useEffect, useMemo } from 'react';
import { CloudDownload, ExternalLink, RotateCw, Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import type { ResolvedAction } from '@/features/entity-actions/types';
import { useSheetRef } from '@/components/useSheetRef';
import { useTheme } from '@/features/theme/useTheme';
import { iconSize, statusColor } from '@/constants/design';
import { useAnyAlbumDownloaderConnected } from '@/features/downloaders/registry';
import { promptConnectDownloader } from '@/features/downloaders/connectDownloaderPrompt';
import { useWantGet } from '@/features/wants/useWantGet';
import { canGet, type WantStatus } from '@/features/wants/jobStatus';
import type { Want } from '@/state/redux/slices/wantsSlice';

const sz = iconSize.loader;

/**
 * A saved want's options: go to it, ask for it, look for it, or drop it.
 *
 * Remove and Search were all there was, because a want was all a want could
 * be. The rest sits above them now, in the order you would reach for it: open
 * what it names, then hand it to a downloader, then the two that were already
 * here — with Remove last, where every destructive row in the app is.
 *
 * Get is absent rather than greyed out when nothing can take the unit, and
 * the row that replaces it opens the connect prompt: a disabled row that
 * swallows the tap reads as broken rather than as a step not yet taken. A job
 * that was asked for and never arrived offers a retry instead, which is the
 * same action under a different name.
 */
export function WantOptions({
  want,
  status,
  onClose,
  onOpen,
  onGet,
  onSearch,
  onRemove,
}: {
  want: Want;
  status: WantStatus;
  onClose: () => void;
  onOpen: () => void;
  onGet: () => void;
  onSearch: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sheetRef = useSheetRef();
  const snapPoints = useMemo(() => ['45%'], []);
  const { canGetArtist, getArtist } = useWantGet();
  const canGetRelease = useAnyAlbumDownloaderConnected();

  useEffect(() => { sheetRef.current?.present(); }, [sheetRef]);

  const run = (action: () => void) => () => { sheetRef.current?.dismiss(); action(); };

  const isArtist = want.unit === 'artist';
  const canAcquire = isArtist ? canGetArtist : canGetRelease;
  const offerGet = canGet(status);

  const actions: ResolvedAction[] = [
    {
      id: 'open',
      label: t(isArtist ? 'wants.openArtist' : 'wants.openAlbum'),
      icon: <ExternalLink size={sz} color={colors.secondary} />,
      onPress: run(onOpen),
      testID: 'want-option-open',
    },
  ];

  if (offerGet && canAcquire) {
    actions.push({
      id: 'get',
      // Retrying is the same request again — naming it "Get" after it failed
      // would leave the row looking like it had never been pressed.
      label: t(status.kind === 'failed' ? 'wants.retry' : 'wants.get'),
      icon: status.kind === 'failed'
        ? <RotateCw size={sz} color={colors.secondary} />
        : <CloudDownload size={sz} color={colors.secondary} />,
      onPress: run(() => { if (isArtist) void getArtist(want); else onGet(); }),
      testID: 'want-option-get',
    });
  } else if (offerGet) {
    actions.push({
      id: 'noServiceConnected',
      label: t('externalAlbum.menu.noServiceConnected'),
      icon: <CloudDownload size={sz} color={colors.muted} />,
      labelColor: colors.muted,
      onPress: run(() => promptConnectDownloader(isArtist ? 'artist' : 'album')),
      testID: 'want-option-connect',
    });
  }

  actions.push(
    {
      id: 'search',
      label: t('wants.searchAction'),
      icon: <Search size={sz} color={colors.secondary} />,
      onPress: run(onSearch),
      testID: 'want-option-search',
    },
    {
      id: 'remove',
      label: t('wants.remove'),
      icon: <X size={sz} color={statusColor.destructive} />,
      labelColor: statusColor.destructive,
      onPress: run(onRemove),
      testID: 'want-option-remove',
    }
  );

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="want-options-sheet"
      snapPoints={snapPoints}
      onChange={index => { if (index === -1) onClose(); }}
      header={{
        cover: want.cover ?? { kind: 'none' },
        title: want.title,
        subtitle: isArtist ? t('wants.artistLabel') : want.artist,
      }}
      actions={actions}
    />
  );
}
