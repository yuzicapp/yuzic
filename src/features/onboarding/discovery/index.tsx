import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setSourceUses } from '@/features/settings/sources/state';
import { DISCOVERY_USES } from '@/providers/registry/sources';
import { setOnboardingDiscoveryPrompted } from '@/features/settings/onboarding/state';
import Touchable from '@/components/Touchable';
import { onDark, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

/**
 * One-time onboarding opt-in for external discovery (E4). Shown exactly
 * once, after a server (or local library) is connected — never as a global
 * modal for existing users. Both "Enable" and "Not now" mark
 * `onboardingDiscoveryPrompted`, which is what stops it reappearing;
 * discovery itself stays off unless the user explicitly enables it here.
 */
export default function Discovery() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const rad = useRadius();

  const finish = () => {
    router.replace('/(home)/(tabs)/(home)');
  };

  const handleEnable = () => {
    dispatch(setSourceUses({ uses: DISCOVERY_USES, enabled: true }));
    dispatch(setOnboardingDiscoveryPrompted(true));
    finish();
  };

  const handleNotNow = () => {
    dispatch(setOnboardingDiscoveryPrompted(true));
    finish();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>{t('onboarding.discovery.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.discovery.subtitle')}</Text>
        <Text style={styles.whatIsSent}>{t('onboarding.discovery.whatIsSent')}</Text>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Touchable
          style={[styles.enableButton, { borderRadius: rad.pill }]}
          testID="onboarding-discovery-enable"
          onPress={handleEnable}
        >
          <Text style={styles.enableButtonText}>{t('onboarding.discovery.enable')}</Text>
        </Touchable>

        <Touchable
          style={[styles.notNowButton, { borderRadius: rad.pill }]}
          testID="onboarding-discovery-not-now"
          onPress={handleNotNow}
        >
          <Text style={styles.notNowButtonText}>{t('onboarding.discovery.notNow')}</Text>
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
    marginBottom: spacing.roomy,
  },
  whatIsSent: {
    ...typography.caption,
    color: onDark.subtext,
  },
  buttonContainer: {
    padding: spacing.roomy,
    backgroundColor: onDark.background,
    alignItems: 'center',
  },
  enableButton: {
    backgroundColor: onDark.text,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  enableButtonText: {
    ...typography.sheetTitle,
    color: onDark.background,
  },
  notNowButton: {
    backgroundColor: onDark.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  notNowButtonText: {
    ...typography.sheetTitle,
    color: onDark.text,
  },
});
