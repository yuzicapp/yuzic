import React, { useEffect, useMemo } from 'react';
import { Pencil, Share2, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import type { ResolvedAction } from '@/features/entity-actions/types';
import { useSheetRef } from '@/components/useSheetRef';
import { useTheme } from '@/features/theme/useTheme';
import { iconSize, statusColor } from '@/constants/design';
import type { Share } from '@/providers/contracts/ServerAdapter';

const sz = iconSize.loader;

/**
 * One shared link's options.
 *
 * The three things you can do with a link used to be three icons on the row —
 * share, edit, revoke — one of which destroys it for everyone holding it. They
 * are rows in the same sheet every other list on the app puts its actions in.
 */
export function ShareLinkOptions({
  share,
  onClose,
  onShare,
  onEdit,
  onRevoke,
}: {
  share: Share;
  onClose: () => void;
  onShare: () => void;
  onEdit: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sheetRef = useSheetRef();
  const snapPoints = useMemo(() => ['35%'], []);

  useEffect(() => { sheetRef.current?.present(); }, [sheetRef]);

  const run = (action: () => void) => () => { sheetRef.current?.dismiss(); action(); };

  const actions: ResolvedAction[] = [
    {
      id: 'share',
      label: t('shares.share'),
      icon: <Share2 size={sz} color={colors.secondary} />,
      onPress: run(onShare),
      testID: 'share-option-share',
    },
    {
      id: 'edit',
      label: t('shares.edit'),
      icon: <Pencil size={sz} color={colors.secondary} />,
      onPress: run(onEdit),
      testID: 'share-option-edit',
    },
    {
      id: 'revoke',
      label: t('shares.revoke'),
      icon: <Trash2 size={sz} color={statusColor.destructive} />,
      labelColor: statusColor.destructive,
      onPress: run(onRevoke),
      testID: 'share-option-revoke',
    },
  ];

  return (
    <EntityOptionsSheet
      ref={sheetRef}
      testID="share-options-sheet"
      snapPoints={snapPoints}
      onChange={index => { if (index === -1) onClose(); }}
      header={{ cover: { kind: 'none' }, title: share.description || share.url, subtitle: share.url }}
      actions={actions}
    />
  );
}
