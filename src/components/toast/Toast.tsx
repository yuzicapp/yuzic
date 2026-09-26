import { shadow, spacing, tinted, typography } from '@/constants/design';
import { useIconSize } from '@/features/theme/useIconSize';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { AlertCircle, Check, Info } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { useRadius } from '@/features/theme/useRadius';
import { useReducedMotion } from '@/features/theme/useReducedMotion';
import { useTheme } from '@/features/theme/useTheme';
import type { Toast as ToastModel, ToastVariant } from './notify';

type Props = {
  toast: ToastModel;
  onDismiss: (id: string) => void;
};

const SWIPE_DISMISS_DISTANCE = 64;
const ENTER_MS = 220;
const EXIT_MS = 160;

const accentFor = (variant: ToastVariant, colors: ReturnType<typeof useTheme>['colors']): string => {
  switch (variant) {
    case 'success': return colors.success;
    case 'error': return colors.error;
    default: return colors.themeColor;
  }
};

const VariantIcon: React.FC<{ variant: ToastVariant; color: string }> = ({ variant, color }) => {
  const icons = useIconSize();
  if (variant === 'loading') return <SpinningLoaderCircle size={icons.row} color={color} />;
  if (variant === 'success') return <Check size={icons.inline} color={color} />;
  if (variant === 'error') return <AlertCircle size={icons.inline} color={color} />;
  return <Info size={icons.inline} color={color} />;
};

/**
 * One toast row. Enters with a short fade+rise, leaves the same way, and can be
 * flicked sideways to dismiss. All motion collapses to an instant swap when the
 * user asks for reduced motion.
 */
const Toast: React.FC<Props> = ({ toast, onDismiss }) => {
  const { colors } = useTheme();
  const rad = useRadius();
  const reduceMotion = useReducedMotion();
  const accent = accentFor(toast.variant, colors);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(reduceMotion ? 0 : 12);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
    } else {
      opacity.value = withTiming(1, { duration: ENTER_MS });
      translateY.value = withTiming(0, { duration: ENTER_MS });
    }
  }, [opacity, reduceMotion, translateY]);

  const close = () => onDismiss(toast.id);

  const animateOut = () => {
    'worklet';
    if (reduceMotion) {
      runOnJS(close)();
      return;
    }
    opacity.value = withTiming(0, { duration: EXIT_MS }, finished => {
      if (finished) runOnJS(close)();
    });
  };

  // Auto-dismiss timer (skipped for Infinity / loading).
  useEffect(() => {
    if (!Number.isFinite(toast.duration)) return;
    const handle = setTimeout(close, toast.duration);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(event => {
      translateX.value = event.translationX;
    })
    .onEnd(event => {
      if (Math.abs(event.translationX) > SWIPE_DISMISS_DISTANCE) {
        translateX.value = withTiming(Math.sign(event.translationX) * 400, { duration: EXIT_MS });
        opacity.value = withTiming(0, { duration: EXIT_MS }, finished => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateX.value = withTiming(0, { duration: EXIT_MS });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID={`toast-${toast.variant}`}
        accessibilityRole="alert"
        style={[
          styles.container,
          animatedStyle,
          { backgroundColor: colors.toastSurface, borderRadius: rad.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tinted(accent, 'toastIcon'), borderRadius: rad.pill }]}>
          <VariantIcon variant={toast.variant} color={accent} />
        </View>
        <Text style={[styles.message, { color: colors.secondary }]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.action && (
          <Touchable
            testID="toast-action"
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            style={styles.action}
            onPress={() => {
              toast.action?.onPress();
              animateOut();
            }}
          >
            <Text style={[styles.actionText, { color: accent }]}>{toast.action.label}</Text>
          </Touchable>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

export default Toast;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    ...shadow.toast,
  },
  iconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  message: { ...typography.rowSubtitle, flex: 1, minWidth: 0 },
  action: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  actionText: { ...typography.button },
});
