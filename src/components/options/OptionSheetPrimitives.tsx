import { iconSize, radius, spacing, stateLayer, typography } from '@/constants/design';
import React from 'react';
import { useRadius } from '@/features/theme/useRadius';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MediaImage } from '@/components/MediaImage';
import { useTheme } from '@/features/theme/useTheme';
import type { CoverSource } from '@/domain/entities/Cover';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';

type HeaderProps = {
  cover: CoverSource;
  title: string;
  subtitle?: string;
  titleLines?: number;
};

export function OptionSheetHeader({ cover, title, subtitle, titleLines = 1 }: HeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <MediaImage cover={cover} size="grid" style={styles.cover} />
      <View style={styles.headerText}>
        <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

type RowProps = {
  icon?: React.ReactNode;
  label: string;
  /** Optional second line under the label */
  description?: string;
  onPress?: () => void;
  /** Disables presses without changing appearance; pair with dimRow/dimLabel */
  disabled?: boolean;
  /** Fade the whole row (unavailable actions, e.g. while songs load) */
  dimRow?: boolean;
  /** Fade only the label (completed/in-flight actions, e.g. downloaded) */
  dimLabel?: boolean;
  /** Replace the icon with a spinner */
  loading?: boolean;
  labelColor?: string;
  trailing?: React.ReactNode;
  testID?: string;
};

export function OptionSheetRow({
  icon,
  label,
  description,
  onPress,
  disabled,
  dimRow,
  dimLabel,
  loading,
  labelColor,
  trailing,
  testID,
}: RowProps) {
  const { colors } = useTheme();
  const leading = loading ? <SpinningLoaderCircle size={iconSize.row} color={colors.subtext} /> : icon;

  return (
    <Touchable
      testID={testID}
      style={[styles.option, dimRow && styles.optionDimmed]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      {leading}
      <View style={[styles.optionBody, !leading && styles.optionBodyNoIcon]}>
        <Text
          style={[
            styles.optionText,
            { color: labelColor ?? colors.secondary },
            dimLabel && styles.optionTextDimmed,
          ]}
        >
          {label}
        </Text>
        {description !== undefined && (
          <Text style={[styles.optionDescription, { color: colors.subtext }]}>{description}</Text>
        )}
      </View>
      {trailing}
    </Touchable>
  );
}

type InfoRowProps = {
  label: string;
  value: string | number;
  valueLines?: number;
};

export function OptionSheetInfoRow({ label, value, valueLines }: InfoRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.secondary }]} numberOfLines={valueLines}>
        {value}
      </Text>
    </View>
  );
}

type SectionLabelProps = {
  label: string;
  /** Adds top margin when the label follows another section */
  spaced?: boolean;
};

export function OptionSheetSectionLabel({ label, spaced }: SectionLabelProps) {
  const { colors } = useTheme();

  return (
    <Text style={[styles.sectionLabel, { color: colors.subtext }, spaced && styles.sectionLabelSpaced]}>
      {label}
    </Text>
  );
}

export function OptionSheetDivider() {
  const { colors } = useTheme();

  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

type ChipsRowProps = {
  label: string;
  values: string[];
};

export function OptionSheetChipsRow({ label, values }: ChipsRowProps) {
  const { isDarkMode, colors } = useTheme();
  const rad = useRadius();
  const chipBg = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={styles.chipsRow}>
      <Text style={[styles.infoLabel, { color: colors.subtext }]}>{label}</Text>
      <View style={styles.chipsList}>
        {values.map((value, i) => (
          <View key={`${value}-${i}`} style={[styles.chip, { backgroundColor: chipBg, borderRadius: rad.card }]}>
            <Text style={[styles.chipText, { color: colors.secondary }]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The sheet shell lives in `sheetScaffold`, which carries no components and so
 * can be imported by a sheet that needs nothing but a background. Re-exported
 * here because most sheets want the rows and the shell together.
 */
export {
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
  useSheetBottomInset,
} from './sheetScaffold';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  headerText: { flex: 1 },
  title: { ...typography.rowTitle },
  subtitle: { ...typography.rowSubtitle, marginTop: spacing.xxs },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  optionDimmed: {
    opacity: stateLayer.secondaryOpacity,
  },
  optionBody: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  optionBodyNoIcon: {
    marginLeft: 0,
  },
  optionText: { ...typography.rowTitle },
  optionTextDimmed: {
    opacity: stateLayer.pressedOpacity,
  },
  optionDescription: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  sectionLabelSpaced: {
    marginTop: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: { ...typography.rowSubtitle },
  infoValue: { ...typography.rowSubtitle, fontWeight: '500', marginLeft: spacing.md, flex: 1, textAlign: 'right' },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  chipsList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.inlineGap,
    marginLeft: spacing.md,
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
  },
  chip: {
    paddingHorizontal: spacing.controlGap,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '500',
  },
});
