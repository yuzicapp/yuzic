import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from 'lucide-react-native';

import MediaListRow from '@/components/MediaListRow';
import Touchable from '@/components/Touchable';
import { hitSlopFor, iconSize, spacing } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import type { Want } from '@/state/redux/slices/wantsSlice';
import WantStatusBadge from './WantStatusBadge';
import type { WantStatus } from './jobStatus';

/**
 * One saved want, drawn the way every other list row in the app is drawn.
 *
 * It carries real artwork, which it could not before: the cover is the one
 * the want saved, and `MediaListRow` resolves it through the app's single
 * picture rule — the record's own image, the library's copy of it, then the
 * artwork backups. Nothing is looked up here.
 *
 * Pressing it opens the catalogue screen for the thing wanted, which is the
 * question a wishlist row raises and had no answer to. The "…" carries
 * everything else, so the row itself has exactly one meaning, and nothing
 * destructive sits a stray tap away from it — the row used to wear a bare "×".
 */
export default function WantRow({
  want,
  status,
  onPress,
  onOptions,
}: {
  want: Want;
  status: WantStatus;
  onPress: () => void;
  onOptions: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <MediaListRow
      testID="want-row"
      title={want.title}
      subtitle={want.unit === 'artist' ? t('wants.artistLabel') : want.artist}
      cover={want.cover ?? { kind: 'none' }}
      // An artist is a circle at every radius preset — it is how you tell one
      // from a record at a glance, here as in the library.
      roundedCover={want.unit === 'artist'}
      onPress={onPress}
      subtitleTrailing={<WantStatusBadge status={status} />}
      trailing={
        <Touchable
          testID="want-options"
          accessibilityRole="button"
          accessibilityLabel={t('a11y.rows.options', { title: want.title })}
          hitSlop={hitSlopFor(iconSize.row)}
          onPress={onOptions}
          style={styles.optionsButton}
          feedback="control"
        >
          <Ellipsis size={iconSize.row} color={colors.subtext} />
        </Touchable>
      }
    />
  );
}

const styles = StyleSheet.create({
  optionsButton: {
    padding: spacing.sm,
  },
});
