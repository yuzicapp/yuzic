import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { spacing, TEXT_SCALES, typography } from '@/constants/design';
import Touchable from '@/components/Touchable';
import { editTheme, selectActiveTheme } from '@/features/settings/appearance/state';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsDivider from '../../components/SettingsDivider';

const LABELS: Record<(typeof TEXT_SCALES)[number], string> = {
  0.9: 'small',
  1: 'default',
  1.15: 'large',
  1.3: 'larger',
};

/**
 * How big the app's text is, on top of the system text size.
 *
 * Each option previews itself with an "Aa" at its own size. The choice applies
 * as soon as it is made: `components/Text` reads the size as it draws, so the
 * screen behind this one has already changed by the time the sheet closes.
 */
export const TextSizeSelector: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const icons = useIconSize();
  const selected = useSelector(selectActiveTheme).shape.textScale;

  return (
    <>
      <SettingsCardHeader subtle title={t('settings.appearance.textSize.title')} />
      <SettingsCard>
        <View accessibilityRole="radiogroup">
          {TEXT_SCALES.map((scale, index) => {
            const active = scale === selected;
            return (
              <React.Fragment key={scale}>
                {index > 0 && <SettingsDivider />}
                <Touchable
                  style={styles.row}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  onPress={() => dispatch(editTheme({ shape: { textScale: scale } }))}
                >
                  <Text
                    // Each option previews its own size, not the one in force,
                    // so this is the one Text in the app that must not be
                    // scaled again on the way out.
                    appScaling={false}
                    style={[styles.sample, { fontSize: Math.round(typography.rowTitle.fontSize * scale), color: colors.secondary }]}
                  >
                    Aa
                  </Text>
                  <Text style={[styles.label, { color: colors.secondary }]}>
                    {t(`settings.appearance.textSize.${LABELS[scale]}`)}
                  </Text>
                  {active && <Check size={icons.row} color={colors.themeColor} />}
                </Touchable>
              </React.Fragment>
            );
          })}
        </View>
      </SettingsCard>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sample: {
    width: 44,
    fontWeight: '600',
  },
  label: {
    ...typography.rowTitle,
    flex: 1,
  },
});
