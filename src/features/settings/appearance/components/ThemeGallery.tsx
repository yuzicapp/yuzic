import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronRight, Palette } from 'lucide-react-native';

import { iconSize, shadow, spacing, typography } from '@/constants/design';
import Touchable from '@/components/Touchable';
import { selectActiveTheme, selectAllThemes, setActiveTheme } from '@/features/settings/appearance/state';
import { schemeFor, type Theme } from '@/features/theme/theme';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';

const TILE_SIZE = 56;
const ACCENT_DOT = 12;

/**
 * The themes, as small pictures of themselves, in the same card shape as the
 * accent colours below it.
 *
 * A tile is the theme's background with a strip of its surface and a dot of
 * its accent, drawn in the scheme it would use if picked. That is the light
 * and dark setting's answer, not the active theme's: a dark-only theme being
 * active must not paint every other tile dark.
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
      <SettingsCardHeader subtle title={t('settings.appearance.gallery.title')} />
      <SettingsCard style={styles.card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          accessibilityRole="radiogroup"
        >
          {[...custom, ...presets].map(theme => (
            <ThemeTile
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

type TileProps = {
  theme: Theme;
  scheme: 'light' | 'dark';
  selected: boolean;
  onPress: () => void;
};

const ThemeTile: React.FC<TileProps> = ({ theme, scheme, selected, onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const palette = theme.palettes[scheme];

  return (
    <Touchable
      onPress={onPress}
      style={styles.tile}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={t('a11y.settings.themeCard', { name: theme.name })}
    >
      <View
        style={[
          styles.preview,
          { backgroundColor: palette.background, borderRadius: rad.md, borderColor: colors.border },
          selected && [styles.previewSelected, { borderColor: colors.secondary }],
        ]}
      >
        <View style={[styles.surface, { backgroundColor: palette.card, borderRadius: rad.thumb }]}>
          <View style={[styles.line, { backgroundColor: palette.text }]} />
        </View>
        <View style={[styles.accent, { backgroundColor: theme.accent, borderRadius: rad.pill }]} />
      </View>
      <Text
        style={[styles.name, { color: selected ? colors.secondary : colors.subtext }, selected && styles.nameSelected]}
        numberOfLines={1}
      >
        {theme.name}
      </Text>
    </Touchable>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  strip: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tile: {
    width: TILE_SIZE,
    alignItems: 'center',
  },
  preview: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    padding: spacing.tight,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
  // The same selected look as an accent swatch, so the two cards read as one set.
  previewSelected: {
    borderWidth: 2,
    ...shadow.selectedSwatch,
  },
  surface: {
    padding: spacing.xs,
  },
  line: {
    height: spacing.xs,
    width: '70%',
  },
  accent: {
    width: ACCENT_DOT,
    height: ACCENT_DOT,
    alignSelf: 'flex-end',
  },
  name: {
    ...typography.micro,
    marginTop: spacing.xs,
  },
  nameSelected: {
    fontWeight: '600',
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
