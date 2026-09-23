import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/features/theme/useTheme';
import { iconSize, radius, scaleRadius, spacing, type RadiusPreset, typography } from '@/constants/design';
import { selectRadiusPreset, setRadiusPreset } from '@/features/settings/appearance/state';
import Touchable from '@/components/Touchable';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsCard from '../../components/SettingsCard';
import SettingsDivider from '../../components/SettingsDivider';

// The preview swatches are 44×44 boxes wearing each preset's own corner radius,
// so the choice reads visually rather than as three words. `scaleRadius` is
// asked per option because the exported `radius` reflects the preset in force,
// not the one being offered — a swatch row drawn from it would show the same
// corner three times.
//
// The base is `radius.md` rather than the `radius.card` these presets mostly
// govern: a card's 12 scales to 21 on a 44pt box, which reads as a pill and
// oversells `rounded`. This was 3/8/14 written out, which is this expression
// evaluated by hand and left to drift from the multipliers it came from.
const previewRadius = (preset: RadiusPreset) => scaleRadius(radius.md, preset);

export const RadiusPresetSelector: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const selected = useSelector(selectRadiusPreset);
  const themeColor = colors.themeColor;

  const handleSelect = useCallback((preset: RadiusPreset) => {
    if (preset === selected) return;
    dispatch(setRadiusPreset(preset));
  }, [dispatch, selected]);

  const presets: RadiusPreset[] = ['sharp', 'default', 'rounded'];

  return (
    <>
      <SettingsCardHeader subtle title={t('settings.appearance.radiusPreset.title')} />
      <SettingsCard accessibilityRole="radiogroup">
        {presets.map((preset, index) => {
          const isActive = selected === preset;
          return (
            <React.Fragment key={preset}>
              <Touchable
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive, checked: isActive }}
                onPress={() => handleSelect(preset)}
                style={styles.row}
              >
                <View
                  style={[
                    styles.swatch,
                    {
                      borderRadius: previewRadius(preset),
                      backgroundColor: isActive ? themeColor : colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: colors.secondary }]}>
                    {t(`settings.appearance.radiusPreset.${preset}.label`)}
                  </Text>
                  <Text style={[styles.subtext, { color: colors.subtext }]}>
                    {t(`settings.appearance.radiusPreset.${preset}.subtext`)}
                  </Text>
                </View>
                {isActive && <Check size={iconSize.control} color={themeColor} />}
              </Touchable>
              {index < presets.length - 1 && <SettingsDivider />}
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
  swatch: {
    width: 40,
    height: 40,
    borderWidth: 1,
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
