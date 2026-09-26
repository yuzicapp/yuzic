import { controlSize, hitSlopFor, stateLayer } from '@/constants/design';
import React from 'react';
import {
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useRadius } from '@/features/theme/useRadius';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';

type Props = {
  icon: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  size?: 'compact' | 'default';
  style?: StyleProp<ViewStyle>;
};

export default function IconActionButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  loading,
  size = 'default',
  style,
}: Props) {
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const isDisabled = disabled || loading;
  // Only the Android ripple is bounded by this — the button has no background
  // of its own — but a round ripple under a squared-off preset is the same
  // half-applied look the play button had.
  const boundsSize = size === 'compact' ? controlSize.iconCompact : controlSize.iconDefault;

  return (
    <Touchable
      style={[
        styles.button,
        size === 'compact' ? styles.compact : styles.default,
        { borderRadius: rad.pillFor(boundsSize) },
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={hitSlopFor(boundsSize)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? <SpinningLoaderCircle size={icons.row} color={colors.subtext} /> : icon}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  default: {
    width: controlSize.iconDefault,
    height: controlSize.iconDefault,
  },
  compact: {
    width: controlSize.iconCompact,
    height: controlSize.iconCompact,
  },
  disabled: {
    opacity: stateLayer.inactiveOpacity,
  },
});
