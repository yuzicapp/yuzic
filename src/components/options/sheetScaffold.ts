import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { spacing } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';

/**
 * The shell every bottom sheet wears: its surface, its corners, its padding.
 *
 * Separate from `OptionSheetPrimitives` because that module is a set of
 * *components* — a header with artwork in it, a row, a spinner — and pulls in
 * the image stack behind them. A sheet that only needs the shell (a
 * single-select list, a form) was importing all of it to ask what colour to
 * paint its background, which is how a language picker's test ended up
 * loading the app's i18n bootstrap. The shell has no components in it and
 * imports nothing heavier than the design tokens.
 */

/** Shared scaffold styles for BottomSheetModal-based option sheets.
 *  Top corners are applied through {@link useOptionSheetBackground} so they
 *  follow the user's radius preset. */
export const optionSheetStyles = StyleSheet.create({
  sheetBackground: {},
  sheetContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.generous,
  },
});

/** Sheet surface color + top-corner radii scaled by the user's preset. */
export function useOptionSheetBackground() {
  const { isDarkMode, colors } = useTheme();
  const rad = useRadius();
  return {
    backgroundColor: isDarkMode ? colors.card : colors.background,
    borderTopLeftRadius: rad.lg,
    borderTopRightRadius: rad.lg,
  };
}

/**
 * The content padding every sheet body uses.
 *
 * `optionSheetStyles.sheetContent` is a flat 32pt at the bottom, which was
 * written when sheets were short enough that the home indicator landed in
 * empty space below the last row. A sheet whose last row reaches the bottom
 * — the sleep timer's "Turn off", an output device — puts a pressable under
 * the indicator instead. This clears it on the devices that have one and
 * changes nothing on the devices that don't, so it is the padding to reach
 * for rather than the flat style.
 */
export function useOptionSheetContentStyle() {
  const bottomInset = useSheetBottomInset();
  return {
    padding: spacing.lg,
    paddingBottom: Math.max(spacing.xxl, bottomInset + spacing.lg),
  };
}

/**
 * How much the home indicator takes off the bottom of a sheet.
 *
 * The context rather than `useSafeAreaInsets()`, which *throws* when there is
 * no `SafeAreaProvider` above it — and a sheet is routinely rendered without
 * one, by every test that mounts it and by the sheet library's own mock. No
 * provider means no inset to clear, which is a number (zero), not an error.
 */
export function useSheetBottomInset(): number {
  return React.useContext(SafeAreaInsetsContext)?.bottom ?? 0;
}
