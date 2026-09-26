import { onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCard from './SettingsCard';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

type IconSelectItem = {
  id: string;
  icon: React.ReactElement<{ color?: string }>;
  /** What this option is called. The card draws options as bare glyphs, so
   *  without it the whole row reads as a set of unnamed buttons. */
  label: string;
};

type Props = {
  title: string;
  /** An explanation under the title, for a card whose options are bare glyphs
   *  and cannot say what the setting is for on their own. */
  subtitle?: string;
  items: IconSelectItem[];
  selected: string;
  onSelect: (id: string) => void;
  /**
   * Draw each option's name beside its glyph. For a short set whose glyphs do
   * not say what they are on their own; a row of six has no room for words.
   */
  showLabels?: boolean;
};

const SettingsIconSelectCard: React.FC<Props> = ({ title, subtitle, items, selected, onSelect, showLabels }) => {
  const { colors } = useTheme();
  const rad = useRadius();

  return (
    <SettingsCard>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.secondary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.subtext }]}>{subtitle}</Text>
        ) : null}
        <View style={styles.row} accessibilityRole="radiogroup">
          {items.map(item => {
            const active = selected === item.id;
            return (
              <Touchable
                key={item.id}
                accessibilityRole="radio"
                // A drawn name is read as it is; only a bare glyph needs a label.
                accessibilityLabel={showLabels ? undefined : item.label}
                accessibilityState={{ selected: active, checked: active }}
                onPress={() => onSelect(item.id)}
                style={[
                  styles.button,
                  {
                    backgroundColor: active ? colors.themeColor : colors.muted,
                    borderColor: active ? colors.themeColor : colors.border,
                    borderRadius: rad.md,
                  },
                ]}
              >
                {React.cloneElement(item.icon, {
                  color: active ? onDark.text : colors.secondary,
                })}
                {showLabels && (
                  <Text
                    style={[styles.optionLabel, { color: active ? onDark.text : colors.secondary }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                )}
              </Touchable>
            );
          })}
        </View>
      </View>
    </SettingsCard>
  );
};

export default SettingsIconSelectCard;

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  title: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: spacing.controlGap,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.sm,
  },
  optionLabel: {
    ...typography.caption,
    fontWeight: '600',
    flexShrink: 1,
  },
});
