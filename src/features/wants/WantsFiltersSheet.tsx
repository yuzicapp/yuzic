import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';

import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import { useSheetRef } from '@/components/useSheetRef';
import {
  OptionSheetRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { iconSize, spacing, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';

export type WantsPickOption = {
  value: string;
  label: string;
  Icon?: React.ComponentType<{ size: number; color: string }>;
};

/** What the screen can do to this sheet: open it. */
export type WantsPickHandle = {
  present: () => void;
};

type Props = {
  title: string;
  selected: string;
  options: WantsPickOption[];
  onSelect: (value: string) => void;
  testID?: string;
};

/**
 * Pick one option — which kinds of want to show, or how to order them.
 *
 * **Opened imperatively, and mounted for as long as the screen is.**
 *
 * It used to mount only while open and present itself from an effect, which
 * made opening depend on a *state change*: the screen flipped `picking` to
 * `'filter'` and the new mount presented. That silently failed whenever
 * `picking` was already `'filter'` — press an option and the sheet starts
 * dismissing, but `picking` only clears when that animation *finishes*, so a
 * press landing in between set the state to the value it already held. React
 * bails out of an identical state, nothing re-mounted, nothing presented, and
 * the press did nothing at all. That is the filter pill that sometimes does
 * not open.
 *
 * `present()` has no such precondition — it opens the sheet whatever the
 * screen last did — so there is no transition left to miss.
 *
 * Staying mounted is only safe because this is memoised and every prop it
 * takes is stable: a live `BottomSheetModal` that re-renders mid-dismiss
 * re-measures its content under `enableDynamicSizing` and cancels its own
 * dismissal. See `WantsScreen` for where that stability comes from.
 */
const WantsPickSheet = forwardRef<WantsPickHandle, Props>(function WantsPickSheet(
  { title, selected, options, onSelect, testID },
  ref
) {
  const { colors } = useTheme();
  const sheetRef = useSheetRef();
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }), [sheetRef]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView testID={testID} style={[sheetBg, sheetContent]}>
        <Text style={[styles.title, { color: colors.secondary }]}>{title}</Text>
        {options.map(option => (
          <OptionSheetRow
            key={option.value}
            testID={`wants-pick-${option.value}`}
            label={option.label}
            icon={
              option.Icon
                ? <option.Icon size={iconSize.row} color={colors.subtext} />
                : undefined
            }
            // Dismiss first, then answer: the list being reordered or filtered
            // is behind the sheet, and a sheet that stays up after answering
            // its own question leaves the reader tapping the backdrop.
            onPress={() => {
              sheetRef.current?.dismiss();
              onSelect(option.value);
            }}
            trailing={
              option.value === selected
                ? <Check size={iconSize.secondary} color={colors.themeColor} />
                : undefined
            }
          />
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

/**
 * Memoised, and every prop it is given is stable — see `WantsScreen`.
 *
 * Wants re-renders on every downloader poll: the queue snapshot is rebuilt
 * unconditionally, so the context value changes and this screen with it. A
 * live `BottomSheetModal` re-rendered mid-dismiss re-measures its own content
 * under `enableDynamicSizing` and cancels the dismissal, which is a sheet that
 * starts to close and springs straight back open. Keeping the element
 * identical across those renders is what stops it.
 */
export default React.memo(WantsPickSheet);

const styles = StyleSheet.create({
  title: {
    ...typography.rowTitle,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
});
