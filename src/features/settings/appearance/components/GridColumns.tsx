import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/useTheme';
import { selectGridColumns, setGridColumns } from '@/features/settings/appearance/state';
import { spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import SettingsCard from '../../components/SettingsCard';
import { withAlpha } from '@/features/theme/coverAccent';

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;

export const GridColumns: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const rad = useRadius();
  const gridColumns = useSelector(selectGridColumns);
  const themeColor = colors.themeColor;

  return (
    <SettingsCard>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.secondary }]}>
          {t('settings.appearance.gridColumns.label')}
        </Text>
        <View style={[styles.badge, { backgroundColor: withAlpha(themeColor, 0.13), borderRadius: rad.card }]}>
          <Text style={[styles.badgeText, { color: themeColor }]}>{gridColumns}</Text>
        </View>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={MIN_COLUMNS}
        maximumValue={MAX_COLUMNS}
        step={1}
        value={gridColumns}
        onValueChange={(val) => dispatch(setGridColumns(Math.round(val)))}
        minimumTrackTintColor={themeColor}
        maximumTrackTintColor={colors.border}
        thumbTintColor={themeColor}
      />
      <Text style={[styles.subtext, { color: colors.subtext }]}>
        {t('settings.appearance.gridColumns.subtext')}
      </Text>
    </SettingsCard>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  label: {
    ...typography.body,
  },
  badge: {
    paddingHorizontal: spacing.controlGap,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    ...typography.label,
  },
  slider: {
    width: '100%',
    height: 40,
    paddingHorizontal: spacing.lg,
  },
  subtext: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
