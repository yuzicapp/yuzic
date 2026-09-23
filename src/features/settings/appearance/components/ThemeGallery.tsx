import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronRight, Palette } from 'lucide-react-native';

import { iconSize, spacing, typography } from '@/constants/design';
import Touchable from '@/components/Touchable';
import { selectActiveTheme, selectAllThemes, setActiveTheme } from '@/features/settings/appearance/state';
import { schemeFor, type Theme } from '@/features/theme/theme';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';

const SWATCH_SIZE = 40;
/** The gap between a selected swatch and the ring drawn around it. */
const RING_GAP = 3;

/**
 * The themes, as a row of round swatches in the same card shape as the accent
 * colours below it.
 *
 * Each swatch is the theme's background with its accent filling the right
 * half, drawn in the scheme it would use if picked. That is the light and
 * dark setting's answer, not the active theme's: a dark-only theme being
 * active must not paint every other swatch dark. Only the active theme is
 * named, in the header; the rest say who they are to a screen reader.
 */
export const ThemeGallery: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const { colors, modeScheme } = useTheme();
  const rad = useRadius();
  const { presets, custom } = useSelector(selectAllThemes);
  const active = useSelector(selectActiveTheme);

  return (
    <>
      <SettingsCardHeader subtle title={`${t('settings.appearance.gallery.title')} · ${active.name}`} />
      <SettingsCard style={styles.card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          accessibilityRole="radiogroup"
        >
          {[...custom, ...presets].map(theme => (
            <ThemeSwatch
              key={theme.id}
              theme={theme}
              scheme={schemeFor(theme, modeScheme)}
              selected={theme.id === active.id}
              onPress={() => dispatch(setActiveTheme(theme.id))}
            />
          ))}
        </ScrollView>

        <Touchable
          style={[styles.customize, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: rad.md }]}
          onPress={() => router.push('/settings/themeEditorView')}
        >
          <View style={styles.customizeLeft}>
            <Palette size={iconSize.row} color={colors.subtext} />
            <Text style={[styles.customizeText, { color: colors.secondary }]}>
              {t('settings.appearance.gallery.customize')}
            </Text>
          </View>
          <ChevronRight size={iconSize.row} color={colors.subtext} />
        </Touchable>
      </SettingsCard>
    </>
  );
};

type SwatchProps = {
  theme: Theme;
  scheme: 'light' | 'dark';
  selected: boolean;
  onPress: () => void;
};

const ThemeSwatch: React.FC<SwatchProps> = ({ theme, scheme, selected, onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const ringSize = SWATCH_SIZE + 2 * RING_GAP + 4;

  return (
    <Touchable
      onPress={onPress}
      feedback="control"
      rippleRadius={ringSize / 2}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={t('a11y.settings.themeCard', { name: theme.name })}
      style={[
        styles.ring,
        { width: ringSize, height: ringSize, borderRadius: rad.pillFor(ringSize) },
        { borderColor: selected ? colors.secondary : 'transparent' },
      ]}
    >
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: theme.palettes[scheme].background,
            borderColor: colors.border,
            borderRadius: rad.pillFor(SWATCH_SIZE),
          },
        ]}
      >
        <View style={[styles.accentHalf, { backgroundColor: theme.accent }]} />
      </View>
    </Touchable>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  strip: {
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  accentHalf: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SWATCH_SIZE / 2,
  },
  customize: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  customizeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customizeText: {
    ...typography.compactRowTitle,
  },
});
