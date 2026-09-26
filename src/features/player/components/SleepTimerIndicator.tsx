import React from 'react';
import { useIconSize } from '@/features/theme/useIconSize';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Moon } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import { cappedTypography, onDark, radius, spacing, stateLayer } from '@/constants/design';
import { useSleepTimer } from '../sleepTimer';
import SleepTimerRemaining from './SleepTimerRemaining';

type Props = {
  /** Opens the sleep timer sheet — the same one the track's options opens. */
  onPress: () => void;
};

/**
 * What is left on a running sleep timer, in the player's header.
 *
 * The timer is *set* from the track's options, like every other thing you can
 * do to the track. This is only the answer to "is one running, and how long
 * have I got" — the one part of it that has to be visible without opening
 * anything, since a listener who set a timer and then wondered had nowhere to
 * look. Absent entirely when no timer is running, so the header is otherwise
 * exactly as it was.
 *
 * It is also the quickest way back: tapping it opens the same sheet, which is
 * where the timer is changed or turned off.
 */
export default function SleepTimerIndicator({ onPress }: Props) {
  const { t } = useTranslation();
  const icons = useIconSize();
  const timer = useSleepTimer();

  if (timer.mode === 'off') return null;

  return (
    <Touchable
      testID="playing-sleep-timer-indicator"
      accessibilityRole="button"
      accessibilityLabel={t('a11y.player.sleepTimer')}
      onPress={onPress}
      style={styles.chip}
    >
      <View style={styles.content}>
        <Moon size={icons.badge} color={onDark.text} />
        <SleepTimerRemaining timer={timer} style={styles.remaining} />
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    // Round at every preset by identity, not by shape language: this is the
    // countdown pip on the player, and a squared one reads as a different
    // component rather than a sharper one. `useRadius`'s own note makes the
    // same distinction.
    // eslint-disable-next-line no-restricted-syntax
    borderRadius: radius.pill,
    backgroundColor: stateLayer.rippleDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  remaining: {
    ...cappedTypography.glyph.micro,
    color: onDark.text,
    fontWeight: '600',
  },
});
