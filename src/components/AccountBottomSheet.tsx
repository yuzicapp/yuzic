import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Settings, RefreshCw, LogOut } from 'lucide-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { usePlayingActions } from '@/features/playback/PlayingContext';
import { useRouter } from 'expo-router';
import { useApi } from '@/providers/registry/useApi';
import { disconnect } from '@/state/redux/slices/serversSlice';
import { notify } from '@/components/toast';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { useTheme } from '@/features/theme/useTheme';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import Touchable from '@/components/Touchable';
import UserAvatar from '@/components/UserAvatar';
import { controlSize, iconSize, radius, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';

type Props = {
  onDismiss?: () => void;
};

const AccountBottomSheet = forwardRef<BottomSheetModal, Props>(({ onDismiss }, ref) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const router = useRouter();
  const dispatch = useDispatch();
  const api = useApi();
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();

  const activeServer = useSelector(selectActiveServer);
  const username = activeServer?.username;
  const serverUrl = activeServer?.serverUrl;
  const type = activeServer?.type;

  const queryClient = useQueryClient();
  const { pauseSong, resetQueue } = usePlayingActions();

  const cleanUrl = serverUrl?.replace(/^https?:\/\//, '');
  const close = () => dismissSheetRef(ref);

  const handleSettings = () => {
    close();
    router.push('/settings');
  };

  const handleScan = async () => {
    close();
    try {
      const result = await api.auth.startScan();
      notify.success(result?.message ?? t('home.account.scanTriggered'));
    } catch {
      notify.error(t('home.account.scanFailed'));
    }
  };

  const handleSignOut = async () => {
    close();
    try {
      await pauseSong();
      await resetQueue();
      dispatch(disconnect());
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace('/(onboarding)');
    } catch {
      notify.error(t('home.account.signOutFailed'));
    }
  };

  const destructiveColor = colors.destructive;

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={[sheetBg, sheetContent]}>
        {/* Profile */}
        <View style={styles.header}>
          <UserAvatar username={username} size={controlSize.avatarSheet} borderRadius={rad.pill} />
          <View style={styles.headerInfo}>
            <Text style={[styles.username, { color: colors.secondary }]}>{username}</Text>
            <View style={styles.serverMeta}>
              {type && (
                <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.subtext }]}>{type}</Text>
                </View>
              )}
              <Text style={[styles.serverUrl, { color: colors.subtext }]} numberOfLines={1}>
                {cleanUrl}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Actions */}
        <Touchable testID="account-settings" style={styles.row} onPress={handleSettings}>
          <Settings size={iconSize.row} color={colors.subtext} />
          <Text style={[styles.rowText, { color: colors.secondary }]}>{t('home.account.settings')}</Text>
        </Touchable>

        <Touchable style={styles.row} onPress={handleScan}>
          <RefreshCw size={iconSize.row} color={colors.subtext} />
          <Text style={[styles.rowText, { color: colors.secondary }]}>{t('home.account.triggerScan')}</Text>
        </Touchable>

        <Touchable style={styles.row} onPress={handleSignOut}>
          <LogOut size={iconSize.row} color={destructiveColor} />
          <Text style={[styles.rowText, { color: destructiveColor }]}>{t('home.account.signOut')}</Text>
        </Touchable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

AccountBottomSheet.displayName = 'AccountBottomSheet';

export default AccountBottomSheet;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGap,
    marginBottom: spacing.lg,
  },
  headerInfo: {
    flex: 1,
  },
  username: {
    ...typography.sheetTitle,
    marginBottom: spacing.xs,
  },
  serverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  typeBadge: {
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
  },
  typeBadgeText: {
    ...typography.micro,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  serverUrl: {
    ...typography.caption,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGap,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowText: {
    ...typography.compactRowTitle,
  },
});
