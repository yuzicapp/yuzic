import React, { forwardRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';

import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  OptionSheetDivider,
  OptionSheetRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';
import { iconSize, spacing, statusColor, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import StarRating from './StarRating';
import { useRating, useSetRating } from './useRatings';

type Rateable = { nativeId: string; userRating?: number };

/**
 * Setting a rating, opened from the row in an entity's options sheet.
 *
 * The stars are free-standing here rather than inside a row, which is the
 * whole reason this sheet exists: five of them in an `OptionSheetRow` sit
 * inside that row's single `Pressable` and stop being five things a screen
 * reader can reach. As direct children of the sheet they are five radios
 * again, at a size a thumb can hit.
 *
 * Picking a star closes the sheet. Rating something is a decision, not a
 * setting to sit and adjust, and a sheet that stayed open would leave the
 * user to find the way out of a job they had finished.
 */
const RatingSheet = forwardRef<BottomSheetModal, { entity: Rateable | null | undefined }>(
  ({ entity }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const sheetBg = useOptionSheetBackground();
    const sheetContent = useOptionSheetContentStyle();
    const rating = useRating(entity);
    const setRating = useSetRating();
    const nativeId = entity?.nativeId;

    const choose = useCallback(
      (next: number) => {
        if (nativeId) void setRating(nativeId, next);
        dismissSheetRef(ref);
      },
      [nativeId, setRating, ref]
    );

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        stackBehavior="push"
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      >
        <BottomSheetScrollView
          testID="rating-sheet"
          style={sheetBg}
          contentContainerStyle={sheetContent}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.secondary }]}>{t('ratings.title')}</Text>
          </View>
          <OptionSheetDivider />

          <View style={styles.stars}>
            <StarRating
              value={rating}
              onChange={choose}
              size={iconSize.transport}
              starTestID={star => `rating-star-${star}`}
            />
          </View>

          {(rating ?? 0) > 0 && (
            <>
              <OptionSheetDivider />
              <OptionSheetRow
                testID="rating-clear"
                label={t('ratings.clear')}
                labelColor={statusColor.destructive}
                onPress={() => choose(0)}
              />
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

RatingSheet.displayName = 'RatingSheet';

export default RatingSheet;

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.sheetTitle,
  },
  stars: {
    alignItems: 'center',
    paddingVertical: spacing.roomy,
  },
});
