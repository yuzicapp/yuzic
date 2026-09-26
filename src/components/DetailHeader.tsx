import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaImage } from '@/components/MediaImage';
import { useCoverAccent } from '@/features/theme/useCoverAccent';
import { ACCENT_WASH_LOCATIONS, accentWashColors } from '@/features/theme/coverAccent';
import { useTheme } from '@/features/theme/useTheme';
import { controlSize, hitSlopFor, iconSize, shade, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import type { CoverSource } from '@/domain/entities/Cover';
import Touchable from '@/components/Touchable';
import { DETAIL_BAR_HEIGHT, useDetailScroll } from '@/components/detail/DetailScreen';
import { useWindowLayout } from '@/features/layout/useWindowLayout';
import { squareArtSize } from '@/features/layout/windowClass';

// A detail screen is assembled from three modules; screens import all of it
// from here.
export {
  DETAIL_BAR_HEIGHT,
  DetailScreen,
  useDetailHeaderInset,
  useDetailHeroTitleLayout,
} from '@/components/detail/DetailScreen';
export {
  DetailActionRow,
  DetailCircleAction,
  DetailMetaDot,
  DetailMetaRow,
  DetailMetaText,
  DetailPlayAction,
} from '@/components/detail/DetailActions';

/** How far the wash reaches past the top of the hero, before the safe-area and
 * bar height that sit above the cover are added to it. */
const WASH_REACH = 420;

/** Long enough to read as the colour arriving rather than the screen changing. */
const WASH_FADE_MS = 450;

/**
 * The hero square on an album, artist or playlist.
 *
 * Fixed rather than a share of the width, and deliberately: this is a header
 * the list scrolls away under, not the content, so it is the same size on
 * every phone and does not grow into half an iPad.
 */
const DETAIL_COVER_SIZE = 280;

/**
 * How much of a short window the hero may take.
 *
 * 280 plus its margins and a two-line title is 400pt, which is the whole of a
 * phone turned on its side — the screen opened on a full page of chrome with
 * the first track below the fold. Only landscape asks this; in portrait the
 * fixed size always wins, so no phone and no tablet held upright moves.
 */
const DETAIL_COVER_HEIGHT_SHARE = 0.45;

type DetailHeaderProps = {
  title: string;
  cover: CoverSource;
  rightAction?: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  showNavigation?: boolean;
};

type DetailHeaderBarProps = {
  title: string;
  /** A line under the title, for a screen whose only other heading would repeat
   * this one — a collection's item count rather than a second "Albums". */
  subtitle?: string;
  rightAction?: React.ReactNode;
};

export function DetailHeaderBar({ title, subtitle, rightAction }: DetailHeaderBarProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useTheme();
  const rad = useRadius();
  const floating = useDetailScroll();

  const fallback = useSharedValue(1);
  const progress = floating?.progress ?? fallback;
  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    // Only the two buttons take touches. The bar floats over a scrolling list,
    // and a plain view across the top of it would swallow every drag that
    // started in that strip.
    <View pointerEvents="box-none" style={styles.headerRow}>
      <BarButton
        testID="detail-back-button"
        accessibilityLabel={t('a11y.common.back')}
        onPress={() => navigation.goBack()}
        scrim={floating ? (isDarkMode ? SCRIM_DARK : SCRIM_LIGHT) : undefined}
      >
        {/* A chevron's ink is a "<": its geometric centre sits right of where
            the eye puts it, so centring it in the disc reads as pushed over. */}
        <ChevronLeft size={iconSize.header} color={colors.secondary} style={styles.chevron} />
      </BarButton>

      <Animated.View pointerEvents="none" style={[styles.headerTitleWrapper, fadeStyle]}>
        <Text style={[styles.headerTitle, { color: colors.secondary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {rightAction ?? <View style={[styles.headerButton, { borderRadius: rad.pillFor(controlSize.iconCompact) }]} />}
    </View>
  );
}

export function DetailHeader({
  title,
  cover,
  rightAction,
  meta,
  status,
  actions,
  showNavigation = true,
}: DetailHeaderProps) {
  const { colors } = useTheme();
  const rad = useRadius();
  const insets = useSafeAreaInsets();
  const accent = useCoverAccent(cover);
  const floating = useDetailScroll();
  const { height, landscape } = useWindowLayout();
  const coverSize = landscape
    ? squareArtSize(DETAIL_COVER_SIZE, height * DETAIL_COVER_HEIGHT_SHARE)
    : DETAIL_COVER_SIZE;

  // The hero starts at the very top of the scroll view so the wash can too;
  // the room the bar and the status bar need is padding here instead.
  const inset = floating ? insets.top + DETAIL_BAR_HEIGHT : 0;

  return (
    <View style={[styles.container, { paddingTop: inset }]}>
      {/* A wash of the cover's own colour behind it, fading out before the
          content below. Absolute and non-interactive so nothing here has to
          move to make room for it, and absent until extraction returns rather
          than flashing a placeholder band on the way to the real colour.

          Extraction finishes after the screen is already on-screen, so without
          the fade the colour arrives as a pop — the one moment the seam shows
          is the moment it should show least. */}
      {accent ? (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(WASH_FADE_MS)}
          style={[styles.wash, { height: inset + WASH_REACH }]}
        >
          <LinearGradient
            colors={accentWashColors(accent)}
            locations={[...ACCENT_WASH_LOCATIONS]}
            style={styles.washFill}
          />
        </Animated.View>
      ) : null}

      {showNavigation && <DetailHeaderBar title={title} rightAction={rightAction} />}

      <View style={[styles.coverWrapper, { width: coverSize, height: coverSize, borderRadius: rad.lg }]}>
        <MediaImage cover={cover} size="detail" style={[styles.coverImage, { borderRadius: rad.lg }]} />
      </View>

      <View style={styles.titleInfo} onLayout={floating?.onHeroTitleLayout}>
        <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={2}>
          {title}
        </Text>
        {meta}
      </View>

      {status}

      {actions}
    </View>
  );
}

/**
 * The scrim behind a bar icon.
 *
 * A bare glyph on a floating bar has to stay readable over whatever the cover
 * turns out to be, and the cover is a different colour on every screen. A disc
 * the opposite side of the theme from the icon settles it once, for every
 * cover, without the icon having to change colour halfway through a scroll.
 */
const SCRIM_DARK = shade.scrim;
const SCRIM_LIGHT = shade.scrimLight;

type BarButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  scrim?: string;
};

function BarButton({ children, onPress, accessibilityLabel, testID, scrim }: BarButtonProps) {
  const rad = useRadius();
  return (
    <Touchable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.headerButton,
        { borderRadius: rad.pillFor(controlSize.iconCompact) },
        scrim ? { backgroundColor: scrim } : null,
      ]}
      feedback="control"
      hitSlop={hitSlopFor(iconSize.header)}
    >
      {children}
    </Touchable>
  );
}

type DetailHeaderIconButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
};

export function DetailHeaderIconButton({ children, onPress, accessibilityLabel }: DetailHeaderIconButtonProps) {
  const { isDarkMode } = useTheme();
  const floating = useDetailScroll();
  return (
    <BarButton
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scrim={floating ? (isDarkMode ? SCRIM_DARK : SCRIM_LIGHT) : undefined}
    >
      {children}
    </BarButton>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  washFill: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    height: DETAIL_BAR_HEIGHT,
    width: '100%',
  },
  headerTitleWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.navigationTitle,
    maxWidth: '60%',
  },
  headerSubtitle: {
    ...typography.caption,
    maxWidth: '60%',
  },
  chevron: {
    marginLeft: -2,
  },
  headerButton: {
    width: controlSize.iconCompact,
    height: controlSize.iconCompact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrapper: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  titleInfo: {
    width: '100%',
    marginBottom: spacing.roomy,
    alignItems: 'center',
  },
  title: {
    ...typography.screenTitle,
    marginBottom: spacing.tight,
    textAlign: 'center',
  },
});
