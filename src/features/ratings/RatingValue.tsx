import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/constants/design';
import { RATING_MAX } from '@/domain/entities/Rating';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';

const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);

/**
 * What something is rated, drawn small and inert, for the right-hand side of
 * an options-sheet row.
 *
 * Not tappable, and that is the point: `OptionSheetRow` wraps its whole
 * contents — the trailing slot included — in one `Pressable`, and a
 * `Pressable` is an accessibility element unless it is told otherwise, so
 * anything interactive in here would be five controls a screen reader could
 * see and never reach. The row is the control; this is its value. Setting it
 * happens in the sheet the row opens, which is the same shape the sleep timer
 * has (a row that shows what is running and opens the thing that changes it).
 *
 * The label is what makes the value audible: a grouped accessibility element
 * reads its children's labels, so the row announces "Rating, three stars"
 * rather than "Rating" and five silent glyphs.
 */
const RatingValue: React.FC<{ value: number | undefined }> = ({ value }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rating = value ?? 0;

  return (
    <View
      style={styles.row}
      accessibilityLabel={
        rating > 0 ? t('a11y.rating.star', { count: rating }) : t('ratings.notRated')
      }
    >
      {STARS.map(star => (
        <Star
          key={star}
          size={icons.badge}
          color={star <= rating ? colors.themeColor : colors.border}
          fill={star <= rating ? colors.themeColor : 'none'}
        />
      ))}
    </View>
  );
};

export default RatingValue;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
});
