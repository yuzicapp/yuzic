import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import { spacing, typography } from '@/constants/design';

type Props = {
  title: string;
  action?: React.ReactNode;
  subtle?: boolean;
};

const SettingsCardHeader: React.FC<Props> = ({ title, action, subtle }) => {
  const { colors } = useTheme();
  return (
    <View style={subtle ? styles.subtleHeader : styles.header}>
      <Text style={subtle
        ? [styles.subtleTitle, { color: colors.subtext }]
        : [styles.title, { color: colors.secondary }]
      }>{title}</Text>
      {action}
    </View>
  );
};

export default SettingsCardHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typography.sheetTitle,
  },
  subtleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.tight,
  },
  subtleTitle: {
    ...typography.caption,
  },
});
