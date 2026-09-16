import React, { useEffect, useMemo } from 'react';
import { Pencil, Play, Plus, RefreshCw, SquareArrowOutUpRight, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import type { ResolvedAction } from '@/features/entity-actions/types';
import { useSheetRef } from '@/components/useSheetRef';
import { useTheme } from '@/features/theme/useTheme';
import { iconSize, statusColor } from '@/constants/design';
import type { CoverSource } from '@/domain/entities/Cover';
import type { InternetRadioStation } from '@/providers/contracts/ServerAdapter';

/** A stream has no artwork, and the sheet says so the same way every row does. */
const NO_COVER: CoverSource = { kind: 'none' };

const sz = iconSize.loader;

/**
 * Radio's two options sheets.
 *
 * Radio used to be the one browsing screen with its actions drawn as bare
 * icons — a "+" on the bar and a pencil and a bin on every row — where every
 * other detail screen puts them behind a "…". These are the same
 * `EntityOptionsSheet` shell the album, artist, playlist and genre sheets use;
 * a station is not a domain entity (it has no library state, no provenance and
 * nothing to queue), so the rows are built here rather than through the
 * entity-actions registry, which is keyed to the four entity kinds.
 *
 * Both present themselves on mount and report their dismissal, so the screen
 * renders one when there is something to act on and drops it afterwards —
 * matching `FormSheet` next door rather than holding a ref per row.
 */
function useSelfPresenting(onClose: () => void) {
  const sheetRef = useSheetRef();
  useEffect(() => { sheetRef.current?.present(); }, [sheetRef]);
  return {
    sheetRef,
    onChange: (index: number) => { if (index === -1) onClose(); },
    /** Runs the action after the sheet is on its way out, never underneath it. */
    run: (action: () => void) => () => { sheetRef.current?.dismiss(); action(); },
  };
}

type StationProps = {
  station: InternetRadioStation;
  onClose: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onOpenHomepage: () => void;
  onDelete: () => void;
};

export function RadioStationOptions({
  station,
  onClose,
  onPlay,
  onEdit,
  onOpenHomepage,
  onDelete,
}: StationProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { sheetRef, onChange, run } = useSelfPresenting(onClose);
  const snapPoints = useMemo(() => ['40%'], []);

  const actions: ResolvedAction[] = [
    {
      id: 'play',
      label: t('radio.play'),
      icon: <Play size={sz} color={colors.secondary} fill={colors.secondary} />,
      onPress: run(onPlay),
      testID: 'radio-option-play',
    },
    {
      id: 'edit',
      label: t('radio.editTitle'),
      icon: <Pencil size={sz} color={colors.secondary} />,
      onPress: run(onEdit),
      testID: 'radio-option-edit',
    },
    // Only where the station has one: a row that opens nothing is worse than
    // no row, and most stations carry no homepage at all.
    ...(station.homepageUrl ? [{
      id: 'homepage',
      label: t('radio.openHomepage'),
      icon: <SquareArrowOutUpRight size={sz} color={colors.secondary} />,
      onPress: run(onOpenHomepage),
      testID: 'radio-option-homepage',
    }] : []),
    {
      id: 'delete',
      label: t('radio.delete'),
      icon: <Trash2 size={sz} color={statusColor.destructive} />,
      labelColor: statusColor.destructive,
      onPress: run(onDelete),
      testID: 'radio-option-delete',
    },
  ];

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="radio-station-options-sheet"
      snapPoints={snapPoints}
      onChange={onChange}
      header={{ cover: NO_COVER, title: station.name, subtitle: station.streamUrl }}
      actions={actions}
    />
  );
}

type ListProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onAdd: () => void;
  onRefresh: () => void;
};

/** The screen's own "…": what applies to the list rather than to one station. */
export function RadioListOptions({ title, subtitle, onClose, onAdd, onRefresh }: ListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { sheetRef, onChange, run } = useSelfPresenting(onClose);
  const snapPoints = useMemo(() => ['30%'], []);

  const actions: ResolvedAction[] = [
    {
      id: 'add',
      label: t('radio.add'),
      icon: <Plus size={sz} color={colors.secondary} />,
      onPress: run(onAdd),
      testID: 'radio-option-add',
    },
    {
      id: 'refresh',
      label: t('radio.refresh'),
      icon: <RefreshCw size={sz} color={colors.secondary} />,
      onPress: run(onRefresh),
      testID: 'radio-option-refresh',
    },
  ];

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="radio-list-options-sheet"
      snapPoints={snapPoints}
      onChange={onChange}
      header={{ cover: NO_COVER, title, subtitle }}
      actions={actions}
    />
  );
}
