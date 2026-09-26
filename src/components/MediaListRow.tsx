import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MediaImage } from '@/components/MediaImage';
import { useTheme } from '@/features/theme/useTheme';
import { controlSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useListDensity } from '@/features/theme/useListDensity';
import type { CoverSource } from '@/domain/entities/Cover';
import Touchable from '@/components/Touchable';

type Props = {
  title: string;
  subtitle?: string;
  cover: CoverSource;
  onPress?: () => void;
  disabled?: boolean;
  /** Rendered inside the touchable before the cover, e.g. a track index */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Rendered on the subtitle line after the text, e.g. status badges */
  subtitleTrailing?: React.ReactNode;
  roundedCover?: boolean;
  showCover?: boolean;
  variant?: 'default' | 'compact';
  /**
   * Extra style on the row itself. **Lands after the density padding**, so a
   * `paddingVertical` here replaces the user's density setting rather than
   * adding to it. Pass vertical padding only when it comes from
   * `useListDensity()` — as `SongRow` does with `trackRowPadding`. Quick Picks
   * passed a static `spacing.tight` and was the one list on Home that ignored
   * the setting while looking like it honoured it.
   */
  rowStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /**
   * Marks the row for UI tests. Rows built on this component (songs, search
   * results) otherwise have no stable handle at all and can only be reached by
   * their title text, which changes with the library.
   */
  testID?: string;
};

export default function MediaListRow({
  title,
  subtitle,
  cover,
  onPress,
  disabled,
  leading,
  trailing,
  subtitleTrailing,
  roundedCover,
  showCover = true,
  variant = 'default',
  rowStyle,
  style,
  testID,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const density = useListDensity();
  const isCompact = variant === 'compact';

  /**
   * What the row announces.
   *
   * An explicit label replaces everything the row draws rather than adding to
   * it, so naming the row after its title alone dropped the artist from every
   * track and every search result. The separator is a translated string: a
   * comma is not the list separator in all four locales the app ships.
   */
  const accessibleName = !onPress
    ? undefined
    : subtitle
      ? t('a11y.rows.titleAndSubtitle', { title, subtitle })
      : title;

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.row,
          isCompact
            ? { paddingVertical: density.rowPadding }
            : { marginBottom: density.rowGap },
          rowStyle,
        ]}
      >
        <Touchable
          testID={testID}
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={accessibleName}
          accessibilityState={{ disabled: disabled || !onPress }}
          style={styles.content}
          onPress={onPress}
          disabled={disabled || !onPress}
        >
          {leading}
          {showCover && (
            <MediaImage
              cover={cover}
              size={isCompact ? 'thumb' : 'grid'}
              style={[
                styles.cover,
                { borderRadius: rad.thumb },
                isCompact && styles.compactCover,
                roundedCover && (isCompact ? styles.compactCoverRounded : styles.coverRounded),
              ]}
            />
          )}

          <View style={[styles.textContainer, !showCover && styles.textContainerNoCover]}>
            <Text
              numberOfLines={1}
              style={[isCompact ? styles.compactTitle : styles.title, { color: colors.secondary }]}
            >
              {title}
            </Text>

            {subtitle !== undefined && (
              <View style={[styles.subtitleRow, isCompact ? styles.compactSubtitleSpacing : styles.subtitleSpacing]}>
                <Text
                  numberOfLines={1}
                  style={[
                    isCompact ? styles.compactSubtitleText : styles.subtitleText,
                    styles.subtitleFlex,
                    { color: colors.subtext },
                  ]}
                >
                  {subtitle}
                </Text>
                {subtitleTrailing}
              </View>
            )}
          </View>
        </Touchable>

        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.page,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGap,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cover: {
    width: controlSize.mediaRowArt,
    height: controlSize.mediaRowArt,
  },
  compactCover: {
    width: controlSize.compactMediaRowArt,
    height: controlSize.compactMediaRowArt,
  },
  // An artist's photo, and round at every preset on purpose: the circle is how
  // you tell an artist from an album at a glance, so it is identity rather than
  // shape the radius preset gets to move. Deliberately not `rad.pillFor`.
  coverRounded: {
    borderRadius: controlSize.mediaRowArt / 2,
  },
  compactCoverRounded: {
    borderRadius: controlSize.compactMediaRowArt / 2,
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.rowGap,
  },
  textContainerNoCover: {
    marginLeft: 0,
  },
  title: typography.rowTitle,
  compactTitle: typography.compactRowTitle,
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.inlineGap,
  },
  subtitleSpacing: {
    marginTop: spacing.xxs,
  },
  compactSubtitleSpacing: {
    marginTop: spacing.xxs,
  },
  subtitleText: typography.rowSubtitle,
  compactSubtitleText: typography.caption,
  subtitleFlex: {
    flex: 1,
  },
});
