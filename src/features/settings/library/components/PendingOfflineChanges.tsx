import { iconSize, onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { CloudUpload, RotateCcw, Trash2 } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { selectOfflineMutationQueue } from '@/state/redux/selectors/offlineMutationsSelectors';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import {
  clearOfflineMutationsForServer,
  retryOfflineMutationsForServer,
} from '@/state/redux/slices/offlineMutationsSlice';
import SettingsCard from '../../components/SettingsCard';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';

export default function PendingOfflineChanges() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const activeServer = useSelector(selectActiveServer);
  const activeServerId = activeServer?.id;
  const queue = useSelector(selectOfflineMutationQueue);
  const serverQueue = activeServerId
    ? queue.filter(item => item.serverId === activeServerId)
    : queue;
  const pendingCount = serverQueue.length;
  const failedCount = serverQueue.filter(item => item.lastError).length;

  if (pendingCount === 0) return null;

  const retryFailed = () => {
    if (!activeServerId) return;
    dispatch(retryOfflineMutationsForServer(activeServerId));
  };

  const discardPending = () => {
    if (!activeServerId) return;
    Alert.alert(
      t('settings.library.offlineChanges.discardTitle'),
      t('settings.library.offlineChanges.discardBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.library.offlineChanges.discard'),
          style: 'destructive',
          onPress: () => dispatch(clearOfflineMutationsForServer(activeServerId)),
        },
      ]
    );
  };

  const discardIconColor = colors.destructiveOnSurface;
  const discardBtnStyle = { borderColor: colors.destructiveBorder, backgroundColor: colors.destructiveSurface };
  const discardTextColor = colors.destructiveOnSurface;

  return (
    <SettingsCard style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${colors.themeColor}22`, borderRadius: rad.pill }]}>
        <CloudUpload size={iconSize.control} color={colors.themeColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.secondary }]}>
          {t('settings.library.offlineChanges.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {t(
            failedCount > 0
              ? 'settings.library.offlineChanges.failedSubtitle'
              : 'settings.library.offlineChanges.subtitle',
            { count: failedCount || pendingCount }
          )}
        </Text>
        <View style={styles.actions}>
          {failedCount > 0 && (
            <Touchable
              onPress={retryFailed}
              style={[
                styles.actionButton,
                { backgroundColor: `${colors.themeColor}18`, borderColor: `${colors.themeColor}44`, borderRadius: rad.md },
              ]}
            >
              <RotateCcw size={icons.badge} color={colors.themeColor} />
              <Text style={[styles.actionText, { color: colors.themeColor }]}>
                {t('settings.library.offlineChanges.retry')}
              </Text>
            </Touchable>
          )}
          <Touchable
            onPress={discardPending}
            style={[styles.actionButton, discardBtnStyle, { borderRadius: rad.md }]}
          >
            <Trash2 size={icons.badge} color={discardIconColor} />
            <Text style={[styles.actionText, { color: discardTextColor }]}>
              {t('settings.library.offlineChanges.discard')}
            </Text>
          </Touchable>
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: colors.themeColor, borderRadius: rad.pill }]}>
        <Text style={styles.badgeText}>{pendingCount}</Text>
      </View>
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: { flex: 1 },
  title: {
    ...typography.button,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.controlGap,
  },
  actionButton: {
    minHeight: 30,
    borderWidth: 1,
    paddingHorizontal: spacing.controlGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  actionText: {
    ...typography.caption,
    fontWeight: '600',
  },
  badge: {
    minWidth: 28,
    // Was a fixed 28 with a count inside, which clipped once the text size
    // could change without a relaunch.
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.controlGap,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: onDark.text,
  },
});
