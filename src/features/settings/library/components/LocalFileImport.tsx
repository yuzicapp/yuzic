import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { notify } from '@/components/toast';
import { FilePlus2, ChevronRight } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { pickAndImportLocalFiles } from '@/providers/server/local/pickAndImport';
import Touchable from '@/components/Touchable';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { spacing, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useSync } from '@/features/library/useSync';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import SettingsCard from '../../components/SettingsCard';

/**
 * The local library is private app storage, not a device-wide media scan. This
 * gives its owner a way to add files later without exposing a faux server
 * setting or asking for broad media permissions.
 */
export default function LocalFileImport() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const activeServer = useSelector(selectActiveServer);
  const { sync } = useSync();
  const [importing, setImporting] = useState(false);

  if (activeServer?.type !== 'local') return null;

  const pick = async () => {
    setImporting(true);
    try {
      const outcome = await pickAndImportLocalFiles();
      if (!outcome) return;
      if (outcome.imported) {
        notify.success(t('onboarding.local.imported', { count: outcome.imported }));
        await sync(true);
      }
      if (outcome.unsupported) notify.error(t('onboarding.local.unsupported', { count: outcome.unsupported }));
      if (outcome.failed) notify.error(t('onboarding.local.importFailed'));
    } catch {
      notify.error(t('onboarding.local.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Text style={[styles.title, { color: colors.subtext }]}>{t('settings.library.localFiles.title')}</Text>
      <SettingsCard>
        <Touchable
          style={styles.row}
          onPress={pick}
          disabled={importing}
          accessibilityRole="button"
          accessibilityState={{ disabled: importing, busy: importing }}
        >
          <View style={styles.left}>
            <View style={styles.icon}>
              <FilePlus2 size={icons.row} color={colors.themeColor} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.label, { color: colors.secondary }]}>{t('settings.library.localFiles.import')}</Text>
              <Text style={[styles.description, { color: colors.subtext }]}>{t('settings.library.localFiles.description')}</Text>
            </View>
          </View>
          {importing
            ? <SpinningLoaderCircle size={icons.row} color={colors.themeColor} />
            : <ChevronRight size={icons.row} color={colors.border} />}
        </Touchable>
      </SettingsCard>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.caption,
    marginBottom: spacing.tight,
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.md },
  icon: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  label: { ...typography.rowTitle },
  description: { ...typography.rowSubtitle },
});
