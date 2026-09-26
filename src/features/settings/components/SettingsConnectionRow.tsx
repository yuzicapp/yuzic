import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { ChevronRight } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import { SETTINGS_STATUS_COLORS } from '@/features/settings/constants';
import { iconSize, spacing, tinted, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';

type ConnectionStatus = 'connected' | 'disconnected' | 'enabled' | 'disabled';

type Props = {
  label: string;
  summary: string;
  status: ConnectionStatus;
  statusLabel: string;
  onPress: () => void;
  icon?: React.ReactNode;
  testID?: string;
};

/** A readable provider-registry row: purpose, state, and destination. */
const SettingsConnectionRow: React.FC<Props> = ({
  label,
  summary,
  status,
  statusLabel,
  onPress,
  icon,
  testID,
}) => {
  const { colors } = useTheme();
  const rad = useRadius();

  return (
    <Touchable testID={testID} style={styles.row} onPress={onPress}>
      <View style={styles.leading}>
        {icon && (
          <View style={[styles.icon, { backgroundColor: tinted(colors.themeColor, 'surface'), borderRadius: rad.pill }]}>
            {icon}
          </View>
        )}
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
          <Text style={[styles.summary, { color: colors.subtext }]} numberOfLines={1}>{summary}</Text>
        </View>
      </View>
      <View style={styles.trailing}>
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: SETTINGS_STATUS_COLORS[status], borderRadius: rad.pill }]} />
          <Text style={[styles.statusLabel, { color: colors.subtext }]}>{statusLabel}</Text>
        </View>
        <ChevronRight size={iconSize.row} color={colors.border} />
      </View>
    </Touchable>
  );
};

export default SettingsConnectionRow;

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 70,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  leading: { alignItems: 'center', flex: 1, flexDirection: 'row', minWidth: 0 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 32, height: 32, marginRight: spacing.md },
  copy: { flex: 1 },
  label: { ...typography.rowTitle },
  summary: { ...typography.caption, marginTop: spacing.xxs },
  trailing: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  status: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  statusDot: { width: 8, height: 8 },
  statusLabel: { ...typography.caption, fontWeight: '600' },
});
