import { onDark, spacing, typography } from '@/constants/design';
import React, { memo } from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
type ToggleItem = {
  label: string;
  subtext: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
};

type Props = {
  items: ToggleItem[];
};

const SettingsToggleGroup: React.FC<Props> = ({ items }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* The labels sit in their own column so the switches line up down the
          right edge, which means a screen reader reads every label first and
          every switch afterwards, with position the only thing tying one list
          to the other. Each switch therefore carries its own label and hint.
          Hiding this column instead would put the association beyond doubt,
          but it also takes the text out of the tree, so exploring the screen
          by touch finds nothing where the label is plainly drawn. */}
      <View style={styles.labels}>
        {items.map((item, i) => (
          <View key={i} style={styles.item}>
            <Text style={[styles.label, { color: colors.secondary }]}>{item.label}</Text>
            <Text style={[styles.subtext, { color: colors.subtext }]}>{item.subtext}</Text>
          </View>
        ))}
      </View>
      <View style={styles.switches}>
        {items.map((item, i) => (
          <View key={i} style={styles.item}>
            <Switch
              accessibilityLabel={item.label}
              accessibilityHint={item.subtext}
              value={item.value}
              onValueChange={item.onValueChange}
              trackColor={{ true: colors.themeColor }}
              thumbColor={onDark.text}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

export default memo(SettingsToggleGroup);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  labels: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  switches: {
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.controlGap,
  },
  label: {
    ...typography.rowTitle,
  },
  subtext: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
});
