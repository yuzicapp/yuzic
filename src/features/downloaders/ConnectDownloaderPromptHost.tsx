import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

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
import { ALL_DOWNLOADERS } from './registry';
import { dismissConnectDownloaderPrompt, usePendingDownloaderPrompt } from './connectDownloaderPrompt';

/**
 * The one sheet that offers to connect a downloader from where a Get needed
 * one, mounted once at the root. It lists only the downloaders that can take
 * what was asked for — a track Get offers none that are album-only; an album
 * Get offers every one, since a track-only downloader takes an album as its
 * tracks; an artist Get offers only the ones that follow artists — and each
 * opens that downloader's own settings, where it is connected.
 */
export default function ConnectDownloaderPromptHost() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();
  const sheetRef = useSheetRef();
  const unit = usePendingDownloaderPrompt();

  useEffect(() => {
    if (unit) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [unit, sheetRef]);

  const offered = unit
    ? ALL_DOWNLOADERS.filter(def => {
        if (unit === 'artist') return !!def.monitorArtist;
        if (unit === 'track') return !!def.downloadTrack;
        return !!(def.downloadAlbum || def.downloadTrack);
      })
    : [];

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      onDismiss={dismissConnectDownloaderPrompt}
    >
      <BottomSheetView style={[sheetContent, sheetBg]}>
        {unit && (
          <>
            <Text style={[styles.title, { color: colors.secondary }]}>
              {t('externalAlbum.connectDownloader.title')}
            </Text>
            <Text style={[styles.body, { color: colors.subtext }]}>
              {t('externalAlbum.connectDownloader.body')}
            </Text>
            <OptionSheetDivider />
            {offered.map(def => (
              <OptionSheetRow
                key={def.id}
                testID={`connect-downloader-${def.id}`}
                label={t('externalAlbum.connectDownloader.setUp', { name: def.label })}
                description={t(def.descriptionKey)}
                labelColor={colors.themeColor}
                onPress={() => {
                  dismissConnectDownloaderPrompt();
                  router.push(def.settingsRoute);
                }}
              />
            ))}
            <OptionSheetRow
              testID="connect-downloader-not-now"
              label={t('externalAlbum.connectDownloader.notNow')}
              onPress={dismissConnectDownloaderPrompt}
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
