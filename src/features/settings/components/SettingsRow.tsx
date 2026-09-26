import { iconSize, onDark, radius, spacing, typography } from '@/constants/design';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Check, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/features/theme/useTheme';
import { SETTINGS_STATUS_COLORS } from '@/features/settings/constants';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

 type Props = {
  label: string;
  onPress: () => void;
  leftIcon?: React.ReactNode;
  rightText?: string;
  status?: 'connected' | 'disconnected' | 'enabled' | 'disabled';
  selected?: boolean;
  checked?: boolean;
  testID?: string;
};

const SettingsRow: React.FC<Props> = ({ label, onPress, leftIcon, rightText, status, selected, checked, testID }) => {
  const { colors } = useTheme();
  const rad = useRadius();
  const isRadio = selected !== undefined;
  const isCheckbox = checked !== undefined;

  return (
    <Touchable testID={testID} style={styles.row} onPress={onPress}>
      <View style={styles.left}>
        {leftIcon && (
          <View style={styles.iconContainer}>
            {leftIcon}
          </View>
        )}
        <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      </View>
      <View style={styles.right}>
        {status && (
          <View style={[styles.statusDot, { backgroundColor: SETTINGS_STATUS_COLORS[status], borderRadius: rad.pill }]} />
        )}
        {rightText && (
          <Text style={[styles.rightText, { color: colors.subtext }]} numberOfLines={1}>
            {rightText}
          </Text>
        )}
        {isRadio ? (
          <View style={[styles.radio, { borderColor: selected ? colors.themeColor : colors.border, borderRadius: rad.pill }]}>
            {selected && <View style={[styles.radioFill, { backgroundColor: colors.themeColor, borderRadius: rad.pill }]} />}
          </View>
        ) : isCheckbox ? (
          <View style={[
            styles.checkbox,
            checked
              ? { backgroundColor: colors.themeColor, borderColor: colors.themeColor }
              : { borderColor: colors.border },
          ]}>
            {checked && <Check size={iconSize.badge} color={onDark.text} strokeWidth={3} />}
          </View>
        ) : (
          <ChevronRight size={iconSize.row} color={colors.border} />
        )}
      </View>
    </Touchable>
  );
};

export default SettingsRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  label: { ...typography.rowTitle },
  // A long summary ("Last.fm, Cover Art Archive, LRCLIB") shortens itself
  // rather than the label, and never takes more than a little over half the row.
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    flexShrink: 1,
    maxWidth: '55%',
  },
  statusDot: {
    width: 8,
    height: 8,
  },
  rightText: { ...typography.rowSubtitle, flexShrink: 1 },
  radio: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
