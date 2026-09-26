import { iconSize, onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { CloudDownload } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { useDownloadersQueue } from '@/features/downloaders/DownloadersQueueContext';
/**
 * Banner that surfaces active downloader queues (Lidarr / slskd) at the top
 * of Home so users see what's in flight without diving into Settings →
 * Downloaders → each one. Auto-hides when nothing's queued.
 *
 * Tap → opens the top-level Downloads screen with every connected
 * downloader's queue in one place.
 */
export function DownloadsInProgressBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const router = useRouter();
  const { queues, totalInFlight } = useDownloadersQueue();

  if (totalInFlight === 0) return null;

  const handleOpen = () => {
    router.push('/downloadsView');
  };

  // Only the downloaders actually carrying something. A connected downloader
  // keeps its entry whether or not anything is queued — an empty queue is a
  // real answer, and the Downloads screen needs it to tell "nothing is
  // transferring" apart from "not read yet". A banner about work in progress
  // is not that surface: naming an idle one there said "0 on slskd" beside a
  // heading counting eleven downloads. Safe against an empty subtitle, since
  // a nonzero total means at least one of these is nonzero.
  const summary = queues
    .filter((q) => q.count > 0)
    .map((q) => t('home.downloadsBanner.summaryItem', {
      label: q.label,
      count: q.count,
    }))
    .join(' · ');

  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderRadius: rad.card }]}>
      <Touchable style={styles.body} onPress={handleOpen} accessibilityRole="button" accessibilityLabel={t('home.downloadsBanner.open')}>
        <View style={[styles.iconWrap, { backgroundColor: colors.themeColor, borderRadius: rad.pill }]}>
          <SpinningLoaderCircle size={iconSize.badge} color={onDark.background} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>
            {t('home.downloadsBanner.title', { count: totalInFlight })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <CloudDownload size={iconSize.control} color={colors.subtext} />
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.rowTitle },
  subtitle: { ...typography.caption, marginTop: spacing.xxs },
});
