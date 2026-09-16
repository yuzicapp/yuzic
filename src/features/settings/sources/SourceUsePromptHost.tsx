import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  OptionSheetDivider,
  OptionSheetRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { useSheetRef } from '@/components/useSheetRef';
import { spacing, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import { SOURCES, SOURCE_USES } from '@/providers/registry/sources';
import { completeSourceUsePrompt, dismissSourceUsePrompt, usePendingSourceUse } from './sourceUsePrompt';
import { setSourceUse } from './state';

/**
 * The one sheet that asks to turn a source use on from where it was needed,
 * mounted once at the root. It says what the use adds and what the source is
 * sent, and turning it on changes that one use — the same switch as in
 * Settings, where it can be turned off again.
 */
export default function SourceUsePromptHost() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();
  const sheetRef = useSheetRef();
  const pending = usePendingSourceUse();

  const use = pending ? SOURCE_USES.find(entry => entry.id === pending) : undefined;

  useEffect(() => {
    if (use) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [use, sheetRef]);

  const name = use ? t(SOURCES[use.source].nameKey) : '';

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      onDismiss={dismissSourceUsePrompt}
    >
      <BottomSheetView style={[sheetContent, sheetBg]}>
        {use && (
          <>
            <Text style={[styles.title, { color: colors.secondary }]}>
              {t('settings.sources.promptTitle', {
                use: t(`settings.sourcePurposes.${use.purpose}`),
                name,
              })}
            </Text>
            <Text style={[styles.body, { color: colors.subtext }]}>{t(use.subtextKey)}</Text>
            <Text style={[styles.body, { color: colors.subtext }]}>{t(SOURCES[use.source].sendsKey)}</Text>
            <OptionSheetDivider />
            <OptionSheetRow
              testID="source-use-prompt-turn-on"
              label={t('settings.sources.turnOn')}
              labelColor={colors.themeColor}
              onPress={() => {
                dispatch(setSourceUse({ use: use.id, enabled: true }));
                completeSourceUsePrompt();
              }}
            />
            <OptionSheetRow
              testID="source-use-prompt-not-now"
              label={t('settings.sources.notNow')}
              onPress={dismissSourceUsePrompt}
            />
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.rowTitle,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.rowSubtitle,
    marginBottom: spacing.sm,
  },
});
