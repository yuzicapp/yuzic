import { onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { LogOut } from 'lucide-react-native';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  label: string;
  onPress: () => void;
};

const SettingsDisconnectButton: React.FC<Props> = ({ label, onPress }) => {
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();

  return (
    <Touchable style={[styles.button, { backgroundColor: colors.destructive, borderRadius: rad.md }]} onPress={onPress}>
      <LogOut size={icons.row} color={onDark.text} />
      <Text style={styles.label}>{label}</Text>
    </Touchable>
  );
};

export default SettingsDisconnectButton;

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.sheetTitle,
    color: onDark.text,
  },
});
