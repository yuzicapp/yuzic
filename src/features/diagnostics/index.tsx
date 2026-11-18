import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { FileText, Share2, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/Text';
import EmptyState from '@/components/EmptyState';
import Header from '@/features/settings/components/Header';
import SettingsCard from '@/features/settings/components/SettingsCard';
import SettingsDivider from '@/features/settings/components/SettingsDivider';
import SettingsRow from '@/features/settings/components/SettingsRow';
import { notify } from '@/components/toast';
import { spacing, typography } from '@/constants/design';
import { useIconSize } from '@/features/theme/useIconSize';
import { useScrollClearance } from '@/features/theme/useScrollClearance';
import { useTheme } from '@/features/theme/useTheme';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';

import { clearDiagnostics } from './install';
import { formatRecord, shareLog } from './exportLog';
import { log } from './log';
import type { Level } from './record';

/**
 * What the app recorded, and the way out of the device.
 *
 * This screen is the reason `features/diagnostics` exists. The log can hold
 * the component stack that explains a crash and the error code that explains
 * a dead track, and until there was a share sheet none of it could reach the
 * person who could fix it — #324, #320 and #318 have all been open for weeks
 * for want of exactly this.
 *
 * **The records are on screen, not just in the export.** Sharing sends song
 * titles and the endpoints that failed somewhere the user chooses, which may
 * be a public issue. Even scrubbed of credentials that is their listening, so
 * the screen shows what the share will contain rather than asking them to
 * trust it. It is also why Clear is here, and why it says what it does.
 *
 * Newest first, which is the opposite of the export. A reader opening this
 * wants the thing that just happened; a reader of the export wants to follow
 * what led to it.
 */
const LEVEL_COLOR_ROLE: Record<Level, 'secondary' | 'subtext'> = {
  // Warnings and errors are what this screen is for, so they take the
  // reading colour; info and debug are context and stay quiet. Not the accent
  // for either — the accent means *chosen* or *yours*, and a failure is
  // neither.
  error: 'secondary',
  warn: 'secondary',
  info: 'subtext',
  debug: 'subtext',
};

export default function Diagnostics() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const scrollClearance = useScrollClearance();
  const activeServer = useSelector(selectActiveServer);

  // The log is not reactive state: nothing re-renders when a record arrives,
  // and a screen that repainted on every record would be unreadable during
  // the burst it exists to explain. Read once on mount, and again when the
  // user clears.
  const [records, setRecords] = useState(() => [...log.records()].reverse());
  const [sharing, setSharing] = useState(false);

  const onShare = useCallback(async () => {
    setSharing(true);
    try {
      await shareLog({ backend: activeServer?.type });
    } finally {
      setSharing(false);
    }
  }, [activeServer?.type]);

  const onClear = useCallback(() => {
    clearDiagnostics();
    setRecords([]);
    notify.info(t('settings.diagnostics.cleared'));
  }, [t]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={t('settings.diagnostics.title')} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollClearance }]}>
        <Text style={[styles.explainer, { color: colors.subtext }]}>
          {t('settings.diagnostics.explainer')}
        </Text>

        <SettingsCard>
          <SettingsRow
            testID="diagnostics-share"
            label={sharing ? t('settings.diagnostics.sharing') : t('settings.diagnostics.share')}
            leftIcon={<Share2 size={icons.secondary} color={colors.secondary} />}
            onPress={onShare}
          />
          <SettingsDivider />
          <SettingsRow
            testID="diagnostics-clear"
            label={t('settings.diagnostics.clear')}
            leftIcon={<Trash2 size={icons.secondary} color={colors.secondary} />}
            onPress={onClear}
          />
        </SettingsCard>

        {records.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              icon={<FileText size={icons.emptyState} color={colors.subtext} />}
              message={t('settings.diagnostics.empty')}
            />
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
              {t('settings.diagnostics.recordCount', { count: records.length })}
            </Text>
            <SettingsCard style={styles.recordCard}>
              {records.map((record, index) => (
                <Text
                  // Index, not the record: two records can share a timestamp,
                  // a scope and a message — a burst of one failing track is
                  // exactly that — and the list never reorders.
                  key={index}
                  style={[styles.record, { color: colors[LEVEL_COLOR_ROLE[record.level]] }]}
                >
                  {formatRecord(record)}
                </Text>
              ))}
            </SettingsCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  explainer: {
    ...typography.rowSubtitle,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.tight,
    marginLeft: spacing.xs,
  },
  recordCard: {
    padding: spacing.md,
  },
  record: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  empty: {
    marginTop: spacing.xl,
  },
});
