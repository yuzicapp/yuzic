import { onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
type Props = {
  label: string;
  subtext?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
};

const SettingsToggleRow: React.FC<Props> = ({ label, subtext, value, onValueChange }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
        {subtext && (
          <Text style={[styles.subtext, { color: colors.subtext }]}>{subtext}</Text>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={subtext}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.themeColor }}
        thumbColor={onDark.text}
      />
    </View>
  );
};

export default SettingsToggleRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.page,
  },
  left: { flex: 1 },
  label: { ...typography.rowTitle },
  subtext: { ...typography.caption, marginTop: spacing.xxs },
});
