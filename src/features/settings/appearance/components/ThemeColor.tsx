import { iconSize, radius, shadow, spacing, themeColorPreset, typography } from '@/constants/design';
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import ColorPicker, { Panel1, HueSlider } from 'reanimated-color-picker';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { selectThemeColor, setThemeColor } from '@/features/settings/appearance/state';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsCard from '../../components/SettingsCard';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { PICKER_THUMB } from './ThemePalette';

// The first preset is the default a fresh install starts on, so the list is
// the one place both are stated.
const THEME_PRESET_COLORS = themeColorPreset;

export const ThemeColor: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const themeColor = useSelector(selectThemeColor);
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const rad = useRadius();

  return (
    <>
      <SettingsCardHeader subtle title={t('settings.appearance.color.title')} />
      <SettingsCard style={styles.card}>
        <View style={styles.presets} accessibilityRole="radiogroup">
          {THEME_PRESET_COLORS.map(color => (
            <Touchable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={t('a11y.settings.themeColor', { color })}
              accessibilityState={{ selected: themeColor === color, checked: themeColor === color }}
              onPress={() => dispatch(setThemeColor(color))}
              style={[
                styles.preset,
                { backgroundColor: color },
                themeColor === color && [styles.presetSelected, { borderColor: colors.secondary }],
              ]}
            />
          ))}
        </View>

        <Touchable
          style={[styles.expandButton, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: rad.md }]}
          onPress={() => setOpen(v => !v)}
        >
          <View style={styles.expandLeft}>
            <View style={[styles.colorPreview, { backgroundColor: themeColor }]} />
            <Text style={[styles.expandText, { color: colors.secondary }]}>
              {t('settings.appearance.color.change')}
            </Text>
          </View>
          {open
            ? <ChevronUp size={iconSize.row} color={colors.subtext} />
            : <ChevronDown size={iconSize.row} color={colors.subtext} />
          }
        </Touchable>

        {open && (
          <View style={styles.picker}>
            <ColorPicker
              thumbSize={PICKER_THUMB}
              value={themeColor}
              onCompleteJS={c => dispatch(setThemeColor(c.hex))}
              style={{ height: 240, width: '100%' }}
            >
              <Panel1 />
              <HueSlider />
            </ColorPicker>
          </View>
        )}
      </SettingsCard>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  presets: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  preset: {
    flex: 1,
    height: 28,
    borderRadius: radius.sm,
  },
  presetSelected: {
    borderWidth: 2,
    ...shadow.selectedSwatch,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  expandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    marginRight: spacing.md,
  },
  expandText: {
    ...typography.compactRowTitle,
  },
  picker: {
    paddingTop: spacing.lg,
    // Room for half a handle past each end of the panel, inside the card.
    paddingHorizontal: spacing.sm,
  },
});
