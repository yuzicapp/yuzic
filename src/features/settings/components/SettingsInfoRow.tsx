import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import { spacing, typography } from '@/constants/design';

type Props = {
  label: string;
  value?: string;
  right?: React.ReactNode;
  stacked?: boolean;
};

const SettingsInfoRow: React.FC<Props> = ({ label, value, right, stacked }) => {
  const { colors } = useTheme();

  if (stacked) {
    return (
      <View style={styles.stackedRow}>
        <View style={styles.stackedLeft}>
          <Text style={[styles.stackedLabel, { color: colors.subtext }]}>{label}</Text>
          <Text style={[styles.stackedValue, { color: colors.secondary }]} numberOfLines={1}>
            {value ?? '—'}
          </Text>
        </View>
        {right && <View style={styles.stackedRight}>{right}</View>}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      {right ?? (
        <Text style={[styles.value, { color: colors.subtext }]} numberOfLines={1}>
          {value ?? '—'}
        </Text>
      )}
    </View>
  );
};

export default SettingsInfoRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.page,
  },
  label: {
    ...typography.rowTitle,
  },
  value: {
    ...typography.body,
    flexShrink: 1,
    textAlign: 'right',
  },
  stackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stackedLeft: {
    flex: 1,
  },
  stackedRight: {
    marginLeft: spacing.md,
  },
  stackedLabel: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  stackedValue: {
    ...typography.rowTitle,
  },
});
