import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  OptionSheetDivider,
  OptionSheetRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';
import { iconSize, spacing, statusColor, typography } from '@/constants/design';
import { useTheme } from '@/features/theme/useTheme';
import {
  cancelSleepTimer,
  sleepAtEndOfTrack,
  startSleepTimer,
  useSleepTimer,
} from '../sleepTimer';
import SleepTimerRemaining from './SleepTimerRemaining';

/** The durations on offer, in minutes — Spotify's set, which nobody has had to explain. */
const DURATIONS = [5, 10, 15, 30, 45, 60];

/**
 * Setting the sleep timer, opened from the playing track's options.
 *
 * A tick marks what is running, and its row still restarts it: picking
 * "15 minutes" again with four left is asking for fifteen more.
 */
const SleepTimerSheet = forwardRef<BottomSheetModal>((_, ref) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();
  const timer = useSleepTimer();

  const choose = (run: () => void) => {
    run();
    dismissSheetRef(ref);
  };
  const tick = <Check size={iconSize.row} color={colors.themeColor} />;

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
    >
      <BottomSheetScrollView
        testID="sleep-timer-sheet"
        style={sheetBg}
        contentContainerStyle={sheetContent}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.secondary }]}>{t('playing.sleepTimer.title')}</Text>
          {timer.mode !== 'off' && (
            <Text style={[styles.status, { color: colors.subtext }]}>
              {timer.mode === 'endOfTrack'
                ? t('playing.sleepTimer.stopsAtEndOfTrack')
                : <>{t('playing.sleepTimer.stopsIn')} <SleepTimerRemaining timer={timer} /></>}
            </Text>
          )}
        </View>
        <OptionSheetDivider />

        {DURATIONS.map(minutes => (
          <OptionSheetRow
            key={minutes}
            testID={`sleep-timer-${minutes}`}
            label={minutes === 60
              ? t('playing.sleepTimer.hours', { count: 1 })
              : t('playing.sleepTimer.minutes', { count: minutes })}
            trailing={timer.mode === 'duration' && timer.minutes === minutes ? tick : undefined}
            onPress={() => choose(() => startSleepTimer(minutes))}
          />
        ))}
        <OptionSheetRow
          testID="sleep-timer-end-of-track"
          label={t('playing.sleepTimer.endOfTrack')}
          trailing={timer.mode === 'endOfTrack' ? tick : undefined}
          onPress={() => choose(sleepAtEndOfTrack)}
        />

        {timer.mode !== 'off' && (
          <>
            <OptionSheetDivider />
            <OptionSheetRow
              testID="sleep-timer-off"
              label={t('playing.sleepTimer.turnOff')}
              labelColor={statusColor.destructive}
              onPress={() => choose(cancelSleepTimer)}
            />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

SleepTimerSheet.displayName = 'SleepTimerSheet';

export default SleepTimerSheet;

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.sheetTitle,
  },
  status: {
    ...typography.rowSubtitle,
    marginTop: spacing.xs,
  },
});
