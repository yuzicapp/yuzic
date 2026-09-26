import { hitSlopFor, iconSize, onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Play, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import Touchable from '@/components/Touchable';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { useTheme } from '@/features/theme/useTheme';
import { useRadius } from '@/features/theme/useRadius';
import { useResumableServerQueue } from '@/features/playback/useResumableServerQueue';
/**
 * Shown at the top of Home when the server has a recent queue that this
 * session hasn't started. One tap resumes; the X dismisses for the session.
 *
 * Deliberately a banner, not a modal — a modal on cold start reads as
 * intrusive when the user might just want to browse. This is a suggestion,
 * not a hijack.
 */
export function ResumeQueueBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const { available, resuming, resume, dismiss } = useResumableServerQueue();

  if (!available) return null;

  const from = available.changedBy
    ? t('home.resumeBanner.fromDevice', { device: available.changedBy })
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderRadius: rad.card }]}>
      <Touchable
        style={styles.body}
        onPress={() => void resume()}
        disabled={resuming}
        accessibilityRole="button"
        accessibilityLabel={t('home.resumeBanner.resumeLabel')}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.themeColor, borderRadius: rad.pill }]}>
          {resuming
            ? <SpinningLoaderCircle size={iconSize.inline} color={onDark.background} />
            : <Play size={iconSize.inline} color={onDark.background} fill={onDark.background} />
          }
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.secondary }]} numberOfLines={1}>
            {t('home.resumeBanner.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
            {t('home.resumeBanner.subtitle', {
              count: available.songIds.length,
              from,
            })}
          </Text>
        </View>
      </Touchable>
      <Touchable
        onPress={dismiss}
        hitSlop={hitSlopFor(18)}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
      >
        <X size={iconSize.row} color={colors.subtext} />
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.rowTitle },
  subtitle: { ...typography.caption, marginTop: spacing.xxs },
  dismiss: { padding: spacing.sm },
});
