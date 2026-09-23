import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';
import { Moon, Smartphone, Sun } from 'lucide-react-native';

import { iconSize, spacing, typography } from '@/constants/design';
import Touchable from '@/components/Touchable';
import {
  deleteTheme,
  editActiveTheme,
  renameTheme,
  selectActiveTheme,
  selectAllThemes,
} from '@/features/settings/appearance/state';
import { derivePalette, type PaletteSeed } from '@/features/theme/presets';
import type { Scheme, Theme } from '@/features/theme/theme';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import SettingsScreen from '../components/SettingsScreen';
import SettingsCard from '../components/SettingsCard';
import SettingsCardHeader from '../components/SettingsCardHeader';
import SettingsDivider from '../components/SettingsDivider';
import SettingsIconSelectCard from '../components/SettingsIconSelectCard';
import SettingsInputField from '../components/SettingsInputField';

type SchemeChoice = 'follow' | Scheme;
type ColorKey = keyof PaletteSeed | 'accent';

const SCHEME_OPTIONS: { id: SchemeChoice; icon: React.ReactElement<{ color?: string }> }[] = [
  { id: 'follow', icon: <Smartphone size={iconSize.row} /> },
  { id: 'light', icon: <Sun size={iconSize.row} /> },
  { id: 'dark', icon: <Moon size={iconSize.row} /> },
];

/** The three colours a palette is made from, read back out of the palette. */
function seedOf(theme: Theme, scheme: Scheme): PaletteSeed {
  const palette = theme.palettes[scheme];
  return { background: palette.background, surface: palette.card, text: palette.text };
}

/**
 * The full theme editor, behind the gallery.
 *
 * It edits the active theme, so the whole app, this screen included, is the
 * preview. Editing a preset quietly makes a copy of it (see `editActiveTheme`),
 * which is why there is no save button: every change is already kept, and the
 * preset it came from is still in the gallery.
 *
 * A person picks three colours per scheme and the accent. The rest of the
 * palette is worked out from those by `derivePalette`, which also moves text
 * just far enough to stay readable, so no combination makes the app illegible.
 */
const ThemeEditor: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const theme = useSelector(selectActiveTheme);
  const { custom } = useSelector(selectAllThemes);
  const isCustom = custom.some(c => c.id === theme.id);
  // One picker open at a time, named by what it edits.
  const [openColor, setOpenColor] = useState<string | null>(null);
  const toggle = (id: string) => setOpenColor(open => (open === id ? null : id));

  const schemes: Scheme[] = theme.scheme ? [theme.scheme] : ['light', 'dark'];

  const setScheme = (choice: SchemeChoice) => {
    dispatch(editActiveTheme({ scheme: choice === 'follow' ? null : choice }));
  };

  const setColor = (scheme: Scheme, key: ColorKey, value: string) => {
    if (key === 'accent') {
      dispatch(editActiveTheme({ accent: value }));
      return;
    }
    const seed = { ...seedOf(theme, scheme), [key]: value };
    dispatch(editActiveTheme({ palettes: { [scheme]: derivePalette(seed) } }));
  };

  const confirmDelete = () => {
    Alert.alert(
      t('settings.appearance.editor.deleteConfirm', { name: theme.name }),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch(deleteTheme(theme.id));
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SettingsScreen title={t('settings.appearance.editor.title')}>
      {isCustom ? (
        <SettingsCard style={styles.nameCard}>
          <SettingsInputField
            label={t('settings.appearance.editor.name')}
            value={theme.name}
            autoCapitalize="words"
            onChangeText={name => dispatch(renameTheme({ id: theme.id, name }))}
          />
        </SettingsCard>
      ) : (
        <Hint text={t('settings.appearance.editor.copyHint', { name: theme.name })} />
      )}

      <SettingsIconSelectCard
        title={t('settings.appearance.editor.scheme')}
        items={SCHEME_OPTIONS.map(option => ({
          id: option.id,
          icon: option.icon,
          label: t(`settings.appearance.editor.schemes.${option.id}`),
        }))}
        selected={theme.scheme ?? 'follow'}
        onSelect={id => setScheme(id as SchemeChoice)}
      />

      <SettingsCard style={styles.accentCard}>
        <ColorRow
          label={t('settings.appearance.editor.accent')}
          value={theme.accent}
          open={openColor === 'accent'}
          onToggle={() => toggle('accent')}
          onChange={value => setColor(schemes[0], 'accent', value)}
        />
      </SettingsCard>

      {schemes.map(scheme => {
        const seed = seedOf(theme, scheme);
        return (
          <React.Fragment key={scheme}>
            <SettingsCardHeader subtle title={t(`settings.appearance.editor.colors.${scheme}`)} />
            <SettingsCard>
              {(['background', 'surface', 'text'] as const).map((key, index) => {
                const id = `${scheme}.${key}`;
                return (
                  <React.Fragment key={key}>
                    {index > 0 && <SettingsDivider />}
                    <ColorRow
                      label={t(`settings.appearance.editor.${key}`)}
                      value={seed[key]}
                      open={openColor === id}
                      onToggle={() => toggle(id)}
                      onChange={value => setColor(scheme, key, value)}
                    />
                  </React.Fragment>
                );
              })}
            </SettingsCard>
          </React.Fragment>
        );
      })}
      <Hint text={t('settings.appearance.editor.readableHint')} />

      {isCustom && (
        <SettingsCard style={styles.deleteCard}>
          <DeleteRow label={t('settings.appearance.editor.delete')} onPress={confirmDelete} />
        </SettingsCard>
      )}
    </SettingsScreen>
  );
};

export default ThemeEditor;

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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  return (
    <View>
      <Touchable
        style={styles.colorRow}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('a11y.settings.editColor', { name: label, value })}
      >
        <Text style={[styles.colorLabel, { color: colors.secondary }]}>{label}</Text>
        <View style={styles.colorValue}>
          <Text style={[styles.hex, { color: colors.subtext }]}>{value.toUpperCase()}</Text>
          <View style={[styles.swatch, { backgroundColor: value, borderColor: colors.border, borderRadius: rad.md }]} />
        </View>
      </Touchable>
      {open && (
        <View style={styles.picker}>
          <ColorPicker value={value} onCompleteJS={c => onChange(c.hex.slice(0, 7))} style={styles.pickerInner}>
            <Panel1 />
            <HueSlider />
          </ColorPicker>
        </View>
      )}
    </View>
  );
};

const DeleteRow: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => {
  const { colors } = useTheme();
  return (
    <Touchable style={styles.colorRow} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.colorLabel, { color: colors.destructive }]}>{label}</Text>
    </Touchable>
  );
};

const SWATCH_SIZE = 28;

const styles = StyleSheet.create({
  nameCard: {
    padding: spacing.lg,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  colorLabel: {
    ...typography.rowTitle,
  },
  colorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hex: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderWidth: StyleSheet.hairlineWidth,
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
  accentCard: {
    marginTop: spacing.lg,
  },
  deleteCard: {
    marginTop: spacing.xl,
  },
});
