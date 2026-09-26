import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { selectServerById } from '@/state/redux/selectors/serversSelectors';
import { updateServer } from '@/state/redux/slices/serversSlice';
import {
  listServerLibraries,
  libraryScopePatch,
  type Library,
} from '@/providers/registry/serverConnections';
import type { RootState } from '@/state/redux/store';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { iconSize, onDark, radius, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { selectOnboardingDiscoveryPrompted } from '@/features/settings/onboarding/state';

export default function LibrariesOnboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const rad = useRadius();
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const onboardingDiscoveryPrompted = useSelector(selectOnboardingDiscoveryPrompted);

  const server = useSelector((state: RootState) =>
    selectServerById(serverId)(state)
  );

  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!server) return;

    let cancelled = false;
    setIsLoading(true);
    setError(false);

    const load = async () => {
      try {
        const result = await listServerLibraries(server);
        if (!cancelled) setLibraries(result);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [server, retryCount]);

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds([]);

  const isAll = selectedIds.length === 0;

  const handleContinue = () => {
    if (!server) return;
    dispatch(updateServer({
      id: server.id,
      patch: { auth: { ...server.auth, ...libraryScopePatch(server, selectedIds) } },
    }));
    router.replace(
      onboardingDiscoveryPrompted
        ? '/(home)/(tabs)/(home)'
        : '/(onboarding)/discovery'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('onboarding.libraries.title')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.libraries.subtitle')}
        </Text>

        {isLoading ? (
          <SpinningLoaderCircle size={iconSize.loader} color={onDark.text} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('onboarding.libraries.loadError')}</Text>
            <Touchable style={[styles.retryButton, { borderRadius: rad.pill }]} onPress={() => setRetryCount(c => c + 1)}>
              <Text style={styles.retryButtonText}>{t('onboarding.libraries.retry')}</Text>
            </Touchable>
          </View>
        ) : (
          <View style={styles.optionList}>
            <Touchable onPress={selectAll} style={[styles.optionRow, { borderRadius: rad.md }]}>
              <View style={[styles.checkbox, isAll && styles.checkboxSelected]}>
                {isAll && <Check size={iconSize.badge} color={onDark.background} />}
              </View>
              <Text style={styles.optionText}>{t('onboarding.libraries.allLibraries')}</Text>
            </Touchable>

            {libraries.map(lib => {
              const selected = selectedIds.includes(lib.id);
              return (
                <Touchable
                  key={lib.id}
                  onPress={() => toggle(lib.id)}
                  style={[styles.optionRow, { borderRadius: rad.md }]}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Check size={iconSize.badge} color={onDark.background} />}
                  </View>
                  <Text style={styles.optionText} numberOfLines={1}>
                    {lib.name}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Touchable style={[styles.continueButton, { borderRadius: rad.pill }]} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>
            {isAll
              ? t('onboarding.libraries.useAll')
              : t('onboarding.libraries.continueWith', { count: selectedIds.length })}
          </Text>
        </Touchable>

        <Touchable style={[styles.backButton, { borderRadius: rad.pill }]} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </Touchable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: onDark.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.roomy,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.roomy,
  },
  title: {
    ...typography.display,
    color: onDark.text,
    marginBottom: spacing.controlGap,
  },
  subtitle: {
    ...typography.body,
    color: onDark.mutedText,
    marginBottom: spacing.xxl,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  optionList: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: onDark.muted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.rowGap,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: onDark.mutedText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: onDark.text,
    borderColor: onDark.text,
  },
  optionText: {
    ...typography.body,
    color: onDark.text,
    flex: 1,
  },
  buttonContainer: {
    padding: spacing.roomy,
    backgroundColor: onDark.background,
    alignItems: 'center',
  },
  errorContainer: {
    marginTop: spacing.xxxl,
    alignItems: 'center' as const,
    gap: spacing.page,
  },
  errorText: {
    ...typography.body,
    color: onDark.mutedText,
    textAlign: 'center' as const,
  },
  retryButton: {
    backgroundColor: onDark.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  retryButtonText: {
    ...typography.body,
    color: onDark.text,
    fontWeight: '600' as const,
  },
  continueButton: {
    backgroundColor: onDark.text,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  continueButtonText: {
    ...typography.sheetTitle,
    color: onDark.background,
  },
  backButton: {
    backgroundColor: onDark.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  backButtonText: {
    ...typography.sheetTitle,
    color: onDark.text,
  },
});
