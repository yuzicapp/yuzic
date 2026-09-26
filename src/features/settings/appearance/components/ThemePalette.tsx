import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { iconSize, radius, spacing, typography } from '@/constants/design';
import Touchable from '@/components/Touchable';
import { editTheme, resetPalettes, selectActiveTheme } from '@/features/settings/appearance/state';
import { DEFAULT_THEME, derivePalette, type PaletteSeed } from '@/features/theme/presets';
import { mix } from '@/features/theme/color';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsDivider from '../../components/SettingsDivider';

const KEYS = ['background', 'surface', 'text'] as const;

/**
 * The picker's handles, smaller than the library's default. A handle is
 * centred on the edge of its panel, so at either end half of it hangs past
 * the panel; the default hung past the card's corner too.
 */
export const PICKER_THUMB = 24;

/**
 * The app's colours, for whichever of light and dark is showing.
 *
 * A person picks three colours and the rest of the palette is worked out from
 * them by `derivePalette`, which also moves text just far enough to stay
 * readable, so no combination makes the app illegible. The other scheme's
 * colours are edited by switching to it; the whole app is the preview either
 * way. Sits under the accent colour and is drawn the same way: a row per
 * colour, each opening a picker in place.
 */
export const ThemePalette: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { resolved } = useTheme();
  const theme = useSelector(selectActiveTheme);
  const [open, setOpen] = useState<keyof PaletteSeed | null>(null);

  const palette = theme.palettes[resolved];
  const seed: PaletteSeed = { background: palette.background, surface: palette.card, text: palette.text };
  // By value: the stored theme is completed from the default on the way out,
  // so an untouched palette is equal to the default's but never the same object.
  const defaults = DEFAULT_THEME.palettes[resolved];
  const changed = (Object.keys(defaults) as (keyof typeof defaults)[]).some(key => palette[key] !== defaults[key]);

  const setColor = (key: keyof PaletteSeed, value: string) => {
    dispatch(editTheme({ palettes: { [resolved]: derivePalette({ ...seed, [key]: value }) } }));
  };

  return (
    <>
      <SettingsCardHeader subtle title={t(`settings.appearance.palette.${resolved}`)} />
      <SettingsCard>
        {KEYS.map((key, index) => (
          <React.Fragment key={key}>
            {index > 0 && <SettingsDivider />}
            <ColorRow
              label={t(`settings.appearance.palette.${key}`)}
              value={seed[key]}
              open={open === key}
              onToggle={() => setOpen(current => (current === key ? null : key))}
              onChange={value => setColor(key, value)}
            />
          </React.Fragment>
        ))}
        {changed && (
          <>
            <SettingsDivider />
            <ResetRow label={t('settings.appearance.palette.reset')} onPress={() => dispatch(resetPalettes())} />
          </>
        )}
      </SettingsCard>
      <Hint text={t('settings.appearance.palette.readableHint')} />
    </>
  );
};

const Hint: React.FC<{ text: string }> = ({ text }) => {
  const { colors } = useTheme();
  return <Text style={[styles.hint, { color: colors.subtext }]}>{text}</Text>;
};

type ColorRowProps = {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

/** One colour: its name, a swatch and the hex, opening a picker in place. */
const ColorRow: React.FC<ColorRowProps> = ({ label, value, open, onToggle, onChange }) => {
  const { colors } = useTheme();
  return (
    <View>
      <Touchable
        style={styles.row}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.swatch, { backgroundColor: value, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
        </View>
        <View style={styles.rowRight}>
          {/* Always six digits: the default palette writes some colours as #fff. */}
          <Text style={[styles.hex, { color: colors.subtext }]}>{mix(value, value, 0).toUpperCase()}</Text>
          {open
            ? <ChevronUp size={iconSize.row} color={colors.subtext} />
            : <ChevronDown size={iconSize.row} color={colors.subtext} />}
        </View>
      </Touchable>
      {open && (
        <View style={styles.picker}>
          <ColorPicker value={value} onCompleteJS={c => onChange(c.hex.slice(0, 7))} style={styles.pickerInner} thumbSize={PICKER_THUMB}>
            <Panel1 />
            <HueSlider />
          </ColorPicker>
        </View>
      )}
    </View>
  );
};

const ResetRow: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => {
  const { colors } = useTheme();
  return (
    <Touchable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.label, { color: colors.themeColor }]}>{label}</Text>
    </Touchable>
  );
};

// The accent card's swatch and picker measurements, so the two read as a set.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.md,
  },
  label: {
    ...typography.compactRowTitle,
  },
  hex: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  picker: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  pickerInner: {
    height: 240,
    width: '100%',
    gap: spacing.md,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
