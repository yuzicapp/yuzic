import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Paths } from 'expo-file-system';

import Touchable from '@/components/Touchable';
import { spacing, typography } from '@/constants/design';
import { useDownload } from '@/features/offline/DownloadContext';
import { formatBytes } from '@/features/offline/downloadStore';
import { useTheme } from '@/features/theme/useTheme';
import { confirmDestructive } from '@/features/entity-actions/shared/starActions';
import { notify } from '@/components/toast';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';

/**
 * The top of the library's Downloaded collection: how much this device holds,
 * and clearing it.
 *
 * The collection is the same list every other library collection uses, so
 * saved albums, playlists and tracks open, play and sort like they do
 * everywhere else, and each one's options remove it. There used to be a second
 * "Offline" screen behind this listing the same downloads again in a settings
 * layout — one list is enough.
 */
export default function DownloadedHeader() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const activeServer = useSelector(selectActiveServer);
  const { totalDownloadedBytes, downloadedTrackCount, clearDownloadsForProvider } = useDownload();
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  // Re-read whenever what is downloaded changes, which is when free space does.
  useEffect(() => {
    setFreeBytes(Paths.availableDiskSpace);
  }, [downloadedTrackCount]);

  const confirmClear = () => {
    confirmDestructive({
      title: t('settings.library.downloads.clearTitle'),
      body: t('settings.library.downloads.clearBodyForProvider'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('common.delete'),
      onConfirm: async () => {
        try {
          await clearDownloadsForProvider({ serverId: activeServer?.id, serverType: activeServer?.type });
        } catch {
          notify.error(t('settings.library.downloads.clearFailedBody'));
        }
      },
    });
  };

  return (
    <View style={styles.row} testID="downloaded-header">
      <Text style={[styles.summary, { color: colors.subtext }]} numberOfLines={1}>
        {t('downloads.offlineSummary', {
          size: formatBytes(totalDownloadedBytes),
          available: freeBytes != null ? formatBytes(freeBytes) : '—',
        })}
      </Text>
      <Touchable
        feedback="control"
        onPress={confirmClear}
        accessibilityRole="button"
        testID="downloaded-clear"
      >
        <Text style={[styles.clear, { color: colors.themeColor }]}>{t('library.downloaded.clear')}</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
  },
  summary: { ...typography.caption, flexShrink: 1 },
  clear: { ...typography.rowSubtitle, fontWeight: '600' },
});
