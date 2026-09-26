import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle } from 'lucide-react-native';

import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { iconSize, spacing, statusColor, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import type { WantStatus } from './jobStatus';

/**
 * What a want row says about its job, on the subtitle line beside the artist.
 *
 * A saved want says nothing at all — the row is the statement, and a "Saved"
 * badge under every row on a wishlist screen is a word repeated as many times
 * as there are rows. Everything else is a state the listener did not ask for
 * and would otherwise have to guess at.
 */
export default function WantStatusBadge({ status }: { status: WantStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (status.kind === 'saved') return null;

  const label = status.kind === 'downloading'
    ? t('wants.status.downloading', { progress: status.progress })
    : t(`wants.status.${status.kind}`);

  const color = status.kind === 'failed'
    ? statusColor.destructive
    : status.kind === 'arrived'
      ? statusColor.success
      : colors.subtext;

  return (
    <View testID={`want-status-${status.kind}`} style={styles.badge}>
      {status.kind === 'queued' || status.kind === 'downloading' ? (
        <SpinningLoaderCircle size={iconSize.badge} color={color} />
      ) : status.kind === 'arrived' ? (
        <CheckCircle size={iconSize.badge} color={color} />
      ) : (
        <AlertCircle size={iconSize.badge} color={color} />
      )}
      <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: { ...typography.caption },
});
