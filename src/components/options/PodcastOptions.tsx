import React, { useEffect, useMemo } from 'react';
import { ArrowDownCircle, Play, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import type { ResolvedAction } from '@/features/entity-actions/types';
import { useSheetRef } from '@/components/useSheetRef';
import { useTheme } from '@/features/theme/useTheme';
import { iconSize, statusColor } from '@/constants/design';
import type { PodcastChannel, PodcastEpisode } from '@/providers/contracts/ServerAdapter';

const sz = iconSize.loader;

/** Shared by the three podcast sheets: present on mount, report dismissal. */
function useSelfPresenting(onClose: () => void) {
  const sheetRef = useSheetRef();
  useEffect(() => { sheetRef.current?.present(); }, [sheetRef]);
  return {
    sheetRef,
    onChange: (index: number) => { if (index === -1) onClose(); },
    run: (action: () => void) => () => { sheetRef.current?.dismiss(); action(); },
  };
}

/** The Podcasts screen's own "…": subscribe, or ask the server to re-read every feed. */
export function PodcastListOptions({
  subtitle,
  onClose,
  onAdd,
  onRefresh,
}: {
  subtitle?: string;
  onClose: () => void;
  onAdd: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { sheetRef, onChange, run } = useSelfPresenting(onClose);
  const snapPoints = useMemo(() => ['30%'], []);

  const actions: ResolvedAction[] = [
    {
      id: 'add',
      label: t('podcasts.add'),
      icon: <Plus size={sz} color={colors.secondary} />,
      onPress: run(onAdd),
      testID: 'podcast-option-add',
    },
    {
      id: 'refresh',
      label: t('podcasts.refresh'),
      icon: <RefreshCw size={sz} color={colors.secondary} />,
      onPress: run(onRefresh),
      testID: 'podcast-option-refresh',
    },
  ];

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="podcast-list-options-sheet"
      snapPoints={snapPoints}
      onChange={onChange}
      header={{ cover: { kind: 'none' }, title: t('podcasts.title'), subtitle }}
      actions={actions}
    />
  );
}

/**
 * One show's options.
 *
 * Opening the show is not a row: pressing the row itself already does that on
 * the list, and on the show's own screen there is nowhere to open.
 */
export function PodcastChannelOptions({
  channel,
  onClose,
  onUnsubscribe,
}: {
  channel: PodcastChannel;
  onClose: () => void;
  onUnsubscribe: () => void;
}) {
  const { t } = useTranslation();
  const { sheetRef, onChange, run } = useSelfPresenting(onClose);
  const snapPoints = useMemo(() => ['30%'], []);

  const actions: ResolvedAction[] = [
    {
      id: 'unsubscribe',
      label: t('podcasts.unsubscribe'),
      icon: <Trash2 size={sz} color={statusColor.destructive} />,
      labelColor: statusColor.destructive,
      onPress: run(onUnsubscribe),
      testID: 'podcast-option-unsubscribe',
    },
  ];

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="podcast-channel-options-sheet"
      snapPoints={snapPoints}
      onChange={onChange}
      header={{ cover: channel.cover, title: channel.title, subtitle: channel.description ?? undefined }}
      actions={actions}
    />
  );
}

/**
 * One episode's options.
 *
 * Play and Download stay on the row itself — they are the row's point, and an
 * episode you cannot play yet is the one thing this screen is for. What moves
 * here is deleting the server's copy, which used to be a bin sitting next to
 * the play button.
 */
export function PodcastEpisodeOptions({
  episode,
  channelTitle,
  onClose,
  onPlay,
  onDownload,
  onDelete,
}: {
  episode: PodcastEpisode;
  channelTitle: string;
  onClose: () => void;
  onPlay?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { sheetRef, onChange, run } = useSelfPresenting(onClose);
  const snapPoints = useMemo(() => ['35%'], []);

  const actions: ResolvedAction[] = [
    ...(onPlay ? [{
      id: 'play',
      label: t('podcasts.play'),
      icon: <Play size={sz} color={colors.secondary} fill={colors.secondary} />,
      onPress: run(onPlay),
      testID: 'episode-option-play',
    }] : []),
    ...(onDownload ? [{
      id: 'download',
      label: t('podcasts.download'),
      icon: <ArrowDownCircle size={sz} color={colors.secondary} />,
      onPress: run(onDownload),
      testID: 'episode-option-download',
    }] : []),
    ...(onDelete ? [{
      id: 'delete',
      label: t('podcasts.deleteEpisode'),
      icon: <Trash2 size={sz} color={statusColor.destructive} />,
      labelColor: statusColor.destructive,
      onPress: run(onDelete),
      testID: 'episode-option-delete',
    }] : []),
  ];

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="podcast-episode-options-sheet"
      snapPoints={snapPoints}
      onChange={onChange}
      header={{ cover: episode.cover, title: episode.title, subtitle: channelTitle, titleLines: 2 }}
      actions={actions}
    />
  );
}
