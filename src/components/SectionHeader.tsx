import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import { spacing, typography } from '@/constants/design';

type Props = {
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SectionHeader({ title, badge, action, style }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, style]}>
      {badge}
      <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    marginBottom: spacing.md,
    gap: spacing.inlineGap,
  },
  title: {
    flex: 1,
    ...typography.sectionTitle,
  },
});
