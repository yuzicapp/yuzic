import React, { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Check } from 'lucide-react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/sheetScaffold';
import Touchable from '@/components/Touchable';
import { iconSize, spacing, typography } from '@/constants/design';
import { withAlpha } from '@/features/theme/coverAccent';

export type SingleSelectOption = {
  value: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
};

type Props = {
  selected: string;
  options: SingleSelectOption[];
  title: string;
  onSelect: (value: string) => void;
  testID?: string;
};

/**
 * Pick one of a handful of named options.
 *
 * Sized by its own content, like every other sheet in the app. It used to
 * take a `snapPoint` percentage from each caller — "35%" for languages, "48%"
 * for sort orders — which is the caller guessing at the height of a list it
 * does not lay out: adding a fifth language would have left the last row cut
 * off, and neither number matched the other's row count anyway.
 */
const SingleSelectBottomSheet = forwardRef<BottomSheetModal, Props>(
  ({ selected, options, title, onSelect, testID }, ref) => {
    const { colors } = useTheme();
    const themeColor = colors.themeColor;
    const rad = useRadius();
    const sheetBg = useOptionSheetBackground();
    const sheetContent = useOptionSheetContentStyle();

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        stackBehavior="push"
        backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView testID={testID} style={[sheetBg, sheetContent]}>
          <Text style={[styles.sheetTitle, { color: colors.secondary }]}>{title}</Text>
          {options.map(option => {
            const isSelected = selected === option.value;
            return (
              <Touchable
                key={option.value}
                testID={`single-select-${option.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[styles.pickerItem, {
                  backgroundColor: isSelected ? withAlpha(themeColor, 0.13) : 'transparent',
                  borderRadius: rad.md,
                }]}
                onPress={() => onSelect(option.value)}
              >
                <View style={styles.pickerLeft}>
                  <option.Icon size={iconSize.row} color={isSelected ? themeColor : colors.subtext} />
                  <Text style={[styles.pickerText, { color: colors.secondary, fontWeight: isSelected ? '600' : '400' }]}>
                    {option.label}
                  </Text>
                </View>
                {isSelected && <Check size={iconSize.control} color={themeColor} />}
              </Touchable>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

SingleSelectBottomSheet.displayName = 'SingleSelectBottomSheet';
export default SingleSelectBottomSheet;

const styles = StyleSheet.create({
  sheetTitle: { ...typography.sheetTitle, marginBottom: spacing.controlGap },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  pickerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.controlGap },
  pickerText: { ...typography.body },
});
