import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';

import Touchable from '@/components/Touchable';
import { controlSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';

/**
 * The pieces under a detail hero's title: the meta line (year, count, length)
 * and the row of actions (shuffle, play, download) beneath it.
 */

type DetailMetaRowProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function DetailMetaRow({ children, style }: DetailMetaRowProps) {
  return <View style={[styles.metaRow, style]}>{children}</View>;
}

export function DetailMetaDot() {
  const { colors } = useTheme();
  return (
    <Text style={[styles.metaDot, { color: colors.subtext }]} numberOfLines={1}>
      •
    </Text>
  );
}

type DetailMetaTextProps = {
  children: React.ReactNode;
};

export function DetailMetaText({ children }: DetailMetaTextProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.subtext, { color: colors.subtext }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

type DetailActionRowProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function DetailActionRow({ children, style }: DetailActionRowProps) {
  return (
    <View style={[styles.actionsRow, style]}>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

type DetailCircleActionProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

export function DetailCircleAction({ children, onPress, disabled, style, accessibilityLabel }: DetailCircleActionProps) {
  const { colors } = useTheme();
  const rad = useRadius();
  return (
    <Touchable
      style={[
        styles.secondaryButton,
        { backgroundColor: colors.card, borderRadius: rad.pillFor(controlSize.detailSecondary) },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {children}
    </Touchable>
  );
}

type DetailPlayActionProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

export function DetailPlayAction({ children, onPress, disabled, style, accessibilityLabel }: DetailPlayActionProps) {
  const { colors } = useTheme();
  const rad = useRadius();
  return (
    <Touchable
      style={[
        styles.playButton,
        { backgroundColor: colors.themeColor, borderRadius: rad.pillFor(controlSize.detailPrimaryHeight) },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {children}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  subtext: {
    ...typography.rowSubtitle,
  },
  metaDot: {
    ...typography.rowSubtitle,
    marginHorizontal: spacing.tight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexWrap: 'nowrap',
    maxWidth: '94%',
    marginTop: spacing.xs,
  },
  actionsRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.controlGap,
  },
  secondaryButton: {
    width: controlSize.detailSecondary,
    height: controlSize.detailSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: controlSize.detailPrimaryWidth,
    height: controlSize.detailPrimaryHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
