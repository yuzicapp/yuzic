import React, { ReactNode, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import Touchable from '@/components/Touchable';
import { hitSlopFor, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

type Props = {
  icon: ReactNode;
  text: string;
  /** Text color; defaults to the theme subtext color. */
  color?: string;
  /** Render a small ✕ and let the user dismiss the banner for this mount. */
  closable?: boolean;
  style?: ViewStyle;
  testID?: string;
};

// Small inline status pill used on detail screens — the same visual as the
// album header's "In Library" / "Downloading to server" row, extracted so
// other statuses (server unreachable, offline) share one look. Dismissal is
// per-mount state: the banner returns on the next visit, which is right for
// transient conditions like connectivity.
export default function StatusBanner({ icon, text, color, closable, style, testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const background = colors.statusSurface;
  const textColor = color ?? colors.subtext;

  return (
    <View style={[styles.row, { backgroundColor: background, borderRadius: rad.card }, style]} testID={testID}>
      {icon}
      <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
        {text}
      </Text>
      {closable && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.dismissNotification')}
          onPress={() => setDismissed(true)}
          hitSlop={hitSlopFor(icons.badge)}
          testID={testID ? `${testID}-close` : undefined}
        >
          <X size={icons.badge} color={textColor} />
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.tight,
  },
  text: {
    ...typography.caption,
    fontWeight: '500',
    flex: 1,
  },
});
