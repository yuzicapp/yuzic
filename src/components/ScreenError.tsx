import React from 'react';
import { useRadius } from '@/features/theme/useRadius';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import RNRestart from 'react-native-restart';
import { TriangleAlert } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import { iconSize, spacing, typography } from '@/constants/design';

type ScreenErrorPalette = {
  background: string;
  text: string;
  subtext: string;
  surface: string;
  border: string;
};

type Props = {
  error: Error | null;
  /** Renders the failed part again. Absent, only a restart is offered. */
  retry?: () => void | Promise<void>;
  palette: ScreenErrorPalette;
};

/**
 * What a render crash leaves on screen.
 *
 * Offers "Try again" first: most render crashes come from data that was
 * briefly wrong, and re-rendering is cheaper than a restart that drops the
 * queue and scroll position. The error's own message stays visible because it
 * is what a bug report needs.
 */
export default function ScreenError({ error, retry, palette }: Props) {
  const rad = useRadius();
  const { t } = useTranslation();

  return (
    <View testID="screen-error" style={[styles.container, { backgroundColor: palette.background }]}>
      <TriangleAlert size={iconSize.emptyState} color={palette.subtext} />
      <Text style={[styles.title, { color: palette.text }]}>{t('common.error.crashTitle')}</Text>
      <Text style={[styles.body, { color: palette.subtext }]}>{t('common.error.crashBody')}</Text>
      {error?.message ? (
        <Text style={[styles.detail, { color: palette.subtext }]} numberOfLines={4} selectable>
          {error.message}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {retry && (
          <Touchable
            testID="screen-error-retry"
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: rad.md }]}
            onPress={() => void retry()}
          >
            <Text style={[styles.buttonText, { color: palette.text }]}>{t('common.retry')}</Text>
          </Touchable>
        )}
        <Touchable
          testID="screen-error-restart"
          accessibilityRole="button"
          style={[styles.button, { borderColor: palette.border, borderRadius: rad.md }]}
          onPress={() => RNRestart.Restart()}
        >
          <Text style={[styles.buttonText, { color: palette.text }]}>{t('common.error.restart')}</Text>
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    textAlign: 'center',
  },
  body: {
    ...typography.rowSubtitle,
    textAlign: 'center',
  },
  detail: {
    ...typography.caption,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  buttonText: {
    ...typography.button,
  },
});
