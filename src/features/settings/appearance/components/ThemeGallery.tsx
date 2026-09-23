import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Palette } from 'lucide-react-native';

import { iconSize, spacing, typography } from '@/constants/design';
import Touchable from '@/components/Touchable';
import { selectActiveTheme, selectAllThemes, setActiveTheme } from '@/features/settings/appearance/state';
import { schemeFor, type Theme } from '@/features/theme/theme';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsRow from '../../components/SettingsRow';

const CARD_WIDTH = 92;
const PREVIEW_HEIGHT = 112;

/**
 * The themes, as small pictures of themselves.
 *
 * Each card is drawn in its own theme's colours, in the scheme it would
 * actually use right now, so what you tap is what you get. A card reads as a
 * background with a surface on it, two lines of text and the accent — the
 * four things a theme changes that you notice first.
 */
export const ThemeGallery: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  // Each card in the scheme it would use if picked, which is the light/dark
  // setting's answer, not the active theme's: a dark-only theme being active
  // must not paint every other card dark.
  const { colors, modeScheme } = useTheme();
  const { presets, custom } = useSelector(selectAllThemes);
  const active = useSelector(selectActiveTheme);

  const caption = (theme: Theme) => {
    if (custom.includes(theme)) return t('settings.appearance.gallery.custom');
    if (theme.scheme === 'dark') return t('settings.appearance.gallery.alwaysDark');
    if (theme.scheme === 'light') return t('settings.appearance.gallery.alwaysLight');
    return t('settings.appearance.gallery.lightAndDark');
  };

  return (
    <>
      <SettingsCardHeader subtle title={t('settings.appearance.gallery.title')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.stripOuter}
        accessibilityRole="radiogroup"
      >
        {[...custom, ...presets].map(theme => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            scheme={schemeFor(theme, modeScheme)}
            selected={theme.id === active.id}
            caption={caption(theme)}
            onPress={() => dispatch(setActiveTheme(theme.id))}
          />
        ))}
      </ScrollView>
      <SettingsCard>
        <SettingsRow
          label={t('settings.appearance.gallery.customize')}
          leftIcon={<Palette size={iconSize.row} color={colors.subtext} />}
          onPress={() => router.push('/settings/themeEditorView')}
        />
      </SettingsCard>
    </>
  );
};

type CardProps = {
  theme: Theme;
  scheme: 'light' | 'dark';
  selected: boolean;
  caption: string;
  onPress: () => void;
};

const ThemeCard: React.FC<CardProps> = ({ theme, scheme, selected, caption, onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const palette = theme.palettes[scheme];

  return (
    <Touchable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={t('a11y.settings.themeCard', { name: theme.name })}
    >
      <View
        style={[
          styles.preview,
          {
            backgroundColor: palette.background,
            borderRadius: rad.card,
            borderColor: selected ? colors.themeColor : colors.border,
            borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={[styles.surface, { backgroundColor: palette.card, borderRadius: rad.md }]}>
          <View style={[styles.line, { backgroundColor: palette.text, borderRadius: rad.pill }]} />
          <View style={[styles.line, styles.shortLine, { backgroundColor: palette.subtext, borderRadius: rad.pill }]} />
        </View>
        <View style={[styles.accent, { backgroundColor: theme.accent, borderRadius: rad.pillFor(ACCENT_HEIGHT) }]} />
      </View>
      <Text style={[styles.name, { color: colors.secondary }]} numberOfLines={1}>{theme.name}</Text>
      <Text style={[styles.caption, { color: colors.subtext }]} numberOfLines={1}>{caption}</Text>
    </Touchable>
  );
};

const ACCENT_HEIGHT = 14;

const styles = StyleSheet.create({
  // The strip runs to the screen's edges, past the page padding, so a card
  // cut off at the right says there are more to scroll to.
  stripOuter: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
  },
  strip: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: CARD_WIDTH,
  },
  preview: {
    height: PREVIEW_HEIGHT,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  surface: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  line: {
    height: 6,
  },
  shortLine: {
    width: '60%',
  },
  accent: {
    height: ACCENT_HEIGHT,
    width: '50%',
    alignSelf: 'flex-end',
  },
  name: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.tight,
  },
  caption: {
    ...typography.micro,
  },
});
