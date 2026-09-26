import React from 'react';
import { useRadius } from '@/features/theme/useRadius';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/features/theme/useTheme';
import { controlSize, spacing, typography } from '@/constants/design';
import { useBottomOverlayHeight } from '@/features/theme/useScrollClearance';
import Touchable from './Touchable';

type Props = {
  /** Drawn above the message. Sized 40 by convention at this scale. */
  icon?: React.ReactNode;
  message: string;
  /** A way out of the state — "Try again" on an error, "Add one" on an empty
   * list. Omitted when there is nothing useful for the finger to do. */
  action?: { label: string; onPress: () => void };
};

/**
 * The centred icon-and-message block a list falls back to when it has nothing
 * to show.
 *
 * Radio, Podcasts and Shares each had a byte-identical copy of this, plus a
 * fourth and fifth shape on Genres and the library collections — five answers
 * to one question. An empty list and a failed fetch are different states and
 * should read differently, which is what `action` is for: an empty list says
 * what to do next, a failed one offers a retry.
 */
const EmptyState: React.FC<Props> = ({ icon, message, action }) => {
  const rad = useRadius();
  const { colors } = useTheme();
  const bottomOverlayHeight = useBottomOverlayHeight();

  return (
    <View testID="empty-state" style={[styles.container, { paddingBottom: bottomOverlayHeight }]}>
      {icon}
      <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>
      {action ? (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.action, { borderColor: colors.border, borderRadius: rad.pillFor(controlSize.minimumTarget) }]}
        >
          <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
        </Touchable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  message: { ...typography.rowSubtitle, textAlign: 'center' },
  action: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { ...typography.button },
});

export default EmptyState;
