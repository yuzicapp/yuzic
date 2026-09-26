import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/features/theme/useTheme';
import Touchable from '@/components/Touchable';
import UserAvatar from '@/components/UserAvatar';
import { controlSize, hitSlopFor, iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

/** Header shared by the Home, Library and Search tabs: screen title plus the
 * account avatar. */
type Props = {
  title: string;
  username?: string;
  onAccountPress: () => void;
};

export default function TabHeader({ title, username, onAccountPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary }]}>{title}</Text>

      <View style={styles.actions}>
        <Touchable
          accessibilityLabel={t('a11y.account')}
          accessibilityRole="button"
          style={styles.avatar}
          onPress={onAccountPress}
          hitSlop={hitSlopFor(iconSize.large)}
        >
          <UserAvatar username={username} size={controlSize.avatarTabHeader} borderRadius={rad.pill} />
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.screenTitle,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginLeft: spacing.md,
  },
});
