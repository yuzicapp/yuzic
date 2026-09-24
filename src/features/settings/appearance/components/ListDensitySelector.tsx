import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/features/theme/useTheme';
import { iconSize, listDensity, spacing, type ListDensity, typography } from '@/constants/design';
import { selectListDensity, setListDensity } from '@/features/settings/appearance/state';
import { useRadius } from '@/features/theme/useRadius';
import Touchable from '@/components/Touchable';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsCard from '../../components/SettingsCard';
import SettingsDivider from '../../components/SettingsDivider';

const DENSITIES: ListDensity[] = ['compact', 'default', 'spacious'];

/** Three stacked bars spaced by the density they stand for — the same trick the
 *  radius swatch plays, so the choice reads as a shape rather than as a word.
 *  Halved because the real gap is a row's, and three of those would not fit in
 *  a 40pt box. */
const PreviewRows: React.FC<{ density: ListDensity; color: string }> = ({ density, color }) => (
  <View style={[styles.preview, { gap: listDensity[density].rowGap / 2 }]}>
    {[0, 1, 2].map(i => (
      <View key={i} style={[styles.previewRow, { backgroundColor: color }]} />
    ))}
  </View>
);

export const ListDensitySelector: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const rad = useRadius();
  const selected = useSelector(selectListDensity);
  const themeColor = colors.themeColor;

  const handleSelect = useCallback((density: ListDensity) => {
    if (density === selected) return;
    dispatch(setListDensity(density));
  }, [dispatch, selected]);

  return (
    <>
      <SettingsCardHeader subtle title={t('settings.appearance.listDensity.title')} />
      <SettingsCard accessibilityRole="radiogroup">
        {DENSITIES.map((density, index) => {
          const isActive = selected === density;
          return (
            <React.Fragment key={density}>
              <Touchable
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive, checked: isActive }}
                onPress={() => handleSelect(density)}
                style={styles.row}
              >
                <View
                  style={[
                    styles.previewBox,
                    { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: rad.md },
                  ]}
                >
                  <PreviewRows density={density} color={isActive ? themeColor : colors.subtext} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: colors.secondary }]}>
                    {t(`settings.appearance.listDensity.${density}.label`)}
                  </Text>
                  <Text style={[styles.subtext, { color: colors.subtext }]}>
                    {t(`settings.appearance.listDensity.${density}.subtext`)}
                  </Text>
                </View>
                {isActive && <Check size={iconSize.control} color={themeColor} />}
              </Touchable>
              {index < DENSITIES.length - 1 && <SettingsDivider />}
            </React.Fragment>
          );
        })}
      </SettingsCard>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  previewBox: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    width: 22,
  },
  previewRow: {
    height: 3,
    width: '100%',
  },
  rowText: {
    flex: 1,
  },
  label: {
    ...typography.body,
    fontWeight: '500',
  },
  subtext: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
});
